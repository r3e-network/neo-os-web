import { createObservable, defineMiniApp } from "@shared/react";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { addressToScriptHash } from "@shared/utils/neo";
import { eventStateValue } from "@shared/utils/chain-events";
import {
  eventHashMatches as addrEq,
  mapField,
  normalizedHash as normHash,
} from "@framework/gamefi";
import PhaserPlayArea from "./PhaserPlayArea";
import manifest from "./manifest";
import { messages } from "./locale/messages";
import {
  DEAL_TTL_MS,
  ENTRY_MEMO,
  SETTLE_GRACE_MS,
  ruleOf,
  statusOf,
  gasDisplay,
} from "./logic/game-rules";
import { morpheusNetworkOf, teeFinalize, teeMove, teeStart } from "./logic/tee-session";
import type { CardView, TeeIdentity, TeeOp, TeeStartResult } from "./logic/tee-session";
import { createGuestEngine } from "./logic/guest-engine";

const appId = "miniapp-sheep-solitaire";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX = "ops:";
const RECOVERY_STORAGE_PREFIX = "recovery:";
/** Manifest hiding is not authorization: new paid starts also fail closed here. */
export const NEW_PAID_RUNS_ENABLED = false;

type FailureReason = "none" | "tray" | "timeout";
type RecoveryKind = "bind" | "settle" | "expire";

interface RecoveryRecord {
  gameId: string;
  kind: RecoveryKind;
  player: string;
  contract: string;
}

function asNumber(value: unknown): number {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
}

function cleanHex(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/^0x/, "");
}

export interface LeaderEntry {
  rank: number;
  address: string;
  totalWon: number;
  solves: number;
  isUser: boolean;
}

export interface SolveRow {
  gameId: string;
  difficulty: number;
  elapsedMs: number;
  undos: number;
  payout: string;
}

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    // Route ad-hoc arg-building / reads / invokes / events through the MiniApp
    // framework SDK. Behaviour-preserving: arg.* builders emit the identical
    // stack items, and readRaw/invoke/events/detectNetwork are raw passthroughs
    // to the host chain service the framework wraps.
    const app = ctx.framework;

    // TEE op log via the framework's namespaced local storage. Best-effort:
    // the TEE session is the authority, so persistence failures are swallowed.
    const loadOps = (gameId: string): TeeOp[] => {
      const parsed = app.storage.local.get<TeeOp[]>(OPS_STORAGE_PREFIX + gameId, []);
      return Array.isArray(parsed) ? parsed : [];
    };

    const saveOps = (gameId: string, ops: TeeOp[]): void => {
      try {
        app.storage.local.set(OPS_STORAGE_PREFIX + gameId, ops);
      } catch {
        /* op log is best-effort; the TEE session is the authority */
      }
    };

    const forgetOps = (gameId: string): void => {
      try {
        app.storage.local.delete(OPS_STORAGE_PREFIX + gameId);
      } catch {
        /* nothing to clean */
      }
    };

    const credit = createObservable(0);
    const poolFree = createObservable(0);
    const activeGameId = createObservable("0");
    const gameStatus = createObservable("idle");
    const gameDifficulty = createObservable(0);
    const commitment = createObservable("");
    const startedAt = createObservable(0);
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
    const undosUsed = createObservable(0);
    /** Card pile state: cards visible from the TEE view. */
    const pileCards = createObservable<CardView[]>([]);
    /** Slot bar: cards the player has picked (max 7). */
    const slotCards = createObservable<CardView[]>([]);
    /** Whether a match-3 elimination animation is playing. */
    const isMatching = createObservable(false);
    /** Whether the game was lost (slots full). */
    const isGameOver = createObservable(false);
    const failureReason = createObservable<FailureReason>("none");
    /** Shuffle tool uses left (0 or 1). */
    const shuffleLeft = createObservable(1);
    /** Remove 3 tool uses left (0 or 1). */
    const remove3Left = createObservable(1);
    const isPicking = createObservable(false);
    const lastPayout = createObservable("");
    const lastElapsedMs = createObservable(0);
    const leaderboard = createObservable<LeaderEntry[]>([]);
    const myRank = createObservable(0);
    const myTotalWon = createObservable(0);
    const mySolves = createObservable(0);
    const myHistory = createObservable<SolveRow[]>([]);
    const isStarting = createObservable(false);
    const isDealing = createObservable(false);
    const isSubmitting = createObservable(false);
    const isUndoing = createObservable(false);
    const isTeeBusy = createObservable(false);
    const isRecovering = createObservable(false);
    const isFinancialAction = createObservable(false);
    const newPaidRunsEnabled = createObservable(NEW_PAID_RUNS_ENABLED);
    const lastStatus = createObservable(ctx.t("statusReady"));
    // Current play mode, mirrored from app.mode so the PlayArea can branch its
    // GAS-centric copy to local framing in guest. Kept in sync via onChange.
    const appMode = createObservable<"guest" | "gamefi">(app.mode.get());

    let session: (TeeStartResult & { identity: TeeIdentity }) | null = null;
    let financialInFlight = false;
    let teeInFlight = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
    let matchTimer: ReturnType<typeof setTimeout> | null = null;

    const clearDeadlineTimer = (): void => {
      if (deadlineTimer !== null) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
    };

    const clearMatchTimer = (): void => {
      if (matchTimer !== null) {
        clearTimeout(matchTimer);
        matchTimer = null;
      }
    };

    const withFinancialLock = async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
      if (financialInFlight) return undefined;
      financialInFlight = true;
      isFinancialAction.set(true);
      try {
        return await work();
      } finally {
        financialInFlight = false;
        isFinancialAction.set(false);
      }
    };

    const withTeeLock = async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
      if (teeInFlight || financialInFlight) return undefined;
      teeInFlight = true;
      isTeeBusy.set(true);
      try {
        return await work();
      } finally {
        teeInFlight = false;
        isTeeBusy.set(false);
      }
    };

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local match-3 engine — no chain/oracle/reward calls.
    const guest = createGuestEngine({
      gameStatus,
      activeGameId,
      gameDifficulty,
      commitment,
      dealtAt,
      deadline,
      undosUsed,
      pileCards,
      slotCards,
      isMatching,
      isGameOver,
      failureReason,
      shuffleLeft,
      remove3Left,
      isStarting,
      isDealing,
      isSubmitting,
      isUndoing,
      isPicking,
      lastPayout,
      lastElapsedMs,
      leaderboard,
      myRank,
      myTotalWon,
      mySolves,
      myHistory,
      credit,
      poolFree,
      lastStatus,
      guestLeaderboard: app.mode.guestLeaderboard,
      storage: {
        get: <T,>(key: string, fallback: T): T => app.storage.local.get<T>(key, fallback) ?? fallback,
        set: (key: string, value: unknown): void => app.storage.local.set(key, value),
        delete: (key: string): void => app.storage.local.delete(key),
      },
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the mirrored mode in sync; switching to guest at the launcher resets
    // to a clean local lobby and loads the off-chain guest board (replacing the
    // on-chain read done on mount).
    const stopModeSync = app.mode.onChange((mode) => {
      appMode.set(mode);
      clearDeadlineTimer();
      clearMatchTimer();
      if (mode === "guest") {
        session = null;
        void guest.enter();
      } else {
        // Freeze (and persist) the local run while a historical GameFi recovery
        // surface is open; guest timers must not mutate chain-facing state.
        guest.dispose();
      }
    });

    const playerScriptHash = (): string => {
      const player = app.chain.address.get();
      return player ? addressToScriptHash(player) : "";
    };

    const normalizedContractHash = (): string => {
      const normalized = normHash(app.chain.contractAddress.get());
      return normalized ? `0x${normalized}` : "";
    };

    const recoveryKey = (): string => {
      const player = normHash(playerScriptHash());
      const contract = normHash(app.chain.contractAddress.get());
      return player && contract ? `${RECOVERY_STORAGE_PREFIX}${contract}:${player}` : "";
    };

    const saveRecovery = (gameId: string, kind: RecoveryKind): void => {
      const key = recoveryKey();
      const player = normHash(playerScriptHash());
      const contract = normHash(app.chain.contractAddress.get());
      if (!key || !player || !contract || !/^\d+$/.test(gameId) || gameId === "0") return;
      try {
        app.storage.local.set(key, {
          gameId,
          kind,
          player,
          contract,
        });
      } catch {
        /* chain state remains authoritative */
      }
    };

    const loadRecovery = (): RecoveryRecord | null => {
      const key = recoveryKey();
      if (!key) return null;
      const record = app.storage.local.get<RecoveryRecord | null>(key, null);
      if (!record || !/^\d+$/.test(String(record.gameId)) || record.gameId === "0") return null;
      const player = normHash(playerScriptHash());
      const contract = normHash(app.chain.contractAddress.get());
      if (
        record.player !== player ||
        record.contract !== contract ||
        !["bind", "settle", "expire"].includes(record.kind)
      ) return null;
      return record;
    };

    const clearRecovery = (): void => {
      const key = recoveryKey();
      if (!key) return;
      try {
        app.storage.local.delete(key);
      } catch {
        /* nothing to clean */
      }
    };

    const buildIdentity = async (gameId: string, difficulty: number): Promise<TeeIdentity> => {
      const playerHash = playerScriptHash();
      const contractHash = app.chain.contractAddress.get();
      if (!playerHash) throw new Error(ctx.t("walletRequiredStatus"));
      if (!contractHash) throw new Error(ctx.t("contractUnavailableStatus"));
      const normalizedContract = normalizedContractHash();
      if (!normalizedContract) throw new Error(ctx.t("contractUnavailableStatus"));
      const detected = await app.chain.detectNetwork();
      return {
        appId,
        network: morpheusNetworkOf(detected),
        contractHash: normalizedContract,
        gameId,
        player: normHash(playerHash) ? `0x${normHash(playerHash)}` : playerHash,
        difficulty,
      };
    };

    const refreshBalances = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      try {
        poolFree.set(fromFixed8(parseBigInt(await app.chain.readRaw("freePool", []))));
      } catch {
        /* keep the previous value — reads are best-effort */
      }
      const playerHash = playerScriptHash();
      if (!playerHash) return;
      try {
        const raw = await app.chain.readRaw("creditOf", [
          app.chain.arg.hash160(playerHash),
        ]);
        credit.set(fromFixed8(parseBigInt(raw)));
      } catch {
        /* keep the previous value */
      }
    };

    const refreshStats = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      const playerHash = playerScriptHash();
      if (!playerHash) return;
      try {
        const stats = await app.chain.readRaw("statsOf", [
          app.chain.arg.hash160(playerHash),
        ]);
        mySolves.set(asNumber(mapField(stats, "solved")));
        myTotalWon.set(fromFixed8(parseBigInt(mapField(stats, "totalWon"))));
      } catch {
        /* stats stay stale */
      }
    };

    /**
     * Rebuild the global ranking from Solved events.
     */
    const loadLeaderboard = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      const playerHash = playerScriptHash();
      try {
        const events = await app.chain.events("Solved", {
          limit: LEADERBOARD_EVENT_LIMIT,
        });
        const bestByPlayer = new Map<string, { totalWon: number; solves: number; raw: unknown }>();
        const mine: SolveRow[] = [];
        for (const ev of events) {
          const who = normHash(eventStateValue(ev, 1));
          if (!who) continue;
          const totalWon = fromFixed8(parseBigInt(eventStateValue(ev, 6)));
          const prior = bestByPlayer.get(who);
          bestByPlayer.set(who, {
            totalWon: Math.max(prior?.totalWon ?? 0, totalWon),
            solves: (prior?.solves ?? 0) + 1,
            raw: eventStateValue(ev, 1),
          });
          if (playerHash && addrEq(eventStateValue(ev, 1), playerHash)) {
            mine.push({
              gameId: String(parseBigInt(eventStateValue(ev, 0)) ?? ""),
              difficulty: asNumber(eventStateValue(ev, 2)),
              elapsedMs: asNumber(eventStateValue(ev, 3)),
              undos: asNumber(eventStateValue(ev, 4)),
              payout: `${fromFixed8(parseBigInt(eventStateValue(ev, 5))).toFixed(2)} GAS`,
            });
          }
        }
        const ranked: LeaderEntry[] = [...bestByPlayer.entries()]
          .map(([address, entry]) => ({
            address,
            totalWon: entry.totalWon,
            solves: entry.solves,
            isUser: playerHash ? addrEq(entry.raw, playerHash) : false,
          }))
          .sort((a, b) => b.totalWon - a.totalWon)
          .map((entry, idx) => ({ rank: idx + 1, ...entry }));
        leaderboard.set(ranked);
        const me = ranked.find((entry) => entry.isUser);
        myRank.set(me ? me.rank : 0);
        myHistory.set(mine.reverse().slice(0, 12));
      } catch {
        /* indexer unreachable — the run stays playable without rankings */
      }
    };

    const markDeadlineFailure = (): void => {
      if (gameStatus.get() !== "dealt" || Date.now() < deadline.get()) return;
      isGameOver.set(true);
      failureReason.set("timeout");
      lastStatus.set(ctx.t("timeUpHint"));
    };

    const scheduleDeadlineFailure = (): void => {
      clearDeadlineTimer();
      const expiresAt = deadline.get();
      if (expiresAt <= 0 || gameStatus.get() !== "dealt") return;
      const delay = expiresAt - Date.now();
      if (delay <= 0) {
        markDeadlineFailure();
        return;
      }
      deadlineTimer = setTimeout(markDeadlineFailure, delay);
    };

    const gameMatchesPlayer = (game: unknown, gameId: string, difficulty?: number): boolean => {
      const playerHash = playerScriptHash();
      const idMatches = String(parseBigInt(mapField(game, "id")) ?? "0") === gameId;
      const playerMatches = Boolean(playerHash) && addrEq(mapField(game, "player"), playerHash);
      const difficultyMatches = difficulty === undefined ||
        asNumber(mapField(game, "difficulty")) === difficulty;
      return idMatches && playerMatches && difficultyMatches;
    };

    const applyGameSnapshot = (game: unknown): void => {
      const status = statusOf(asNumber(mapField(game, "status")));
      gameStatus.set(status);
      gameDifficulty.set(asNumber(mapField(game, "difficulty")));
      commitment.set(String(mapField(game, "commitment") ?? ""));
      startedAt.set(asNumber(mapField(game, "startTime")));
      dealtAt.set(asNumber(mapField(game, "dealtAt")));
      deadline.set(asNumber(mapField(game, "deadline")));
      undosUsed.set(asNumber(mapField(game, "undos") ?? 0));
      isGameOver.set(false);
      failureReason.set("none");
      if (status === "dealt") scheduleDeadlineFailure();
      else clearDeadlineTimer();
    };

    const sendOp = async (op: TeeOp): Promise<Awaited<ReturnType<typeof teeMove>>> => {
      if (!session) throw new Error(ctx.t("statusFailed"));
      const gameId = session.identity.gameId;
      const ops = loadOps(gameId);
      let result: Awaited<ReturnType<typeof teeMove>>;
      try {
        result = await teeMove(session.identity, session.sessionToken, ops.length, op, undefined);
      } catch {
        // Session cache miss (worker restarted) — retry once with the full
        // op log so the enclave can rebuild the session deterministically.
        result = await teeMove(session.identity, session.sessionToken, ops.length, op, ops);
      }
      if (!result.ok) throw new Error(ctx.t("statusInputSyncFailed"));
      ops.push(op);
      saveOps(gameId, ops);
      return result;
    };

    /**
     * Seal-and-bind flow: the enclave generates the card layout, returns the
     * visible CardView[] + commitment, and the commitment hash is bound on-chain.
     */
    const sealAndBind = async (gameId: string, difficulty: number): Promise<boolean> => {
      isDealing.set(true);
      lastStatus.set(ctx.t("statusSealing"));
      saveRecovery(gameId, "bind");
      try {
        const identity = await buildIdentity(gameId, difficulty);
        const started = await teeStart(identity);
        session = { ...started, identity };
        const visible = started.cards.filter((c) => !c.picked);
        pileCards.set(visible);
        slotCards.set(started.slots ?? []);
        isGameOver.set(false);
        failureReason.set("none");
        shuffleLeft.set(started.shuffleLeft);
        remove3Left.set(started.remove3Left);
        commitment.set(started.commitment);
        await app.chain.invoke(
          "bindPuzzle",
          [
            app.chain.arg.integer(gameId),
            app.chain.arg.string(started.commitment),
            app.chain.arg.string(started.bindSignature),
          ],
          { waitForEvent: "PuzzleBound", waitTimeoutMs: 30_000 },
        );
        // The event is only a wait hint. The exact game snapshot is the
        // authority before any cards or deadline are treated as live.
        const game = await app.chain.readRaw("getGame", [
          app.chain.arg.integer(gameId),
        ]);
        if (
          !gameMatchesPlayer(game, gameId, difficulty) ||
          asNumber(mapField(game, "status")) !== 1 ||
          cleanHex(mapField(game, "commitment")) !== cleanHex(started.commitment)
        ) {
          throw new Error(ctx.t("statusSessionMismatch"));
        }
        applyGameSnapshot(game);
        undosUsed.set(0);
        scheduleDeadlineFailure();
        clearRecovery();
        lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        try {
          const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
          const rawStatus = asNumber(mapField(game, "status"));
          if (
            gameMatchesPlayer(game, gameId, difficulty) &&
            rawStatus === 1 &&
            cleanHex(mapField(game, "commitment")) === cleanHex(commitment.get())
          ) {
            applyGameSnapshot(game);
            clearRecovery();
            lastStatus.set(ctx.t("statusRecovered"));
            return true;
          }
          if (gameMatchesPlayer(game, gameId, difficulty) && rawStatus === 0) {
            applyGameSnapshot(game);
            lastStatus.set(ctx.t("statusDealPending"));
            return false;
          }
        } catch {
          /* leave the exact game id recoverable */
        }
        const message = app.errors.messageOf(error, ctx.t("statusFailed"));
        gameStatus.set("unknown");
        lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(message, "error");
        return false;
      } finally {
        isDealing.set(false);
      }
    };

    /** Reattach to a bound game after a reload. */
    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const identity = await buildIdentity(gameId, difficulty);
        const started = await teeStart(identity);
        if (commitment.get() && cleanHex(started.commitment) !== cleanHex(commitment.get())) {
          throw new Error(ctx.t("statusFailed"));
        }
        if (loadOps(gameId).length > 0 && !started.slots) {
          throw new Error(ctx.t("statusRecoveryUnavailable"));
        }
        session = { ...started, identity };
        const visible = started.cards.filter((c) => !c.picked);
        pileCards.set(visible);
        slotCards.set(started.slots ?? []);
        shuffleLeft.set(started.shuffleLeft);
        remove3Left.set(started.remove3Left);
        commitment.set(started.commitment);
        scheduleDeadlineFailure();
      } catch {
        session = null;
        lastStatus.set(ctx.t("statusDealPending"));
      }
    };

    const finishFromSnapshot = async (gameId: string, game: unknown, announce = true): Promise<void> => {
      if (!gameMatchesPlayer(game, gameId)) throw new Error(ctx.t("statusSessionMismatch"));
      const status = statusOf(asNumber(mapField(game, "status")));
      if (status === "committed" || status === "dealt") {
        throw new Error(ctx.t("statusSettlementPending"));
      }

      clearDeadlineTimer();
      clearMatchTimer();
      session = null;
      activeGameId.set("0");
      gameDifficulty.set(asNumber(mapField(game, "difficulty")));
      gameStatus.set(status);
      commitment.set(String(mapField(game, "commitment") ?? ""));
      startedAt.set(asNumber(mapField(game, "startTime")));
      dealtAt.set(asNumber(mapField(game, "dealtAt")));
      deadline.set(asNumber(mapField(game, "deadline")));
      undosUsed.set(asNumber(mapField(game, "undos")));
      isGameOver.set(false);
      failureReason.set("none");
      pileCards.set([]);
      slotCards.set([]);
      forgetOps(gameId);
      clearRecovery();

      if (status === "solved") {
        const payout = fromFixed8(parseBigInt(mapField(game, "payout")));
        lastPayout.set(`${payout.toFixed(2)} GAS`);
        lastElapsedMs.set(asNumber(mapField(game, "solveMs")));
        lastStatus.set(ctx.t("statusSolved", { payout: payout.toFixed(2) }));
        if (announce) ctx.setStatus(lastStatus.get(), "success");
      } else {
        lastPayout.set("");
        lastStatus.set(ctx.t("statusExpired"));
        if (announce) ctx.setStatus(ctx.t("statusExpired"), "info");
      }
      await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
    };

    const recoverCurrentGame = async (
      preferredGameId?: string,
      announce = true,
      allowBind = false,
    ): Promise<boolean> => {
      if (app.mode.isGuest() || isRecovering.get()) return false;
      const playerHash = playerScriptHash();
      if (!playerHash) return false;
      isRecovering.set(true);
      try {
        let gameId = preferredGameId && preferredGameId !== "0"
          ? preferredGameId
          : loadRecovery()?.gameId ?? activeGameId.get();
        if (!gameId || gameId === "0") {
          gameId = String(parseBigInt(await app.chain.readRaw("activeGameOf", [
            app.chain.arg.hash160(playerHash),
          ])) ?? "0");
        }
        if (!gameId || gameId === "0") return false;

        const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
        if (!gameMatchesPlayer(game, gameId)) throw new Error(ctx.t("statusSessionMismatch"));
        activeGameId.set(gameId);
        applyGameSnapshot(game);
        const rawStatus = asNumber(mapField(game, "status"));

        if (rawStatus === 0) {
          lastStatus.set(ctx.t("statusDealPending"));
          if (canExpireCurrentGame()) {
            if (announce) ctx.setStatus(ctx.t("releaseReady"), "info");
            return true;
          }
          if (!allowBind) {
            if (announce) ctx.setStatus(ctx.t("statusDealPending"), "info");
            return true;
          }
          const rebound = await sealAndBind(gameId, gameDifficulty.get());
          if (rebound && announce) ctx.setStatus(ctx.t("statusRecovered"), "success");
          return rebound;
        }
        if (rawStatus === 1) {
          await resumeSession(gameId, gameDifficulty.get());
          if (!session) {
            gameStatus.set("unknown");
            if (announce) ctx.setStatus(ctx.t("statusRecoveryUnavailable"), "error");
            return false;
          }
          clearRecovery();
          if (announce) ctx.setStatus(ctx.t("statusRecovered"), "success");
          return true;
        }
        if (rawStatus >= 2 && rawStatus <= 4) {
          await finishFromSnapshot(gameId, game, announce);
          return true;
        }

        gameStatus.set("unknown");
        lastStatus.set(ctx.t("statusSettlementPending"));
        return true;
      } catch (error) {
        gameStatus.set("unknown");
        lastStatus.set(ctx.t("statusSettlementPending"));
        if (announce) {
          ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        }
        return false;
      } finally {
        isRecovering.set(false);
      }
    };

    const canExpireCurrentGame = (): boolean => {
      const now = Date.now();
      if (gameStatus.get() === "dealt") {
        return deadline.get() > 0 && now > deadline.get() + SETTLE_GRACE_MS;
      }
      if (gameStatus.get() === "committed") {
        return startedAt.get() > 0 && now > startedAt.get() + DEAL_TTL_MS;
      }
      return false;
    };

    ctx.framework.actions.register("startGame", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      if (app.mode.isGuest()) { guest.startGame(Number(form.difficulty ?? 0)); return; }
      if (!NEW_PAID_RUNS_ENABLED || manifest.supportsGameFi === false) {
        ctx.setStatus(ctx.t("paidRunsUnavailable"), "info");
        return;
      }
      if (isStarting.get() || isDealing.get() || isRecovering.get()) return;
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      const rule = ruleOf(difficulty);
      return withFinancialLock(async () => {
        isStarting.set(true);
        lastStatus.set(ctx.t("statusStarting"));
        let startedGameId = "0";
        try {
          const player = await app.chain.ensureWallet();
          const playerHash = addressToScriptHash(player);
          if (!playerHash) throw new Error(ctx.t("walletRequiredStatus"));
          await refreshBalances();
          if (poolFree.get() < fromFixed8(rule.rewardFixed8)) {
            throw new Error(ctx.t("statusPoolLow"));
          }
          const invokeArgs = [
            app.chain.arg.hash160(playerHash),
            app.chain.arg.integer(difficulty),
          ];
          const options = { waitForEvent: "GameStarted", waitTimeoutMs: 30_000 };
          const creditFixed8 = BigInt(Math.round(credit.get() * 1e8));
          const result = creditFixed8 >= rule.entryFixed8
            ? await app.chain.invoke("startGame", invokeArgs, options)
            : await app.chain.invokeWithPayment(
                rule.entryFixed8.toString(),
                ENTRY_MEMO,
                "startGame",
                invokeArgs,
                options,
              );
          const eventMatches = result.event != null &&
            addrEq(eventStateValue(result.event, 1), playerHash) &&
            asNumber(eventStateValue(result.event, 2)) === difficulty;
          let gameId = eventMatches
            ? String(parseBigInt(eventStateValue(result.event, 0)) ?? "0")
            : "0";
          if (gameId === "0") {
            gameId = String(parseBigInt(await app.chain.readRaw("activeGameOf", [
              app.chain.arg.hash160(playerHash),
            ])) ?? "0");
          }
          if (!gameId || gameId === "0") throw new Error(ctx.t("startGameUnavailableStatus"));
          startedGameId = gameId;
          const snapshot = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
          if (
            !gameMatchesPlayer(snapshot, gameId, difficulty) ||
            asNumber(mapField(snapshot, "status")) !== 0
          ) throw new Error(ctx.t("statusSessionMismatch"));

          activeGameId.set(gameId);
          gameDifficulty.set(difficulty);
          undosUsed.set(0);
          commitment.set("");
          startedAt.set(asNumber(mapField(snapshot, "startTime")));
          dealtAt.set(0);
          deadline.set(0);
          pileCards.set([]);
          slotCards.set([]);
          isGameOver.set(false);
          failureReason.set("none");
          shuffleLeft.set(1);
          remove3Left.set(1);
          gameStatus.set("committed");
          lastStatus.set(ctx.t("statusStarted"));
          await refreshBalances();
          await sealAndBind(gameId, difficulty);
          return result;
        } catch (error) {
          const recovered = await recoverCurrentGame(startedGameId, false, true);
          if (recovered) {
            ctx.setStatus(ctx.t("statusRecovered"), "info");
            return undefined;
          }
          const message = app.errors.messageOf(error, ctx.t("statusFailed"));
          lastStatus.set(message);
          ctx.setStatus(message, "error");
          return undefined;
        } finally {
          isStarting.set(false);
        }
      });
    });

    ctx.framework.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) return;
      const gameId = activeGameId.get();
      if (gameId === "0" || isDealing.get() || gameStatus.get() !== "committed") return;
      await withFinancialLock(() => sealAndBind(gameId, gameDifficulty.get()));
    });

    // Pick a card from the pile into the slot bar.
    ctx.framework.actions.register("pickCard", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { cardId?: unknown };
      const cardId = Number(form.cardId);
      if (!Number.isInteger(cardId) || cardId < 0) return;
      if (app.mode.isGuest()) { guest.pickCard(cardId); return; }
      if (
        !session ||
        gameStatus.get() !== "dealt" ||
        isPicking.get() ||
        isGameOver.get() ||
        (deadline.get() > 0 && Date.now() >= deadline.get())
      ) return;
      const currentSlots = slotCards.get();
      if (currentSlots.length >= 7) return; // slots full
      await withTeeLock(async () => {
        isPicking.set(true);
        try {
          const result = await sendOp({ type: "pick", cardId });
          pileCards.set(result.cards.filter((c) => !c.picked));
          slotCards.set(result.slots);

          if (result.matched) {
            isMatching.set(true);
            clearMatchTimer();
            matchTimer = setTimeout(() => {
              isMatching.set(false);
              matchTimer = null;
            }, 600);
          }

          if (result.won) {
            clearDeadlineTimer();
            isGameOver.set(false);
            failureReason.set("none");
            gameStatus.set("solved");
            lastStatus.set(ctx.t("statusWonTitle"));
            ctx.setStatus(ctx.t("statusWonTitle"), "success");
          } else if (result.gameOver) {
            isGameOver.set(true);
            failureReason.set("tray");
            lastStatus.set(ctx.t("gameOverBanner"));
          }

          shuffleLeft.set(result.shuffleLeft);
          remove3Left.set(result.remove3Left);
        } catch (error) {
          const message = app.errors.messageOf(error, ctx.t("statusFailed"));
          ctx.setStatus(message, "error");
        } finally {
          isPicking.set(false);
        }
      });
    });

    // Paid undo: recorded in the TEE session (no transaction).
    ctx.framework.actions.register("useUndo", async () => {
      if (app.mode.isGuest()) { guest.useUndo(); return; }
      const gameId = activeGameId.get();
      if (
        gameId === "0" ||
        isUndoing.get() ||
        gameStatus.get() !== "dealt" ||
        (deadline.get() > 0 && Date.now() >= deadline.get())
      ) return;
      const currentSlots = slotCards.get();
      if (currentSlots.length === 0) return;
      await withTeeLock(async () => {
        isUndoing.set(true);
        try {
          const result = await sendOp({ type: "undo" });
          pileCards.set(result.cards.filter((c) => !c.picked));
          slotCards.set(result.slots);
          isGameOver.set(result.gameOver);
          failureReason.set(result.gameOver ? "tray" : "none");
          const undos = undosUsed.get() + 1;
          undosUsed.set(undos);
          shuffleLeft.set(result.shuffleLeft);
          remove3Left.set(result.remove3Left);
          lastStatus.set(ctx.t("statusUndoUsed", { pct: String(100 - 30 * undos) }));
          ctx.setStatus(lastStatus.get(), "info");
        } catch (error) {
          const message = app.errors.messageOf(error, ctx.t("statusFailed"));
          ctx.setStatus(message, "error");
        } finally {
          isUndoing.set(false);
        }
      });
    });

    // Shuffle: return slot cards back to the pile.
    ctx.framework.actions.register("useShuffle", async () => {
      if (app.mode.isGuest()) { guest.useShuffle(); return; }
      const gameId = activeGameId.get();
      if (
        gameId === "0" ||
        gameStatus.get() !== "dealt" ||
        shuffleLeft.get() <= 0 ||
        (deadline.get() > 0 && Date.now() >= deadline.get())
      ) return;
      const currentSlots = slotCards.get();
      if (currentSlots.length === 0) return;
      await withTeeLock(async () => {
        try {
          const result = await sendOp({ type: "shuffle" });
          pileCards.set(result.cards.filter((c) => !c.picked));
          slotCards.set(result.slots);
          isGameOver.set(result.gameOver);
          failureReason.set(result.gameOver ? "tray" : "none");
          shuffleLeft.set(result.shuffleLeft);
          remove3Left.set(result.remove3Left);
          ctx.setStatus(ctx.t("shuffleAction", { left: result.shuffleLeft }), "info");
        } catch (error) {
          const message = app.errors.messageOf(error, ctx.t("statusFailed"));
          ctx.setStatus(message, "error");
        }
      });
    });

    // Paid Remove 3: discard the first three tray cards in the authoritative TEE state.
    ctx.framework.actions.register("useRemove3", async () => {
      if (app.mode.isGuest()) { guest.useRemove3(); return; }
      const gameId = activeGameId.get();
      if (
        gameId === "0" ||
        gameStatus.get() !== "dealt" ||
        remove3Left.get() <= 0 ||
        (deadline.get() > 0 && Date.now() >= deadline.get())
      ) return;
      const currentSlots = slotCards.get();
      if (currentSlots.length < 3) return;
      await withTeeLock(async () => {
        try {
          const result = await sendOp({ type: "remove3" });
          pileCards.set(result.cards.filter((c) => !c.picked));
          slotCards.set(result.slots);
          isGameOver.set(result.gameOver);
          failureReason.set(result.gameOver ? "tray" : "none");
          shuffleLeft.set(result.shuffleLeft);
          remove3Left.set(result.remove3Left);
          ctx.setStatus(ctx.t("remove3Action", { left: result.remove3Left }), "info");
        } catch (error) {
          const message = app.errors.messageOf(error, ctx.t("statusFailed"));
          ctx.setStatus(message, "error");
        }
      });
    });

    ctx.framework.actions.register("submitRun", async () => {
      if (app.mode.isGuest()) { await guest.submitRun(); return; }
      const gameId = activeGameId.get();
      const status = gameStatus.get();
      if (
        gameId === "0" ||
        isSubmitting.get() ||
        isTeeBusy.get() ||
        (status !== "dealt" && status !== "solved" && status !== "unknown")
      ) return;
      return withFinancialLock(async () => {
        isSubmitting.set(true);
        lastStatus.set(ctx.t("statusSubmitting"));
        saveRecovery(gameId, "settle");
        try {
          if (status === "unknown") {
            await recoverCurrentGame(gameId, true);
            return undefined;
          }
          if (!session) await resumeSession(gameId, gameDifficulty.get());
          if (!session) throw new Error(ctx.t("statusRecoveryUnavailable"));
          const settlement = await teeFinalize(
            session.identity,
            session.sessionToken,
            loadOps(gameId),
          );
          const result = await app.chain.invoke(
            "settleVerified",
            [
              app.chain.arg.integer(gameId),
              app.chain.arg.string(settlement.problemHash),
              app.chain.arg.string(settlement.answerHash),
              app.chain.arg.integer(settlement.elapsedMs),
              app.chain.arg.integer(settlement.undos),
              app.chain.arg.string(settlement.settleSignature),
            ],
            { waitForEvent: "Solved", waitTimeoutMs: 45_000 },
          );
          const exactEvent = result.event != null &&
            String(parseBigInt(eventStateValue(result.event, 0)) ?? "0") === gameId &&
            addrEq(eventStateValue(result.event, 1), playerScriptHash()) &&
            asNumber(eventStateValue(result.event, 2)) === gameDifficulty.get();
          const snapshot = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
          if (
            !exactEvent ||
            !gameMatchesPlayer(snapshot, gameId, gameDifficulty.get()) ||
            asNumber(mapField(snapshot, "status")) !== 2
          ) throw new Error(ctx.t("statusSettlementPending"));
          await finishFromSnapshot(gameId, snapshot, true);
          return result;
        } catch (error) {
          session = null;
          const recovered = await recoverCurrentGame(gameId, false);
          if (!recovered || activeGameId.get() !== "0") {
            gameStatus.set("unknown");
            lastStatus.set(ctx.t("statusSettlementPending"));
            ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          }
          if (!recovered && error instanceof Error) {
            ctx.setStatus(error.message, "error");
          }
          return undefined;
        } finally {
          isSubmitting.set(false);
        }
      });
    });

    ctx.framework.actions.register("returnToLobby", async () => {
      if (app.mode.isGuest()) { guest.returnToLobby(); return; }
      if (isSubmitting.get() || isDealing.get() || isStarting.get() || isRecovering.get()) return;
      const gameId = activeGameId.get();
      // Never discard the exact id/op-log of an unfinished or uncertain paid
      // game. Terminal snapshots clear activeGameId before this action is used.
      if (gameId !== "0") return;
      activeGameId.set("0");
      gameStatus.set("idle");
      session = null;
      clearDeadlineTimer();
      clearMatchTimer();
      if (gameId !== "0") forgetOps(gameId);
      pileCards.set([]);
      slotCards.set([]);
      startedAt.set(0);
      dealtAt.set(0);
      deadline.set(0);
      isGameOver.set(false);
      failureReason.set("none");
      lastStatus.set(ctx.t("statusReady"));
    });

    ctx.framework.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      const gameId = activeGameId.get();
      if (gameId === "0" || isRecovering.get() || !canExpireCurrentGame()) {
        if (gameId !== "0") ctx.setStatus(ctx.t("releaseNotReady"), "info");
        return;
      }
      await withFinancialLock(async () => {
        saveRecovery(gameId, "expire");
        try {
          await app.chain.invoke(
            "expireGame",
            [app.chain.arg.integer(gameId)],
            { waitForEvent: gameStatus.get() === "committed" ? "GameRefunded" : "GameExpired" },
          );
          const snapshot = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
          const rawStatus = asNumber(mapField(snapshot, "status"));
          if (!gameMatchesPlayer(snapshot, gameId) || (rawStatus !== 3 && rawStatus !== 4)) {
            throw new Error(ctx.t("statusSettlementPending"));
          }
          await finishFromSnapshot(gameId, snapshot, true);
        } catch (error) {
          const recovered = await recoverCurrentGame(gameId, false);
          if (!recovered || activeGameId.get() !== "0") {
            gameStatus.set("unknown");
            lastStatus.set(ctx.t("statusSettlementPending"));
            ctx.setStatus(
              app.errors.messageOf(error, ctx.t("statusSettlementPending")),
              "error",
            );
          }
        }
      });
    });

    ctx.framework.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      const playerHash = playerScriptHash();
      if (!playerHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      if (credit.get() <= 0) {
        ctx.setStatus(ctx.t("noCreditToWithdraw"), "info");
        return;
      }
      await withFinancialLock(async () => {
        const before = credit.get();
        try {
          await app.chain.ensureWallet();
          const result = await app.chain.invoke(
            "withdraw",
            [app.chain.arg.hash160(playerHash)],
            { waitForEvent: "CreditWithdrawn" },
          );
          const exactEvent = result.event != null &&
            addrEq(eventStateValue(result.event, 0), playerHash) &&
            parseBigInt(eventStateValue(result.event, 1)) > 0n;
          await refreshBalances();
          if (!exactEvent || credit.get() !== 0) throw new Error(ctx.t("withdrawPending"));
          ctx.setStatus(ctx.t("creditWithdrawn"), "success");
        } catch (error) {
          await refreshBalances();
          if (before > 0 && credit.get() === 0) {
            ctx.setStatus(ctx.t("creditWithdrawn"), "success");
            return;
          }
          ctx.setStatus(app.errors.messageOf(error, ctx.t("withdrawPending")), "error");
        }
      });
    });

    ctx.framework.actions.register("recoverGame", async () => {
      if (app.mode.isGuest()) return;
      await withFinancialLock(() => recoverCurrentGame(undefined, true, true));
    });

    ctx.framework.actions.register("refreshLeaderboard", async () => {
      if (app.mode.isGuest()) { await guest.refreshLeaderboard(); return; }
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    return {
      state: {
        credit,
        poolFree,
        activeGameId,
        gameStatus,
        gameDifficulty,
        commitment,
        startedAt,
        dealtAt,
        deadline,
        undosUsed,
        pileCards,
        slotCards,
        isMatching,
        isGameOver,
        failureReason,
        shuffleLeft,
        remove3Left,
        isPicking,
        lastPayout,
        lastElapsedMs,
        leaderboard,
        myRank,
        myTotalWon,
        mySolves,
        myHistory,
        isStarting,
        isDealing,
        isSubmitting,
        isUndoing,
        isTeeBusy,
        isRecovering,
        isFinancialAction,
        newPaidRunsEnabled,
        lastStatus,
        appMode,
      },
      loadData: async () => {
        if (app.mode.isGuest()) { await guest.enter(); return; }
        await refreshBalances();
        await recoverCurrentGame(loadRecovery()?.gameId, false);
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (gameStatus.get() === "idle") {
          lastStatus.set(ctx.t("statusReady"));
        }
      },
      cleanup: () => {
        stopModeSync();
        guest.dispose();
        clearDeadlineTimer();
        clearMatchTimer();
      },
    };
  },
});

export { gasDisplay };

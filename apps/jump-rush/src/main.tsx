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
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { ENTRY_MEMO, MAX_UNDOS, ruleOf, statusOf, gasDisplay } from "./logic/game-rules";
import { morpheusNetworkOf, teeFinalize, teeMove, teeStart } from "./logic/tee-session";
import type { TeeIdentity, TeeOp, TeeStartResult } from "./logic/tee-session";
import { createGuestEngine } from "./logic/guest-engine";

const appId = "miniapp-jump-rush";

const LEADERBOARD_EVENT_LIMIT = 200;

function asNumber(value: unknown): number {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
}

export interface LeaderEntry {
  rank: number;
  address: string;
  totalWon: number;
  runs: number;
  isUser: boolean;
}

export interface RunRow {
  gameId: string;
  difficulty: number;
  elapsedMs: number;
  undos: number;
  jumps: number;
  perfects: number;
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
    const credit = createObservable(0);
    const poolFree = createObservable(0);
    const activeGameId = createObservable("0");
    const gameStatus = createObservable("idle");
    const gameDifficulty = createObservable(0);
    const platformsView = createObservable<number[]>([]);
    const commitment = createObservable("");
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
    const undosUsed = createObservable(0);
    const lastPayout = createObservable("");
    const lastElapsedMs = createObservable(0);
    const leaderboard = createObservable<LeaderEntry[]>([]);
    const myRank = createObservable(0);
    const myTotalWon = createObservable(0);
    const myRuns = createObservable(0);
    const myHistory = createObservable<RunRow[]>([]);
    const isStarting = createObservable(false);
    const isDealing = createObservable(false);
    const isSubmitting = createObservable(false);
    const isUndoing = createObservable(false);
    const lastStatus = createObservable(ctx.t("statusReady"));

    // Jump Rush specific observables
    const currentPlatform = createObservable(0);
    const jumpCount = createObservable(0);
    const perfectCount = createObservable(0);
    const comboCount = createObservable(0);
    const chargeLevel = createObservable(0);
    const isCharging = createObservable(false);
    const isJumping = createObservable(false);
    const missedPlatform = createObservable(false);

    // Current play mode, mirrored into an observable the PlayArea reads so the
    // GAS-centric copy can switch to local/practice framing in guest mode. Kept
    // in sync with the launcher-selected framework mode via app.mode.onChange.
    const appMode = createObservable(app.mode.get());

    // TEE session context for the active game (rebuilt idempotently from the
    // deterministic teeStart, so nothing here needs durable storage).
    let session: (TeeStartResult & { identity: TeeIdentity }) | null = null;

    // Per-game TEE op log through the framework's namespaced local KV instead
    // of raw window.localStorage (best-effort telemetry + undo accounting).
    const opsKey = (gameId: string): string => `ops/${gameId}`;

    const loadOps = (gameId: string): TeeOp[] => {
      const parsed = app.storage.local.get<TeeOp[]>(opsKey(gameId), []);
      return Array.isArray(parsed) ? parsed : [];
    };

    const saveOps = (gameId: string, ops: TeeOp[]): void => {
      try {
        app.storage.local.set(opsKey(gameId), ops);
      } catch {
        /* telemetry log is best-effort */
      }
    };

    const forgetOps = (gameId: string): void => {
      try {
        app.storage.local.delete(opsKey(gameId));
      } catch {
        /* nothing to clean */
      }
    };

    const playerScriptHash = (): string => {
      const player = app.chain.address.get();
      return player ? addressToScriptHash(player) : "";
    };

    const buildIdentity = async (gameId: string, difficulty: number): Promise<TeeIdentity> => {
      const playerHash = playerScriptHash();
      const contractHash = app.chain.contractAddress.get();
      if (!playerHash || !contractHash) throw new Error(ctx.t("statusFailed"));
      let detected = "";
      try {
        detected = await app.chain.detectNetwork();
      } catch {
        detected = "testnet";
      }
      return {
        appId,
        network: morpheusNetworkOf(detected),
        contractHash: normHash(contractHash) ? `0x${normHash(contractHash)}` : contractHash,
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
        myRuns.set(asNumber(mapField(stats, "runs")));
        myTotalWon.set(fromFixed8(parseBigInt(mapField(stats, "totalWon"))));
      } catch {
        /* stats stay stale */
      }
    };

    /**
     * Rebuild the global ranking from Solved events. The event's totalWon slot
     * carries the player's CUMULATIVE winnings at solve time, so taking the
     * MAX per player is order-independent (robust to indexer sort direction).
     */
    const loadLeaderboard = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      const playerHash = playerScriptHash();
      try {
        const events = await app.chain.events("Solved", {
          limit: LEADERBOARD_EVENT_LIMIT,
        });
        const bestByPlayer = new Map<string, { totalWon: number; runs: number; raw: unknown }>();
        const mine: RunRow[] = [];
        for (const ev of events) {
          const who = normHash(eventStateValue(ev, 1));
          if (!who) continue;
          const totalWon = fromFixed8(parseBigInt(eventStateValue(ev, 6)));
          const prior = bestByPlayer.get(who);
          bestByPlayer.set(who, {
            totalWon: Math.max(prior?.totalWon ?? 0, totalWon),
            runs: (prior?.runs ?? 0) + 1,
            raw: eventStateValue(ev, 1),
          });
          if (playerHash && addrEq(eventStateValue(ev, 1), playerHash)) {
            mine.push({
              gameId: String(parseBigInt(eventStateValue(ev, 0)) ?? ""),
              difficulty: asNumber(eventStateValue(ev, 2)),
              elapsedMs: asNumber(eventStateValue(ev, 3)),
              undos: asNumber(eventStateValue(ev, 4)),
              jumps: asNumber(eventStateValue(ev, 7)),
              perfects: asNumber(eventStateValue(ev, 8)),
              payout: `${fromFixed8(parseBigInt(eventStateValue(ev, 5))).toFixed(2)} GAS`,
            });
          }
        }
        const ranked: LeaderEntry[] = [...bestByPlayer.entries()]
          .map(([address, entry]) => ({
            address,
            totalWon: entry.totalWon,
            runs: entry.runs,
            isUser: playerHash ? addrEq(entry.raw, playerHash) : false,
          }))
          .sort((a, b) => b.totalWon - a.totalWon)
          .map((entry, idx) => ({ rank: idx + 1, ...entry }));
        leaderboard.set(ranked);
        const me = ranked.find((entry) => entry.isUser);
        myRank.set(me ? me.rank : 0);
        myHistory.set(mine.reverse().slice(0, 12));
      } catch {
        /* indexer unreachable — the board stays playable without rankings */
      }
    };

    const applyGameSnapshot = (game: unknown): void => {
      const status = statusOf(asNumber(mapField(game, "status")));
      gameStatus.set(status);
      gameDifficulty.set(asNumber(mapField(game, "difficulty")));
      commitment.set(String(mapField(game, "commitment") ?? ""));
      dealtAt.set(asNumber(mapField(game, "dealtAt")));
      deadline.set(asNumber(mapField(game, "deadline")));
      undosUsed.set(asNumber(mapField(game, "undos") ?? 0));
    };

    /**
     * Seal-and-bind flow: ask the TEE to generate the platform layout (the
     * jump sequence never leaves the enclave), then bind its hash commitment
     * on-chain. The TEE start is deterministic per game, so retries and reloads
     * converge on the same layout.
     */
    const sealAndBind = async (gameId: string, difficulty: number): Promise<boolean> => {
      isDealing.set(true);
      lastStatus.set(ctx.t("statusSealing"));
      try {
        const identity = await buildIdentity(gameId, difficulty);
        const started = await teeStart(identity);
        session = { ...started, identity };
        platformsView.set(started.view.platforms);
        commitment.set(started.commitment);
        const result = await app.chain.invoke(
          "bindPuzzle",
          [
            app.chain.arg.integer(gameId),
            app.chain.arg.string(started.commitment),
            app.chain.arg.string(started.bindSignature),
          ],
          { waitForEvent: "PuzzleBound", waitTimeoutMs: 30_000 },
        );
        if (result.event != null) {
          dealtAt.set(asNumber(eventStateValue(result.event, 3)));
          deadline.set(asNumber(eventStateValue(result.event, 4)));
        } else {
          const game = await app.chain.readRaw("getGame", [
            app.chain.arg.integer(gameId),
          ]);
          applyGameSnapshot(game);
        }
        gameStatus.set("dealt");
        undosUsed.set(0);
        currentPlatform.set(0);
        jumpCount.set(0);
        perfectCount.set(0);
        comboCount.set(0);
        chargeLevel.set(0);
        isCharging.set(false);
        isJumping.set(false);
        missedPlatform.set(false);
        lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(message, "error");
        return false;
      } finally {
        isDealing.set(false);
      }
    };

    /** Reattach to a bound game after a reload: same TEE identity, same layout. */
    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const identity = await buildIdentity(gameId, difficulty);
        const started = await teeStart(identity);
        if (commitment.get() && started.commitment !== commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = { ...started, identity };
        platformsView.set(started.view.platforms);
        commitment.set(started.commitment);
      } catch {
        lastStatus.set(ctx.t("statusDealPending"));
      }
    };

    const sendOp = async (op: TeeOp): Promise<Record<string, unknown>> => {
      if (!session) throw new Error(ctx.t("statusFailed"));
      const gameId = session.identity.gameId;
      const ops = loadOps(gameId);
      const result = await teeMove(session.identity, session.sessionToken, ops.length, op, undefined);
      ops.push(op);
      saveOps(gameId, ops);
      return result;
    };

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local platform runner — no chain/oracle/reward calls.
    const guest = createGuestEngine({
      gameStatus,
      activeGameId,
      gameDifficulty,
      platformsView,
      commitment,
      dealtAt,
      deadline,
      undosUsed,
      lastPayout,
      lastElapsedMs,
      leaderboard,
      myRank,
      myTotalWon,
      myRuns,
      myHistory,
      isStarting,
      isDealing,
      isSubmitting,
      isUndoing,
      lastStatus,
      jumpCount,
      currentPlatform,
      perfectCount,
      comboCount,
      chargeLevel,
      isCharging,
      isJumping,
      missedPlatform,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the PlayArea's mode mirror in sync, and — when switching to guest at
    // the launcher — reset to a clean local lobby + load the off-chain board.
    app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") void guest.enter();
    });

    ctx.framework.actions.register("startGame", async (...args: unknown[]) => {
      if (app.mode.isGuest()) {
        const form = (args[0] ?? {}) as { difficulty?: unknown };
        guest.startGame(Number(form.difficulty ?? 0));
        return;
      }
      if (isStarting.get() || isDealing.get()) return;
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      const rule = ruleOf(difficulty);
      isStarting.set(true);
      lastStatus.set(ctx.t("statusStarting"));
      try {
        const player = await app.chain.ensureWallet();
        const playerHash = addressToScriptHash(player);
        if (!playerHash) throw new Error(ctx.t("statusFailed"));
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
        const result =
          creditFixed8 >= rule.entryFixed8
            ? await app.chain.invoke("startGame", invokeArgs, options)
            : await app.chain.invokeWithPayment(
                rule.entryFixed8.toString(),
                ENTRY_MEMO,
                "startGame",
                invokeArgs,
                options,
              );
        let gameId =
          result.event != null ? String(parseBigInt(eventStateValue(result.event, 0)) ?? "") : "";
        if (!gameId || gameId === "0") {
          gameId = String(
            parseBigInt(
              await app.chain.readRaw("activeGameOf", [
                app.chain.arg.hash160(playerHash),
              ]),
            ) ?? "0",
          );
        }
        if (!gameId || gameId === "0") throw new Error(ctx.t("statusFailed"));
        activeGameId.set(gameId);
        gameDifficulty.set(difficulty);
        undosUsed.set(0);
        platformsView.set([]);
        commitment.set("");
        dealtAt.set(0);
        deadline.set(0);
        gameStatus.set("committed");
        lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        void sealAndBind(gameId, difficulty);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isStarting.set(false);
      }
    });

    // Retry handle for a seal/bind that failed (TEE unreachable, tx rejected).
    ctx.framework.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = activeGameId.get();
      if (gameId === "0" || isDealing.get() || gameStatus.get() !== "committed") return;
      await sealAndBind(gameId, gameDifficulty.get());
    });

    // Record a jump in the TEE session for telemetry + undo accounting.
    ctx.framework.actions.register("recordJump", async (...args: unknown[]) => {
      if (app.mode.isGuest()) {
        const form = (args[0] ?? {}) as { platformIndex?: unknown };
        guest.recordJump(Number(form.platformIndex ?? 0));
        return;
      }
      const form = (args[0] ?? {}) as { chargeMs?: unknown };
      const chargeMs = Number(form.chargeMs);
      if (!Number.isInteger(chargeMs) || chargeMs < 0) return;
      try {
        await sendOp({ type: "jump", chargeMs });
      } catch {
        /* telemetry only */
      }
    });

    // Paid undo: recorded in the TEE session (no transaction).
    ctx.framework.actions.register("useUndo", async () => {
      if (app.mode.isGuest()) { guest.useUndo(); return; }
      const gameId = activeGameId.get();
      if (gameId === "0" || isUndoing.get() || gameStatus.get() !== "dealt") return;
      if (undosUsed.get() >= MAX_UNDOS) {
        ctx.setStatus(ctx.t("undoLimitReached"), "info");
        return;
      }
      isUndoing.set(true);
      try {
        await sendOp({ type: "undo" });
        const undos = undosUsed.get() + 1;
        undosUsed.set(undos);
        lastStatus.set(ctx.t("statusUndoUsed", { pct: String(100 - 30 * undos) }));
        ctx.setStatus(lastStatus.get(), "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isUndoing.set(false);
      }
    });

    ctx.framework.actions.register("submitRun", async () => {
      if (app.mode.isGuest()) { await guest.submitRun(); return; }
      const gameId = activeGameId.get();
      if (gameId === "0" || isSubmitting.get() || gameStatus.get() !== "dealt") return;
      isSubmitting.set(true);
      lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) {
          await resumeSession(gameId, gameDifficulty.get());
        }
        if (!session) throw new Error(ctx.t("statusFailed"));
        const settlement = await teeFinalize(session.identity, session.sessionToken);
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
        const payoutGas =
          result.event != null
            ? fromFixed8(parseBigInt(eventStateValue(result.event, 5)))
            : fromFixed8(0n);
        lastPayout.set(`${payoutGas.toFixed(2)} GAS`);
        lastElapsedMs.set(settlement.elapsedMs);
        gameStatus.set("solved");
        activeGameId.set("0");
        forgetOps(gameId);
        session = null;
        lastStatus.set(ctx.t("statusSolved", { payout: payoutGas.toFixed(2) }));
        ctx.setStatus(lastStatus.get(), "success");
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isSubmitting.set(false);
      }
    });

    // Permissionless housekeeping: release the reward reservation of a game
    // whose deadline passed (or refund an entry that was never bound).
    ctx.framework.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      const gameId = activeGameId.get();
      if (gameId === "0") return;
      try {
        await app.chain.invoke("expireGame", [app.chain.arg.integer(gameId)], {});
        gameStatus.set("expired");
        activeGameId.set("0");
        forgetOps(gameId);
        session = null;
        lastStatus.set(ctx.t("statusExpired"));
        ctx.setStatus(ctx.t("statusExpired"), "info");
        await refreshBalances();
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
        throw error;
      }
    });

    // Framework operation keeps notify.guard semantics: success toast only
    // after a real withdrawal, error toast + swallow on failure — while the
    // pre-check early returns stay silent.
    const withdrawOp = app.operations.create("withdrawWinnings");

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
      await withdrawOp.run(async () => {
        await app.chain.ensureWallet();
        await app.chain.invoke(
          "withdraw",
          [app.chain.arg.hash160(playerHash)],
          { waitForEvent: "CreditWithdrawn" },
        );
        await refreshBalances();
      }, { successKey: "creditWithdrawn" });
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
        platformsView,
        commitment,
        dealtAt,
        deadline,
        undosUsed,
        lastPayout,
        lastElapsedMs,
        leaderboard,
        myRank,
        myTotalWon,
        myRuns,
        myHistory,
        isStarting,
        isDealing,
        isSubmitting,
        isUndoing,
        lastStatus,
        // Jump Rush specific
        currentPlatform,
        jumpCount,
        perfectCount,
        comboCount,
        chargeLevel,
        isCharging,
        isJumping,
        missedPlatform,
        // Play mode mirror consumed by the PlayArea to pick local vs GAS copy.
        appMode,
      },
      loadData: async () => {
        // Guest is a local game: skip every chain read and load the off-chain
        // board instead, so no chain/oracle call is made in guest mode.
        if (app.mode.isGuest()) { await guest.enter(); return; }
        await refreshBalances();
        const playerHash = playerScriptHash();
        if (playerHash) {
          try {
            const active = String(
              parseBigInt(
                await app.chain.readRaw("activeGameOf", [
                  app.chain.arg.hash160(playerHash),
                ]),
              ) ?? "0",
            );
            if (active !== "0") {
              activeGameId.set(active);
              const game = await app.chain.readRaw("getGame", [
                app.chain.arg.integer(active),
              ]);
              applyGameSnapshot(game);
              if (gameStatus.get() === "committed") {
                void sealAndBind(active, gameDifficulty.get());
              } else if (gameStatus.get() === "dealt") {
                await resumeSession(active, gameDifficulty.get());
              }
            }
          } catch {
            /* no active game recoverable — start fresh */
          }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (gameStatus.get() === "idle") {
          lastStatus.set(ctx.t("statusReady"));
        }
      },
    };
  },
});

export { gasDisplay };

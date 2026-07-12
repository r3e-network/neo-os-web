/**
 * Color Clash — Simon Says memory game (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: sequence reveal-per-round, press recording, and solution finalization.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import { createGameCreditsLane } from "@shared/react/game-credits";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { eventStateValue } from "@shared/utils/chain-events";
import { eventHashMatches as addrEq, mapField, normalizedHash as normHash } from "@framework/gamefi";
import type { RewardGameSession, RewardGameSnapshot } from "@framework/gamefi";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  canReleaseExpiredGame,
  DIFFICULTY_RULES,
  ENTRY_MEMO,
  ruleOf,
  SETTLEMENT_GRACE_MS,
  statusOf,
} from "./logic/game-rules";
import { createGuestEngine } from "./logic/guest-engine";
import {
  hasColorDeadlinePassed,
  isColorIndex,
  requireColorSequence,
  type ColorUiPhase,
} from "./logic/color-engine";
import type { GameSessionStatus, LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-color-clash";
const ENGINE_HASH = "074ec7a8437bb8dbdb7c5aca5ccdad1c970e07f1cdbf06358b89638d90539013";
export const COLOR_CLASH_TESTNET_CONTRACT = "0xb2d0f46da6981e4613ce8476eadcc1ea26f9858f";
export const COLOR_CLASH_TESTNET_CHECKSUM = 2_935_733_434;
export const COLOR_CLASH_TESTNET_ORACLE = "0x4b882e94ed766807c4fd728768f972e13008ad52";

/**
 * Paid starts remain independently fail-closed. The public contract is live,
 * but its reward pool is empty and the current Morpheus color wrapper exposes
 * an empty start view instead of the first playable cue. Historical sessions
 * keep their recovery code below; a manifest edit alone can never reopen entry.
 */
export const NEW_PAID_RUNS_ENABLED = false;

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-color-clash:ops:";

type PressOp = { type: "press"; color: number };

function sessionStatusOf(raw: number): GameSessionStatus {
  const status = statusOf(raw);
  if (status === "awaiting-bind") return "committed";
  if (status === "playing") return "dealt";
  if (
    status === "committed" ||
    status === "dealt" ||
    status === "solved" ||
    status === "expired" ||
    status === "refunded" ||
    status === "unknown"
  ) {
    return status;
  }
  return "unknown";
}

// Color-clash SolveRow adds seqAchieved (unique to this game)
interface ColorClashRow extends SolveRow {
  seqAchieved: number;
}

// Color-clash LeaderEntry uses the standard structure; we re-export for PlayArea
export type { LeaderEntry };
export type { ColorClashRow as SolveRow };

const rewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo:  ENTRY_MEMO,
  modes: DIFFICULTY_RULES.map((rule) => ({
    id:           rule.difficulty,
    entryFixed8:  rule.entry,
    rewardFixed8: rule.reward,
    limitMs:      rule.limitMs,
    minSolveMs:   rule.minSolveMs,
    target:       rule.targetSeq,
  })),
  progression: { enabled: true },
};

// Slot layout for the Color-Clash Solved event. The contract does not emit a
// separate score slot; a positive payout proves the target for that difficulty
// was reached, so history derives the achieved cue count from the rule table.
// gameId(0) player(1) difficulty(2) elapsedMs(3) undos(4) payout(5) totalWon(6)
const SOLVED_SLOTS = {
  gameId: 0, player: 1, difficulty: 2, elapsedMs: 3,
  undos: 4, solvedPayout: 5, totalWon: 6,
};

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;

    // ── Reward-game runner ────────────────────────────────────────────────────
    const rewardGame = app.game.reward<PressOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    // ── Standard session observables ──────────────────────────────────────────
    const obs = app.game.session.observables<ColorClashRow>(ctx.t);

    // ── Color-clash specific observables ──────────────────────────────────────
    // Growing revealed prefix — built up from per-round `reveal` fields.
    const sequence       = createObservable("");
    const playerSequence = createObservable("");
    const seqAchieved    = createObservable(0);
    const roundNumber    = createObservable(0);
    const roundPhase     = createObservable<ColorUiPhase>("lobby");
    const selectedDifficulty = createObservable(0);
    const isPressing     = createObservable(false);
    const isRecovering   = createObservable(false);
    const settlementGraceMs = createObservable(SETTLEMENT_GRACE_MS);
    // lastPayout is a number (fixed8 bigint) in this game
    const lastPayoutFixed8 = createObservable<bigint>(0n);
    const appMode = createObservable<string>(app.mode.get());

    let session: RewardGameSession | null = null;
    let pressInFlight = false;

    // RFC P0-5: identity-diff account hook — fires only when the normalized
    // address actually changes (handler errors are isolated by the framework).
    // The previous-identity guard keeps the original "first connect is not a
    // change" semantics.
    const stopWalletSync = app.wallet.onAccountChanged(({ previous }) => {
      if (!previous || app.mode.isGuest()) return;
      session = null;
      pressInFlight = false;
      if (
        obs.activeGameId.get() !== "0"
        && ["committed", "dealt", "unknown"].includes(obs.gameStatus.get())
      ) {
        obs.gameStatus.set("unknown");
        obs.lastStatus.set("settlement-pending");
        ctx.setStatus(ctx.t("statusWalletChanged"), "warning");
      }
    });

    const applyVerifiedPress = (view: Record<string, unknown>, color: number): void => {
      const target = ruleOf(obs.gameDifficulty.get()).targetSeq;
      const best = Number(view.best);
      const invalidView = (): never => {
        session = null;
        obs.gameStatus.set("unknown");
        roundPhase.set("expired");
        obs.lastStatus.set("settlement-pending");
        throw new Error(ctx.t("invalidSessionPayload"));
      };
      if (!Number.isInteger(best) || best < 0 || best > target) invalidView();

      if (view.wrong === true) {
        if (view.correct === true) invalidView();
        seqAchieved.set(Math.max(seqAchieved.get(), best));
        roundPhase.set("wrong");
        obs.lastStatus.set("wrong");
        ctx.setStatus(ctx.t("wrongPress"), "error");
        return;
      }
      if (view.correct !== true) invalidView();

      let currentSequence: string;
      try {
        currentSequence = requireColorSequence(sequence.get(), sequence.get().length);
      } catch {
        return invalidView();
      }
      const nextPlayer = playerSequence.get() + String(color);
      const expected = Number(currentSequence[playerSequence.get().length]);
      if (
        !isColorIndex(expected)
        || expected !== color
        || nextPlayer.length > currentSequence.length
      ) invalidView();

      // The enclave sequence has headroom beyond the selected target. Once its
      // attested `best` reaches 8/12/16, ignore any look-ahead reveal and expose
      // settlement immediately instead of forcing an impossible 9th/13th/17th round.
      if (best >= target) {
        if (nextPlayer.length !== currentSequence.length) invalidView();
        playerSequence.set(nextPlayer);
        seqAchieved.set(target);
        roundNumber.set(target);
        roundPhase.set("complete");
        obs.lastStatus.set("all-correct");
        return;
      }

      const reveal = view.reveal;
      if (reveal !== undefined && reveal !== null) {
        const nextColor = Number(reveal);
        if (
          !isColorIndex(nextColor)
          || nextPlayer.length !== currentSequence.length
          || best !== currentSequence.length
          || Number(view.round) !== currentSequence.length + 1
        ) invalidView();
        const nextSequence = currentSequence + String(nextColor);
        sequence.set(nextSequence);
        playerSequence.set("");
        seqAchieved.set(best);
        roundNumber.set(nextSequence.length);
        roundPhase.set("watching");
        obs.lastStatus.set("watching");
        return;
      }

      if (nextPlayer.length >= currentSequence.length || best >= currentSequence.length) {
        invalidView();
      }
      playerSequence.set(nextPlayer);
      roundPhase.set("input");
      obs.lastStatus.set("repeat");
    };

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local Simon engine — no chain/oracle/reward calls.
    const guest = createGuestEngine({
      obs,
      sequence,
      playerSequence,
      seqAchieved,
      roundNumber,
      roundPhase,
      lastPayoutFixed8,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // ── Platform credits (Credits v2 reference integration) ──────────────────
    // HUD balance chip + fail-overlay "instant retry" offer + buy prompt.
    // Renders only in GameFi mode on hosts that inject a credits config;
    // everywhere else (guest, dev without the ledger) it degrades away.
    const creditsLane = createGameCreditsLane({
      app,
      t: ctx.t,
      setStatus: ctx.setStatus,
      reviveAction: "revive",
      reviveCostCredits: 5,
      // Paid color-clash starts are fail-closed (NEW_PAID_RUNS_ENABLED). Never
      // sell a credits retry that the start gate would immediately refuse.
      reviveEnabled: NEW_PAID_RUNS_ENABLED && manifest.supportsGameFi !== false,
      onReviveUnlocked: async () => {
        await app.actions.run("startGame", selectedDifficulty.get());
      },
    });

    // Switching to guest at the launcher resets to a clean local lobby and loads
    // the off-chain guest board (replacing the on-chain read done on mount).
    const stopModeSync = app.mode.onChange((mode) => {
      appMode.set(mode);
      session = null;
      pressInFlight = false;
      if (mode === "guest") void guest.enter();
      else void creditsLane.refresh();
    });

    const normalizeContractHash = (value: unknown): string => {
      const raw = String(value ?? "").trim().toLowerCase();
      if (/^0x[0-9a-f]{40}$/.test(raw)) return raw;
      if (/^[0-9a-f]{40}$/.test(raw)) return `0x${raw}`;
      return "";
    };
    const contractBindingIsExact = (): boolean =>
      normalizeContractHash(app.chain.contractAddress.get()) === COLOR_CLASH_TESTNET_CONTRACT;
    // RFC P0-6: typed read lane — `asBigInt()` keeps the parseBigInt-to-0n
    // decode semantics; read errors still propagate to the caller.
    const readActiveGameId = async (playerHash: string): Promise<string> => String(
      await app.chain.query("activeGameOf", [app.chain.arg.hash160(playerHash)]).asBigInt(),
    );
    const readGame = (gameId: string): Promise<unknown> =>
      app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
    const gameMatchesIdentity = (
      game: unknown,
      gameId: string,
      playerHash: string,
      difficulty?: number,
    ): boolean => String(parseBigInt(mapField(game, "id")) ?? "0") === gameId
      && Boolean(playerHash)
      && addrEq(mapField(game, "player"), playerHash)
      && (difficulty === undefined || asNumber(mapField(game, "difficulty")) === difficulty);
    const sessionMatchesRule = (opened: RewardGameSession, difficulty: number): boolean => {
      const rule = ruleOf(difficulty);
      return opened.identity.appId === appId
        && opened.identity.engineHash.replace(/^0x/i, "").toLowerCase() === ENGINE_HASH
        && opened.identity.network === "testnet"
        && normalizeContractHash(opened.identity.contractHash) === COLOR_CLASH_TESTNET_CONTRACT
        && opened.identity.difficulty === difficulty
        && opened.config.limitMs === rule.limitMs
        && opened.config.minSolveMs === rule.minSolveMs
        && opened.config.maxUndos === 3
        && opened.config.revealPolicy === "per-round"
        && opened.config.target === rule.targetSeq;
    };
    const verifyPlayingSession = async (
      opened: RewardGameSession,
      gameId: string,
      difficulty: number,
    ): Promise<unknown> => {
      const playerHash = app.game.player.scriptHash();
      const game = await readGame(gameId);
      if (
        !contractBindingIsExact()
        || !sessionMatchesRule(opened, difficulty)
        || opened.identity.gameId !== gameId
        || !gameMatchesIdentity(game, gameId, playerHash, difficulty)
        || asNumber(mapField(game, "status")) !== 1
      ) {
        throw new Error(ctx.t("statusSessionMismatch"));
      }
      return game;
    };
    const startResultMatchesIntent = async (
      started: Awaited<ReturnType<typeof startRewardGame>>,
      difficulty: number,
    ): Promise<boolean> => {
      const event = started.tx.event;
      const exactEvent = event != null
        && String(parseBigInt(eventStateValue(event, 0)) ?? "0") === started.gameId
        && addrEq(eventStateValue(event, 1), started.playerHash)
        && asNumber(eventStateValue(event, 2)) === difficulty;
      if (exactEvent) return true;
      const active = await readActiveGameId(started.playerHash);
      if (active !== started.gameId) return false;
      const game = await readGame(started.gameId);
      return gameMatchesIdentity(game, started.gameId, started.playerHash, difficulty)
        && asNumber(mapField(game, "status")) === 1;
    };
    const durableOpsStorageAvailable = (): boolean => {
      const key = `${OPS_STORAGE_PREFIX}probe:${Date.now()}`;
      const token = `color-${Date.now()}`;
      try {
        app.storage.local.set(key, token);
        return app.storage.local.get<string>(key, "") === token;
      } catch {
        return false;
      } finally {
        try { app.storage.local.delete(key); } catch { /* best-effort cleanup */ }
      }
    };
    let contractConfigCompatible = false;

    const configMatchesReviewedRules = (config: unknown): boolean => {
      const fieldsMatch = DIFFICULTY_RULES.every((rule) => (
        parseBigInt(mapField(config, `entry${rule.difficulty}`)) === BigInt(rule.entry)
        && parseBigInt(mapField(config, `reward${rule.difficulty}`)) === BigInt(rule.reward)
        && parseBigInt(mapField(config, `limitMs${rule.difficulty}`)) === BigInt(rule.limitMs)
        && parseBigInt(mapField(config, `minSolveMs${rule.difficulty}`)) === BigInt(rule.minSolveMs)
        && parseBigInt(mapField(config, `targetSeq${rule.difficulty}`)) === BigInt(rule.targetSeq)
      ));
      return fieldsMatch
        && parseBigInt(mapField(config, "maxUndos")) === 3n
        && parseBigInt(mapField(config, "undoPenaltyPct")) === 30n
        && parseBigInt(mapField(config, "settleGraceMs")) === BigInt(SETTLEMENT_GRACE_MS);
    };

    // ── Data refresh ──────────────────────────────────────────────────────────
    const refreshBalances = async () => {
      if (app.mode.isGuest()) return;
      try {
        const balances = await rewardGame.balances(app.game.player.scriptHash());
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
      } catch { /* best-effort */ }
    };

    const refreshStats = async () => {
      if (app.mode.isGuest()) return;
      const { solves, totalWon } = await app.game.stats.load();
      obs.mySolves.set(solves);
      obs.myTotalWon.set(totalWon);
    };

    const refreshGameConfig = async () => {
      if (app.mode.isGuest()) return;
      contractConfigCompatible = false;
      try {
        if (!contractBindingIsExact()) throw new Error(ctx.t("statusContractMismatch"));
        const [config, oracle] = await Promise.all([
          app.chain.readRaw("getConfig", []),
          app.chain.readRaw("oracle", []),
        ]);
        if (!configMatchesReviewedRules(config) || !addrEq(oracle, COLOR_CLASH_TESTNET_ORACLE)) {
          throw new Error(ctx.t("statusContractMismatch"));
        }
        const configuredGrace = asNumber(mapField(config, "settleGraceMs"));
        settlementGraceMs.set(configuredGrace);
        contractConfigCompatible = true;
      } catch {
        settlementGraceMs.set(SETTLEMENT_GRACE_MS);
        contractConfigCompatible = false;
      }
    };

    // Color-clash leaderboard has `player` + `solved` field names (not address/solves).
    // Keep a custom implementation that handles the unique field layout.
    const loadLeaderboard = async () => {
      if (app.mode.isGuest()) return;
      const playerHash = app.game.player.scriptHash();
      try {
        const events = await app.chain.events("Solved", { limit: LEADERBOARD_EVENT_LIMIT });
        const bestByPlayer = new Map<string, LeaderEntry>();
        const mine: ColorClashRow[] = [];
        for (const ev of events) {
          const gameId = parseBigInt(eventStateValue(ev, SOLVED_SLOTS.gameId));
          const who = normHash(eventStateValue(ev, 1));
          const rawDifficulty = parseBigInt(eventStateValue(ev, SOLVED_SLOTS.difficulty));
          const payoutFixed8 = parseBigInt(eventStateValue(ev, SOLVED_SLOTS.solvedPayout));
          const totalWonFixed8 = parseBigInt(eventStateValue(ev, SOLVED_SLOTS.totalWon));
          const elapsedMs = parseBigInt(eventStateValue(ev, SOLVED_SLOTS.elapsedMs));
          const undos = parseBigInt(eventStateValue(ev, SOLVED_SLOTS.undos));
          // The contract also emits Solved for a verified non-winning result.
          // Keep those zero-payout attempts out of the wins leaderboard.
          if (
            !who
            || gameId <= 0n
            || rawDifficulty < 0n
            || rawDifficulty > 2n
            || payoutFixed8 <= 0n
            || totalWonFixed8 < payoutFixed8
            || elapsedMs <= 0n
            || undos < 0n
            || undos > 3n
          ) continue;
          const difficulty = Number(rawDifficulty);
          const totalWon = fromFixed8(totalWonFixed8);
          const prior    = bestByPlayer.get(who);
          bestByPlayer.set(who, {
            rank:     0,
            address:  String(eventStateValue(ev, 1) ?? who),
            totalWon: Math.max(prior?.totalWon ?? 0, totalWon),
            solves:   (prior?.solves ?? 0) + 1,
            isUser:   playerHash ? addrEq(eventStateValue(ev, 1), playerHash) : false,
          });
          if (playerHash && addrEq(eventStateValue(ev, 1), playerHash)) {
            mine.push({
              gameId:       String(gameId),
              difficulty,
              solveMs:      Number(elapsedMs),
              undos:        Number(undos),
              payout:       `${fromFixed8(payoutFixed8).toFixed(2)} GAS`,
              seqAchieved:  ruleOf(difficulty).targetSeq,
            });
          }
        }
        const ranked = [...bestByPlayer.values()]
          .sort((a, b) => b.totalWon - a.totalWon)
          .map((e, i) => ({ ...e, rank: i + 1 }));
        obs.leaderboard.set(ranked);
        const me = playerHash
          ? ranked.find((entry) => addrEq(entry.address, playerHash))
          : undefined;
        obs.myRank.set(me?.rank ?? 0);
        obs.myHistory.set(mine.reverse().slice(0, 12));
      } catch { /* indexer unreachable */ }
    };

    const applySnapshot = (game: unknown) => {
      app.game.session.applySnapshot(obs, game, sessionStatusOf);
      selectedDifficulty.set(Math.max(0, Math.min(2, obs.gameDifficulty.get())));
    };

    const initialCueOf = (value: unknown): string => {
      try {
        return requireColorSequence(value, 1);
      } catch {
        throw new Error(ctx.t("invalidSessionPayload"));
      }
    };

    // ── Session open / resume ─────────────────────────────────────────────────
    const openSession = async (gameId: string, difficulty: number): Promise<void> => {
      obs.isDealing.set(true);
      obs.lastStatus.set("shuffling");
      try {
        // Read the on-chain clock before contacting the TEE. If session opening
        // fails, the recovery UI still knows when permissionless expiry becomes
        // available instead of stranding a paid active game behind Retry.
        try {
          const playerHash = app.game.player.scriptHash();
          const game = await readGame(gameId);
          if (
            !gameMatchesIdentity(game, gameId, playerHash, difficulty)
            || asNumber(mapField(game, "status")) !== 1
          ) throw new Error(ctx.t("statusSessionMismatch"));
          obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
          obs.deadline.set(asNumber(mapField(game, "deadline")));
          obs.gameStatus.set("dealt");
        } catch {
          // The start receipt still proves the game exists; Retry can re-read.
        }
        const opened = await rewardGame.openSession(gameId, difficulty);
        const game = await verifyPlayingSession(opened, gameId, difficulty);
        const openedSequence = initialCueOf(opened.view.sequence);
        session = opened;
        obs.commitment.set(opened.commitment);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        sequence.set(openedSequence);
        playerSequence.set("");
        seqAchieved.set(0);
        roundNumber.set(Math.max(1, Number(session.view.round) || openedSequence.length || 1));
        roundPhase.set("watching");
        isPressing.set(false);
        obs.gameStatus.set("dealt");
        obs.undosUsed.set(0);
        obs.lastStatus.set("watching");
        ctx.setStatus(ctx.t("statusDealt"), "success");
      } catch (error) {
        session = null;
        obs.lastStatus.set("deal-pending");
        ctx.setError(error, "statusFailed");
      } finally {
        obs.isDealing.set(false);
      }
    };

    const resumeSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      try {
        const restored = await rewardGame.openSession(gameId, difficulty);
        const game = await verifyPlayingSession(restored, gameId, difficulty);
        if (obs.commitment.get() && restored.commitment !== obs.commitment.get()) {
          throw new Error(ctx.t("statusSessionMismatch"));
        }
        const restoredSequence = initialCueOf(restored.view.sequence);
        session = restored;
        obs.commitment.set(restored.commitment);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        sequence.set(restoredSequence);
        playerSequence.set("");
        seqAchieved.set(0);
        roundNumber.set(Math.max(1, Number(restored.view.round) || restoredSequence.length || 1));
        roundPhase.set("watching");
        const ops = rewardGame.storage.load(gameId);
        if (ops.length > 0) {
          await rewardGame.replayOps(restored, ops, (step, op) => {
            applyVerifiedPress(step.view as Record<string, unknown>, op.color);
          });
        }
        obs.gameStatus.set("dealt");
        if (roundPhase.get() === "watching") obs.lastStatus.set("watching");
        else if (roundPhase.get() === "input") obs.lastStatus.set("repeat");
        else if (roundPhase.get() === "complete") obs.lastStatus.set("all-correct");
        return true;
      } catch (error) {
        session = null;
        obs.lastStatus.set("deal-pending");
        ctx.setError(error, "statusFailed");
        return false;
      } finally {
        obs.isDealing.set(false);
      }
    };

    const applyObservedSettlement = async (snapshot: RewardGameSnapshot): Promise<void> => {
      const playerHash = app.game.player.scriptHash();
      if (!gameMatchesIdentity(
        snapshot.raw,
        snapshot.gameId,
        playerHash,
        snapshot.difficulty,
      )) {
        throw new Error(ctx.t("statusSessionMismatch"));
      }
      const won = snapshot.status === "solved" && snapshot.payoutFixed8 > 0n;
      lastPayoutFixed8.set(snapshot.payoutFixed8);
      obs.lastElapsedMs.set(snapshot.solveMs);
      obs.gameStatus.set(won ? "solved" : "expired");
      roundPhase.set(won ? "complete" : "expired");
      obs.lastStatus.set(won ? "solved" : "expired");
      obs.activeGameId.set("0");
      rewardGame.storage.forget(snapshot.gameId);
      session = null;
      ctx.setStatus(
        won
          ? ctx.t("statusSolved", { payout: snapshot.payoutGas.toFixed(2) })
          : ctx.t("expiredBanner"),
        won ? "success" : "info",
      );
      await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
    };

    const confirmFinalizedSnapshot = async (
      gameId: string,
      difficulty: number,
      finalized: Awaited<ReturnType<typeof finalizeRewardGame>>,
    ): Promise<RewardGameSnapshot | null> => {
      const snapshot = await rewardGame.snapshot(gameId);
      const playerHash = app.game.player.scriptHash();
      if (!gameMatchesIdentity(snapshot.raw, gameId, playerHash, difficulty)) {
        throw new Error(ctx.t("statusSessionMismatch"));
      }
      if (!["solved", "expired", "refunded"].includes(snapshot.status)) return null;

      const event = finalized.tx.event;
      if (event != null) {
        const eventMatches = String(parseBigInt(eventStateValue(event, 0)) ?? "0") === gameId
          && addrEq(eventStateValue(event, 1), playerHash)
          && asNumber(eventStateValue(event, 2)) === difficulty
          && asNumber(eventStateValue(event, 3)) === snapshot.solveMs
          && parseBigInt(eventStateValue(event, SOLVED_SLOTS.solvedPayout)) === snapshot.payoutFixed8;
        if (!eventMatches) throw new Error(ctx.t("settlementMismatch"));
      }
      if (
        finalized.settlement.status !== "unknown"
        && (
          finalized.settlement.payoutFixed8 !== snapshot.payoutFixed8
          || finalized.settlement.elapsedMs !== snapshot.solveMs
        )
      ) throw new Error(ctx.t("settlementMismatch"));
      return snapshot;
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    app.actions.register("setDifficulty", async (...args: unknown[]) => {
      if (
        obs.isStarting.get()
        || obs.isDealing.get()
        || obs.isSubmitting.get()
        || ["dealt", "committed", "unknown"].includes(obs.gameStatus.get())
      ) return;
      selectedDifficulty.set(Math.max(0, Math.min(2, Math.round(Number(args[0]) || 0))));
    });

    app.actions.register("startGame", async (...args: unknown[]) => {
      const difficulty = Math.max(
        0,
        Math.min(2, Math.round(Number(args[0] ?? selectedDifficulty.get()) || 0)),
      );
      selectedDifficulty.set(difficulty);
      if (app.mode.isGuest()) { guest.startGame(difficulty); return; }
      if (!NEW_PAID_RUNS_ENABLED || manifest.supportsGameFi === false) {
        ctx.setStatus(ctx.t("gameFiMaintenanceShort"), "info");
        return;
      }
      if (!app.wallet.isConnected()) {
        ctx.setStatus(ctx.t("connectWalletFirst"), "info");
        return;
      }
      await refreshGameConfig();
      if (!contractBindingIsExact() || !contractConfigCompatible) {
        ctx.setStatus(ctx.t("statusContractMismatch"), "error");
        return;
      }
      if (!durableOpsStorageAvailable()) {
        ctx.setStatus(ctx.t("statusStorageUnavailable"), "error");
        return;
      }
      if (
        obs.isStarting.get()
        || obs.isDealing.get()
        || obs.isSubmitting.get()
        || obs.gameStatus.get() === "dealt"
        || obs.gameStatus.get() === "committed"
      ) return;
      obs.isStarting.set(true);
      obs.lastStatus.set("starting");
      try {
        const started = await startRewardGame(difficulty);
        if (!await startResultMatchesIntent(started, difficulty)) {
          throw new Error(ctx.t("statusStartPending"));
        }
        const gameId  = started.gameId;
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
        obs.undosUsed.set(0);
        obs.commitment.set("");
        sequence.set("");
        playerSequence.set("");
        seqAchieved.set(0);
        roundNumber.set(0);
        roundPhase.set("lobby");
        isPressing.set(false);
        obs.gameStatus.set("committed");
        obs.lastStatus.set("started");
        await refreshBalances();
        await openSession(gameId, difficulty);
      } catch (error) {
        // A wallet may have broadcast before an indexer/read timeout. Recover
        // any exact active id instead of presenting another paid Start action.
        try {
          const playerHash = app.game.player.scriptHash();
          const active = playerHash ? await readActiveGameId(playerHash) : "0";
          if (active !== "0") {
            obs.activeGameId.set(active);
            const game = await readGame(active);
            if (!gameMatchesIdentity(game, active, playerHash)) {
              throw new Error(ctx.t("statusSessionMismatch"));
            }
            applySnapshot(game);
            session = null;
            obs.lastStatus.set("deal-pending");
            ctx.setStatus(ctx.t("statusStartPending"), "warning");
            return;
          }
        } catch {
          // No exact active-id proof is available; retain the original error.
        }
        obs.lastStatus.set("failed");
        ctx.setError(error, "statusFailed");
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = obs.activeGameId.get();
      const status = obs.gameStatus.get();
      if (
        !gameId
        || gameId === "0"
        || obs.isDealing.get()
        || !["committed", "dealt"].includes(status)
        || (status === "dealt" && obs.lastStatus.get() !== "deal-pending")
      ) return;
      if (status === "committed") await openSession(gameId, obs.gameDifficulty.get());
      else await resumeSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("checkSettlement", async () => {
      if (app.mode.isGuest() || isRecovering.get()) return;
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || obs.gameStatus.get() !== "unknown") return;
      isRecovering.set(true);
      try {
        const snapshot = await rewardGame.snapshot(gameId);
        if (snapshot.status === "unknown") {
          obs.lastStatus.set("settlement-pending");
          ctx.setStatus(ctx.t("settlementStillPending"), "info");
          return;
        }
        if (snapshot.status === "dealt") {
          obs.gameStatus.set("dealt");
          obs.lastStatus.set("deal-pending");
          session = null;
          ctx.setStatus(ctx.t("sessionRecoveryReady"), "info");
          return;
        }
        if (["solved", "expired", "refunded"].includes(snapshot.status)) {
          await applyObservedSettlement(snapshot);
        }
      } catch (error) {
        ctx.setError(error, "statusFailed");
      } finally {
        isRecovering.set(false);
      }
    });

    app.actions.register("sequencePlaybackComplete", () => {
      if (app.mode.isGuest()) { guest.sequencePlaybackComplete(); return; }
      if (
        obs.gameStatus.get() !== "dealt"
        || roundPhase.get() !== "watching"
        || hasColorDeadlinePassed(obs.deadline.get())
      ) return;
      roundPhase.set("input");
      obs.lastStatus.set("repeat");
    });

    app.actions.register("recordPress", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.recordPress(Number(args[0])); return; }
      const color  = Number(args[0]);
      const gameId = obs.activeGameId.get();
      if (!isColorIndex(color)) return;
      if (
        !gameId
        || gameId === "0"
        || !session
        || obs.gameStatus.get() !== "dealt"
        || roundPhase.get() !== "input"
        || pressInFlight
        || hasColorDeadlinePassed(obs.deadline.get())
      ) return;
      pressInFlight = true;
      isPressing.set(true);
      try {
        const { step }    = await rewardGame.recordOp(session, { type: "press", color });
        const view = step.view as Record<string, unknown>;
        // Keep every verified press, including a terminal miss. Dropping the
        // losing op would let a refresh replay only the successful prefix.
        applyVerifiedPress(view, color);
      } catch (error) {
        ctx.setError(error, "statusFailed");
      } finally {
        pressInFlight = false;
        isPressing.set(false);
      }
    });

    app.actions.register("submitSolution", async () => {
      if (app.mode.isGuest()) { await guest.submitSolution(); return; }
      const gameId = obs.activeGameId.get();
      if (
        !gameId
        || gameId === "0"
        || obs.isSubmitting.get()
        || obs.gameStatus.get() !== "dealt"
        || roundPhase.get() !== "complete"
        || hasColorDeadlinePassed(obs.deadline.get())
      ) return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set("submitting");
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        const snapshot = await confirmFinalizedSnapshot(
          gameId,
          obs.gameDifficulty.get(),
          finalized,
        );
        if (!snapshot) {
          obs.gameStatus.set("unknown");
          roundPhase.set("expired");
          obs.lastStatus.set("settlement-pending");
          session = null;
          ctx.setStatus(ctx.t("settlementStillPending"), "info");
          return;
        }
        seqAchieved.set(asNumber(mapField(snapshot.raw, "seqAchieved")));
        obs.undosUsed.set(asNumber(mapField(snapshot.raw, "undos")));
        await applyObservedSettlement(snapshot);
      } catch (error) {
        session = null;
        try {
          const snapshot = await rewardGame.snapshot(gameId);
          if (snapshot.status === "unknown") {
            obs.gameStatus.set("unknown");
            roundPhase.set("expired");
            obs.lastStatus.set("settlement-pending");
            ctx.setStatus(ctx.t("settlementStillPending"), "info");
            return;
          }
          if (["solved", "expired", "refunded"].includes(snapshot.status)) {
            await applyObservedSettlement(snapshot);
            return;
          }
        } catch {
          // A later Retry rebuilds the TEE session from the persisted op-log.
        }
        obs.lastStatus.set("deal-pending");
        ctx.setError(error, "sessionRecoveryReady");
      } finally {
        obs.isSubmitting.set(false);
      }
    });

    app.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0") return;
      if (!canReleaseExpiredGame(obs.deadline.get(), settlementGraceMs.get())) {
        ctx.setStatus(ctx.t("releaseWaitStatus"), "info");
        return;
      }
      const persistedOps = rewardGame.storage.load(gameId);
      try {
        await rewardGame.expire(gameId);
        session = null;
        isPressing.set(false);
        const snapshot = await rewardGame.snapshot(gameId);
        if (["solved", "expired", "refunded"].includes(snapshot.status)) {
          await applyObservedSettlement(snapshot);
          return;
        }
        rewardGame.storage.save(gameId, persistedOps);
        obs.gameStatus.set("unknown");
        roundPhase.set("expired");
        obs.lastStatus.set("settlement-pending");
        ctx.setStatus(ctx.t("settlementStillPending"), "info");
      } catch (error) {
        rewardGame.storage.save(gameId, persistedOps);
        ctx.setError(error, "statusFailed");
      }
    });

    const withdrawOp = app.operations.create("withdrawWinnings");
    app.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      if (!app.wallet.isConnected()) {
        ctx.setStatus(ctx.t("connectWalletFirst"), "info");
        return;
      }
      const playerHash = app.game.player.scriptHash();
      if (!playerHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      await withdrawOp.run(async () => {
        const before = await rewardGame.balances(playerHash);
        if (before.creditFixed8 <= 0n) throw new Error(ctx.t("noCreditToWithdraw"));
        const result = await rewardGame.withdrawCredit(before.creditFixed8);
        if (result.skipped) throw new Error(ctx.t("noCreditToWithdraw"));
        const exactEvent = result.tx.event != null
          && addrEq(eventStateValue(result.tx.event, 0), playerHash)
          && parseBigInt(eventStateValue(result.tx.event, 1)) === before.creditFixed8;
        const after = await rewardGame.balances(playerHash);
        obs.poolFree.set(after.poolFreeGas);
        obs.credit.set(after.creditGas);
        if (!exactEvent && after.creditFixed8 !== 0n) {
          throw new Error(ctx.t("withdrawPending"));
        }
      }, { successKey: "creditWithdrawn" });
    });

    app.actions.register("refreshLeaderboard", async () => {
      if (app.mode.isGuest()) { await guest.refreshLeaderboard(); return; }
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    // ── State returned to PlayArea ────────────────────────────────────────────
    return {
      state: {
        ...obs,
        sequence,
        playerSequence,
        seqAchieved,
        roundNumber,
        roundPhase,
        selectedDifficulty,
        isPressing,
        isRecovering,
        settlementGraceMs,
        lastPayoutFixed8,
        appMode,
        ...creditsLane.state,
      },
      loadData: async () => {
        if (app.mode.isGuest()) { await guest.enter(); return; }
        if (!contractBindingIsExact()) {
          obs.lastStatus.set("failed");
          ctx.setStatus(ctx.t("statusContractMismatch"), "error");
          return;
        }
        void creditsLane.refresh();
        await Promise.all([refreshBalances(), refreshGameConfig()]);
        if (!contractConfigCompatible) {
          obs.lastStatus.set("failed");
          ctx.setStatus(ctx.t("statusContractMismatch"), "error");
          return;
        }
        const playerHash = app.game.player.scriptHash();
        if (playerHash) {
          try {
            const active = await readActiveGameId(playerHash);
            if (active !== "0") {
              obs.activeGameId.set(active);
              const game = await readGame(active);
              if (!gameMatchesIdentity(game, active, playerHash)) {
                throw new Error(ctx.t("statusSessionMismatch"));
              }
              applySnapshot(game);
              if (obs.gameStatus.get() === "dealt") {
                await resumeSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "committed") {
                await openSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "unknown") {
                roundPhase.set("expired");
                obs.lastStatus.set("settlement-pending");
              }
            }
          } catch (error) {
            session = null;
            if (obs.activeGameId.get() !== "0") obs.gameStatus.set("unknown");
            obs.lastStatus.set("settlement-pending");
            ctx.setStatus(
              app.errors.messageOf(error, ctx.t("statusRecoveryUnavailable")),
              "warning",
            );
          }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set("");
      },
      cleanup: () => {
        stopWalletSync();
        stopModeSync();
      },
    };
  },
});

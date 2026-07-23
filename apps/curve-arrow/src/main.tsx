/**
 * Curve Arrow — Phaser archery plus guarded GameFi recovery.
 *
 * Free play is the production entry surface. Paid starts remain fail-closed
 * until the contract, funded pool, oracle session and settlement path have a
 * live end-to-end testnet proof. The dormant GameFi path is intentionally kept
 * recovery-capable for historical sessions.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import type { RewardGameSession } from "@framework/gamefi";
import { eventHashMatches as addrEq, mapField } from "@framework/gamefi";
import { parseBigInt } from "@shared/utils/parsers";
import { eventStateValue } from "@shared/utils/chain-events";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  DIFFICULTY_RULES,
  ENTRY_MEMO,
  canExpireAfterGrace,
  gasDisplay,
  statusOf,
} from "./logic/game-rules";
import { createGuestEngine } from "./logic/guest-engine";
import {
  applyShot,
  createRun,
  normalizeHolds,
  parseInitialState,
} from "./logic/arrow-engine";
import type { RunState } from "./logic/arrow-engine";
import type { GameSessionStatus, LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId = "miniapp-curve-arrow";
const ENGINE_HASH = "5ba33802c33acc5a6684aa59f22e3be86772f2c5b92baf4dbd4bb8f3c3ad6a55";
const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX = "miniapp-curve-arrow:ops:";

/** New paid starts remain disabled until deployment + funded settlement are proven. */
export const NEW_PAID_RUNS_ENABLED = false;

type TeeOp = { type: "shot"; holds: number[] };

const rewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo: ENTRY_MEMO,
  modes: DIFFICULTY_RULES.map((rule) => ({
    id: rule.difficulty,
    key: rule.key,
    entryFixed8: rule.entryFixed8,
    rewardFixed8: rule.rewardFixed8,
    limitMs: rule.limitMs,
    minSolveMs: rule.minSolveMs,
    target: rule.targetLevels,
  })),
  eventSlots: { solvedPayout: 4 },
  progression: { enabled: true },
};

const SOLVED_SLOTS = {
  gameId: 0,
  player: 1,
  difficulty: 2,
  elapsedMs: 3,
  solvedPayout: 5,
  totalWon: 6,
  undos: 7,
};

export type { LeaderEntry, SolveRow };

function sessionStatusOf(raw: number): GameSessionStatus {
  switch (statusOf(raw)) {
    case "committed": return "committed";
    case "dealt": return "dealt";
    case "solved": return "solved";
    case "expired": return "expired";
    case "refunded": return "refunded";
    default: return "unknown";
  }
}

function difficultyInput(value: unknown): number {
  const raw = value && typeof value === "object"
    ? (value as { difficulty?: unknown }).difficulty
    : value;
  return Math.max(0, Math.min(2, Math.round(Number(raw) || 0)));
}

function replayShots(cluesJson: string, difficulty: number, ops: readonly TeeOp[]): RunState {
  const parsed = parseInitialState(cluesJson);
  if (!parsed) throw new Error("Invalid range layout");
  let run = createRun(parsed.levels, difficulty);
  for (const op of ops) {
    const holds = normalizeHolds(op.holds);
    if (!holds || run.done) throw new Error("Invalid recovered shot trail");
    run = applyShot(run, parsed.levels, holds).run;
  }
  return run;
}

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const rewardGame = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;
    const obs = app.game.session.observables<SolveRow>(ctx.t);

    const clues = createObservable("");
    const levelsCleared = createObservable(0);
    const arrowsUsed = createObservable(0);
    const runDone = createObservable(false);
    const runWon = createObservable(false);
    const shotHistory = createObservable("[]");
    const inputSyncPending = createObservable(false);
    const inputSyncFailed = createObservable(false);
    const isRecovering = createObservable(false);
    const isConnectingWallet = createObservable(false);
    const walletConnected = createObservable(app.wallet.isConnected());
    const newPaidRunsEnabled = createObservable(NEW_PAID_RUNS_ENABLED);
    const controlHeld = createObservable(false);
    const controlPressNonce = createObservable(0);
    const appMode = createObservable(app.mode.get());

    let session: RewardGameSession | null = null;
    let inputQueue: Promise<void> = Promise.resolve();
    let pendingOps = 0;

    const resetInputQueue = (): void => {
      inputQueue = Promise.resolve();
      pendingOps = 0;
      inputSyncPending.set(false);
    };

    const publishRun = (run: RunState, ops: readonly TeeOp[]): void => {
      levelsCleared.set(run.cleared);
      arrowsUsed.set(run.arrowsUsed);
      runDone.set(run.done);
      runWon.set(run.won);
      shotHistory.set(JSON.stringify(ops.map((op) => op.holds)));
    };

    const clearRun = (): void => {
      levelsCleared.set(0);
      arrowsUsed.set(0);
      runDone.set(false);
      runWon.set(false);
      shotHistory.set("[]");
      inputSyncFailed.set(false);
      controlHeld.set(false);
    };

    // RFC P0-5: identity-diff account hook — fires only when the normalized
    // address actually changes (handler errors are isolated by the framework).
    // Disconnects always reset; switches between two connected identities
    // preserve the original previous-and-current guard.
    const stopWalletSync = app.wallet.onAccountChanged(({ previous, current }) => {
      const identityChanged = Boolean(previous && current && previous !== current);
      walletConnected.set(Boolean(current));
      if (!current || identityChanged) {
        session = null;
        resetInputQueue();
        const recoverable = obs.activeGameId.get() !== "0" &&
          ["committed", "dealt", "unknown"].includes(obs.gameStatus.get());
        if (!app.mode.isGuest() && recoverable) {
          inputSyncFailed.set(true);
          obs.lastStatus.set("input-sync-failed");
        }
      }
    });

    const guestLeaderboard = import.meta.env.DEV
      ? {
          async submit(): Promise<void> { return; },
          async get(): Promise<Array<{ user: string; score: string }>> { return []; },
        }
      : app.mode.guestLeaderboard;
    const guest = createGuestEngine({
      obs,
      clues,
      levelsCleared,
      arrowsUsed,
      runDone,
      runWon,
      guestLeaderboard,
      storage: app.storage.local,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });

    const stopModeSync = app.mode.onChange((mode) => {
      appMode.set(mode);
      controlHeld.set(false);
      if (mode === "guest") {
        session = null;
        resetInputQueue();
        inputSyncFailed.set(false);
        void guest.enter();
      }
    });

    const refreshBalances = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      try {
        const balances = await rewardGame.balances(app.game.player.scriptHash());
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
      } catch { /* best-effort */ }
    };

    const refreshStats = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      const { solves, totalWon } = await app.game.stats.load();
      obs.mySolves.set(solves);
      obs.myTotalWon.set(totalWon);
    };

    const loadLeaderboard = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      const { ranked, mine } = await app.game.leaderboard.load<SolveRow>(
        "Solved",
        SOLVED_SLOTS,
        LEADERBOARD_EVENT_LIMIT,
      );
      obs.leaderboard.set(ranked as LeaderEntry[]);
      obs.myRank.set(ranked.find((entry) => entry.isUser)?.rank ?? 0);
      obs.myHistory.set(mine);
    };

    const refreshProgression = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      try {
        const progression = await rewardGame.progression(2);
        obs.progressionRequiredDifficulty.set(progression.requiredDifficulty);
        obs.progressionMaxDifficulty.set(progression.maxDifficulty);
        obs.progressionHardChallengeLevel.set(progression.hardChallengeLevel);
        obs.progressionEffectiveLimitMs.set(progression.effectiveLimitMs ?? 0);
        if (obs.gameDifficulty.get() < progression.requiredDifficulty) {
          obs.gameDifficulty.set(progression.requiredDifficulty);
        }
        obs.progressionReady.set(true);
      } catch {
        obs.progressionReady.set(false);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set(ctx.t("progressionUnavailable"));
      }
    };

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
    ): boolean => String(parseBigInt(mapField(game, "id")) ?? "0") === gameId &&
      Boolean(playerHash) && addrEq(mapField(game, "player"), playerHash) &&
      (difficulty === undefined || asNumber(mapField(game, "difficulty")) === difficulty);

    const verifyPlayingSession = async (gameId: string, difficulty: number): Promise<unknown> => {
      const game = await readGame(gameId);
      if (
        !gameMatchesIdentity(game, gameId, app.game.player.scriptHash(), difficulty) ||
        asNumber(mapField(game, "status")) !== 1
      ) throw new Error(ctx.t("statusSessionMismatch"));
      return game;
    };

    const setPlayingRange = (cluesJson: string, difficulty: number, ops: readonly TeeOp[]): void => {
      const run = replayShots(cluesJson, difficulty, ops);
      clues.set(cluesJson);
      publishRun(run, ops);
    };

    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      obs.lastStatus.set("shuffling");
      try {
        const opened = await rewardGame.openSession(gameId, difficulty);
        const game = await verifyPlayingSession(gameId, difficulty);
        const initialClues = String(opened.view.clues ?? "");
        setPlayingRange(initialClues, difficulty, []);
        session = opened;
        resetInputQueue();
        inputSyncFailed.set(false);
        obs.commitment.set(opened.commitment);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        obs.lastStatus.set("dealt");
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        session = null;
        obs.lastStatus.set("deal-pending");
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        return false;
      } finally {
        obs.isDealing.set(false);
      }
    };

    const resumeSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      try {
        const restored = await rewardGame.openSession(gameId, difficulty);
        const game = await verifyPlayingSession(gameId, difficulty);
        if (obs.commitment.get() && restored.commitment !== obs.commitment.get()) {
          throw new Error(ctx.t("statusSessionMismatch"));
        }
        const initialClues = String(restored.view.clues ?? "");
        const ops = rewardGame.storage.load(gameId);
        await rewardGame.replayOps(restored, ops);
        setPlayingRange(initialClues, difficulty, ops);
        session = restored;
        resetInputQueue();
        inputSyncFailed.set(false);
        obs.commitment.set(restored.commitment);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        obs.lastStatus.set("dealt");
        return true;
      } catch {
        session = null;
        obs.lastStatus.set("deal-pending");
        return false;
      }
    };

    const finishFromSnapshot = async (
      gameId: string,
      snapshot: Awaited<ReturnType<typeof rewardGame.snapshot>>,
      announce = true,
    ): Promise<void> => {
      const rewarded = snapshot.status === "solved" && snapshot.payoutFixed8 > 0n;
      const uiStatus = rewarded ? "solved" : snapshot.status === "refunded" ? "refunded" : "expired";
      obs.gameDifficulty.set(snapshot.difficulty);
      obs.commitment.set(snapshot.commitment);
      obs.dealtAt.set(snapshot.dealtAt);
      obs.deadline.set(snapshot.deadline);
      obs.lastElapsedMs.set(snapshot.solveMs);
      obs.lastPayout.set(`${snapshot.payoutGas.toFixed(2)} GAS`);
      obs.gameStatus.set(uiStatus);
      obs.lastStatus.set(rewarded ? "solved" : "expired");
      obs.activeGameId.set("0");
      session = null;
      resetInputQueue();
      inputSyncFailed.set(false);
      rewardGame.storage.forget(gameId);
      if (announce) {
        ctx.setStatus(
          rewarded ? ctx.t("statusSolved", { payout: snapshot.payoutGas.toFixed(2) }) : ctx.t("statusExpired"),
          rewarded ? "success" : "info",
        );
      }
      await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard(), refreshProgression()]);
    };

    const recoverCurrentGame = async (preferredGameId?: string, announce = true): Promise<boolean> => {
      if (app.mode.isGuest() || isRecovering.get()) return false;
      const playerHash = app.game.player.scriptHash();
      if (!playerHash) return false;
      isRecovering.set(true);
      try {
        let gameId = preferredGameId && preferredGameId !== "0" ? preferredGameId : obs.activeGameId.get();
        if (!gameId || gameId === "0") gameId = await readActiveGameId(playerHash);
        if (!gameId || gameId === "0") return false;
        const snapshot = await rewardGame.snapshot(gameId);
        if (!gameMatchesIdentity(snapshot.raw, gameId, playerHash)) {
          throw new Error(ctx.t("statusSessionMismatch"));
        }
        obs.activeGameId.set(gameId);
        app.game.session.applySnapshot(obs, snapshot.raw, sessionStatusOf);
        const nextStatus = sessionStatusOf(asNumber(mapField(snapshot.raw, "status")));
        if (nextStatus === "committed") return openSession(gameId, snapshot.difficulty);
        if (nextStatus === "dealt") return resumeSession(gameId, snapshot.difficulty);
        if (nextStatus === "unknown") {
          session = null;
          obs.gameStatus.set("unknown");
          obs.lastStatus.set("settlement-pending");
          if (announce) ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return true;
        }
        await finishFromSnapshot(gameId, snapshot, announce);
        return true;
      } catch (error) {
        if (announce) ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        return false;
      } finally {
        isRecovering.set(false);
      }
    };

    const startResultMatchesIntent = async (
      started: Awaited<ReturnType<typeof startRewardGame>>,
      difficulty: number,
    ): Promise<boolean> => {
      const event = started.tx.event;
      const eventMatches = event != null &&
        String(parseBigInt(eventStateValue(event, 0)) ?? "0") === started.gameId &&
        addrEq(eventStateValue(event, 1), started.playerHash) &&
        asNumber(eventStateValue(event, 2)) === difficulty;
      if (eventMatches) return true;
      const active = await readActiveGameId(started.playerHash);
      if (active !== started.gameId) return false;
      const game = await readGame(started.gameId);
      const rawStatus = asNumber(mapField(game, "status"));
      return gameMatchesIdentity(game, started.gameId, started.playerHash, difficulty) &&
        (rawStatus === 0 || rawStatus === 1);
    };

    app.actions.register("connectWallet", async () => {
      if (app.mode.isGuest() || isConnectingWallet.get()) return;
      isConnectingWallet.set(true);
      try {
        await app.wallet.ensure();
        walletConnected.set(app.wallet.isConnected());
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
        await recoverCurrentGame(undefined, false);
        ctx.setStatus(ctx.t("walletConnected"), "success");
      } catch (error) {
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        isConnectingWallet.set(false);
      }
    });

    app.actions.register("startGame", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.startGame(difficultyInput(args[0])); return; }
      if (!NEW_PAID_RUNS_ENABLED) { ctx.setStatus(ctx.t("paidRunsUnavailable"), "info"); return; }
      if (!app.wallet.isConnected()) { ctx.setStatus(ctx.t("connectWalletFirst"), "info"); return; }
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      const difficulty = difficultyInput(args[0]);
      let startedGameId = "0";
      obs.isStarting.set(true);
      obs.lastStatus.set("starting");
      try {
        const started = await startRewardGame(difficulty);
        startedGameId = started.gameId;
        if (!await startResultMatchesIntent(started, difficulty)) throw new Error(ctx.t("statusStartPending"));
        obs.activeGameId.set(started.gameId);
        obs.gameDifficulty.set(difficulty);
        obs.commitment.set("");
        obs.dealtAt.set(0);
        obs.deadline.set(0);
        obs.lastPayout.set("");
        obs.lastElapsedMs.set(0);
        clues.set("");
        clearRun();
        obs.gameStatus.set("committed");
        obs.lastStatus.set("started");
        await refreshBalances();
        await openSession(started.gameId, difficulty);
      } catch (error) {
        const recovered = await recoverCurrentGame(startedGameId, false);
        if (recovered) ctx.setStatus(ctx.t("statusRecovered"), "info");
        else ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("selectDifficulty", async (...args: unknown[]) => {
      if (!["idle", "solved", "expired", "refunded"].includes(obs.gameStatus.get())) return;
      const difficulty = difficultyInput(args[0]);
      if (app.mode.isGuest()) { guest.selectDifficulty(difficulty); return; }
      obs.gameDifficulty.set(difficulty);
    });

    app.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || obs.isDealing.get()) return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("pressControl", async () => {
      controlHeld.set(true);
      controlPressNonce.set(controlPressNonce.get() + 1);
    });
    app.actions.register("releaseControl", async () => { controlHeld.set(false); });

    app.actions.register("recordShot", async (...args: unknown[]) => {
      const holds = normalizeHolds((args[0] as { holds?: number[] } | undefined)?.holds ?? []);
      if (!holds) return;
      if (app.mode.isGuest()) { guest.recordShot(holds); return; }
      if (
        inputSyncFailed.get() || !session || obs.gameStatus.get() !== "dealt" ||
        (obs.deadline.get() > 0 && Date.now() >= obs.deadline.get())
      ) return;
      const task = inputQueue.then(async () => {
        if (inputSyncFailed.get() || !session) return;
        pendingOps += 1;
        inputSyncPending.set(true);
        try {
          await rewardGame.recordOp(session, { type: "shot", holds });
          const ops = rewardGame.storage.load(obs.activeGameId.get());
          publishRun(replayShots(clues.get(), obs.gameDifficulty.get(), ops), ops);
        } finally {
          pendingOps = Math.max(0, pendingOps - 1);
          inputSyncPending.set(pendingOps > 0);
        }
      }).catch((error) => {
        inputSyncFailed.set(true);
        obs.lastStatus.set("input-sync-failed");
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusInputSyncFailed")), "error");
      });
      inputQueue = task;
      await task;
    });

    app.actions.register("submitSolution", async () => {
      if (app.mode.isGuest()) { await guest.submitSolution(); return; }
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set("submitting");
      try {
        await inputQueue;
        if (inputSyncFailed.get()) throw new Error(ctx.t("statusInputSyncFailed"));
        if (!session && !await resumeSession(gameId, obs.gameDifficulty.get())) throw new Error(ctx.t("statusFailed"));
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        session = null;
        if (finalized.settlement.status === "unknown") {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set("settlement-pending");
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return;
        }
        const snapshot = await rewardGame.snapshot(gameId);
        if (["unknown", "committed", "dealt"].includes(snapshot.status)) {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set("settlement-pending");
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return;
        }
        await finishFromSnapshot(gameId, snapshot);
      } catch (error) {
        session = null;
        obs.gameStatus.set("unknown");
        obs.lastStatus.set("settlement-pending");
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        obs.isSubmitting.set(false);
      }
    });

    app.actions.register("recoverGame", async () => { await recoverCurrentGame(undefined, true); });

    app.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || isRecovering.get()) return;
      if (!canExpireAfterGrace(obs.deadline.get())) { ctx.setStatus(ctx.t("releaseNotReady"), "info"); return; }
      isRecovering.set(true);
      try {
        await app.chain.invoke("expireGame", [app.chain.arg.integer(gameId)]);
        const snapshot = await app.chain.waitForState(
          () => rewardGame.snapshot(gameId),
          (next) => next.status === "expired" || next.status === "refunded",
          { attempts: 4, firstDelayMs: 2_500, delayMs: 4_000 },
        );
        if (!snapshot) {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set("settlement-pending");
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return;
        }
        await finishFromSnapshot(gameId, snapshot);
      } catch (error) {
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        isRecovering.set(false);
      }
    });

    app.actions.register("returnToLobby", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      if (!["solved", "expired", "refunded"].includes(obs.gameStatus.get())) return;
      obs.gameStatus.set("idle");
      obs.lastStatus.set(ctx.t("statusReady"));
      clues.set("");
      clearRun();
    });

    const withdrawOp = app.operations.create("withdrawWinnings");
    app.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      if (obs.credit.get() <= 0) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      if (!app.wallet.isConnected()) { ctx.setStatus(ctx.t("connectWalletFirst"), "info"); return; }
      await withdrawOp.run(async () => {
        const playerHash = app.game.player.scriptHash();
        const result = await rewardGame.withdrawCredit(app.amount.gasToFixed8(obs.credit.get()));
        if (result.skipped) throw new Error(ctx.t("noCreditToWithdraw"));
        const exactEvent = result.tx.event != null &&
          addrEq(eventStateValue(result.tx.event, 0), playerHash) &&
          parseBigInt(eventStateValue(result.tx.event, 1)) > 0n;
        const balances = await rewardGame.balances(playerHash);
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
        if (!exactEvent && balances.creditFixed8 !== 0n) throw new Error(ctx.t("withdrawPending"));
      }, { successKey: "creditWithdrawn" });
    });

    app.actions.register("refreshLeaderboard", async () => {
      if (app.mode.isGuest()) { await guest.refreshLeaderboard(); return; }
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    return {
      state: {
        ...obs,
        clues,
        levelsCleared,
        arrowsUsed,
        runDone,
        runWon,
        shotHistory,
        appMode,
        inputSyncPending,
        inputSyncFailed,
        isRecovering,
        isConnectingWallet,
        walletConnected,
        newPaidRunsEnabled,
        controlHeld,
        controlPressNonce,
      },
      loadData: async () => {
        if (app.mode.isGuest()) { await guest.enter(); return; }
        await refreshBalances();
        await recoverCurrentGame(undefined, false);
        await Promise.all([refreshStats(), loadLeaderboard(), refreshProgression()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set(ctx.t("statusReady"));
      },
      cleanup: () => {
        stopWalletSync();
        stopModeSync();
      },
    };
  },
});

export { gasDisplay };

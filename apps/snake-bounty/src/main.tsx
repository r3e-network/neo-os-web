/**
 * Snake Bounty — miniapp entry point (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: snake session management, direction recording, and solution submission.
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
  statusOf,
  gasDisplay,
} from "./logic/game-rules";
import { createGuestEngine } from "./logic/guest-engine";
import {
  parseInitialState,
  replayDirections,
  snakeLength,
  stateToClues,
} from "./logic/snake-engine";
import type { GameSessionStatus, LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-snake-bounty";
const ENGINE_HASH = "d92d42113646bf9b683bc7458c0cc449df38765b6aa0bcf8ff943556bac889bc";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-snake-bounty:ops:";
/** New paid starts remain disabled until a funded-pool end-to-end settlement is proven. */
export const NEW_PAID_RUNS_ENABLED = false;

type TeeOp = { type: "move"; dir: number } | { type: "undo" };

const rewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo:  ENTRY_MEMO,
  modes: DIFFICULTY_RULES.map((rule) => ({
    id:           rule.difficulty,
    key:          rule.key,
    entryFixed8:  rule.entryFixed8,
    rewardFixed8: rule.rewardFixed8,
    limitMs:      rule.limitMs,
    minSolveMs:   rule.minSolveMs,
    target:       rule.targetLength,
  })),
  eventSlots: { solvedPayout: 4 },
  progression: { enabled: true },
};

// Snake Solved event: gameId(0) player(1) difficulty(2) elapsedMs(3) payout(4) totalWon(5)
// No undos slot in this game.
const SOLVED_SLOTS = {
  gameId: 0, player: 1, difficulty: 2, elapsedMs: 3,
  solvedPayout: 5, totalWon: 6, undos: 7,
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

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;

    // ── Reward-game runner ────────────────────────────────────────────────────
    const rewardGame = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    // ── Standard session observables ──────────────────────────────────────────
    const obs = app.game.session.observables<SolveRow>(ctx.t);

    // ── Snake-specific observables ────────────────────────────────────────────
    const clues             = createObservable("");
    const currentLength     = createObservable(3);
    const snakeDead         = createObservable(false);
    const inputSyncFailed   = createObservable(false);
    const isRecovering      = createObservable(false);
    const isConnectingWallet = createObservable(false);
    const walletConnected   = createObservable(app.wallet.isConnected());
    const newPaidRunsEnabled = createObservable(NEW_PAID_RUNS_ENABLED);
    const steerDirection    = createObservable(-1);
    const steerNonce        = createObservable(0);

    // Current play mode, mirrored into an observable the PlayArea/scene read so
    // the GAS-centric copy can switch to local/practice framing in guest mode.
    // Kept in sync with the launcher-selected framework mode via app.mode.onChange.
    const appMode = createObservable(app.mode.get());

    let session: RewardGameSession | null = null;
    let inputQueue: Promise<void> = Promise.resolve();
    let walletIdentity = String(app.chain.address.get() ?? "").trim().toLowerCase();

    const resetInputQueue = (): void => { inputQueue = Promise.resolve(); };

    // RFC P0-5: identity-diff account hook. `walletIdentity` bookkeeping stays
    // because the reset must also recognize A → disconnected → B as a switch,
    // which a single change event (previous: null) cannot express by itself.
    const stopWalletSync = app.wallet.onAccountChanged(({ current }) => {
      const address = String(current ?? "").trim().toLowerCase();
      const identityChanged = Boolean(walletIdentity && address && walletIdentity !== address);
      // Keep the last non-empty identity across wallet disconnect/reconnect so
      // A → disconnected → B is still recognized as an account switch.
      if (address) walletIdentity = address;
      walletConnected.set(Boolean(address));
      if (!address || identityChanged) {
        session = null;
        resetInputQueue();
        const recoverable = obs.activeGameId.get() !== "0" &&
          ["committed", "dealt", "unknown"].includes(obs.gameStatus.get());
        if (!address && !app.mode.isGuest() && recoverable) {
          inputSyncFailed.set(true);
          obs.lastStatus.set(ctx.t("statusInputSyncFailed"));
        } else if (identityChanged && !app.mode.isGuest()) {
          // Never show or recover the previous wallet's run under a new signer.
          obs.activeGameId.set("0");
          obs.gameStatus.set("idle");
          obs.commitment.set("");
          obs.dealtAt.set(0);
          obs.deadline.set(0);
          clues.set("");
          currentLength.set(3);
          snakeDead.set(false);
          inputSyncFailed.set(false);
          obs.lastStatus.set(ctx.t("statusReady"));
        }
      }
    });

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local snake game — no chain/oracle/reward calls.
    const guestLeaderboard = import.meta.env.DEV
      ? {
          async submit(): Promise<void> { return; },
          async get(): Promise<Array<{ user: string; score: string }>> { return []; },
        }
      : app.mode.guestLeaderboard;
    const guest = createGuestEngine({
      obs,
      clues,
      currentLength,
      snakeDead,
      guestLeaderboard,
      storage: app.storage.local,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the PlayArea's mode mirror in sync, and — on switching to guest at the
    // launcher — reset to a clean local lobby and load the off-chain guest board
    // (replacing the on-chain read done on mount).
    const stopModeSync = app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") {
        inputSyncFailed.set(false);
        void guest.enter();
      }
    });

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

    const loadLeaderboard = async () => {
      if (app.mode.isGuest()) return;
      const { ranked, mine } = await app.game.leaderboard.load<SolveRow>(
        "Solved", SOLVED_SLOTS, LEADERBOARD_EVENT_LIMIT,
      );
      obs.leaderboard.set(ranked as LeaderEntry[]);
      obs.myRank.set(ranked.find((e) => e.isUser)?.rank ?? 0);
      obs.myHistory.set(mine);
    };

    const refreshProgression = async () => {
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
        if (obs.gameStatus.get() === "idle") {
          obs.lastStatus.set(ctx.t("progressionUnavailable"));
        }
      }
    };

    // ── Session helpers ───────────────────────────────────────────────────────
    const readActiveGameId = async (playerHash: string): Promise<string> => String(
      parseBigInt(await app.chain.readRaw("activeGameOf", [app.chain.arg.hash160(playerHash)])) ?? "0",
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

    const verifyPlayingSession = async (
      gameId: string,
      difficulty: number,
    ): Promise<unknown> => {
      const game = await readGame(gameId);
      if (
        !gameMatchesIdentity(game, gameId, app.game.player.scriptHash(), difficulty) ||
        asNumber(mapField(game, "status")) !== 1
      ) throw new Error(ctx.t("statusSessionMismatch"));
      return game;
    };

    const setPlayingBoard = (cluesJson: string): void => {
      const state = parseInitialState(cluesJson);
      clues.set(cluesJson);
      currentLength.set(snakeLength(state));
      snakeDead.set(state.dead);
    };

    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      obs.lastStatus.set(ctx.t("statusShuffling"));
      try {
        const opened = await rewardGame.openSession(gameId, difficulty);
        const game = await verifyPlayingSession(gameId, difficulty);
        const initialClues = String(opened.view.clues ?? "");
        setPlayingBoard(initialClues);
        session = opened;
        resetInputQueue();
        inputSyncFailed.set(false);
        obs.commitment.set(opened.commitment);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        obs.lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        session = null;
        obs.lastStatus.set(ctx.t("statusDealPending"));
        ctx.setError(error, "statusFailed");
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
        const initialState = parseInitialState(initialClues);
        const ops = rewardGame.storage.load(gameId);
        await rewardGame.replayOps(restored, ops);
        const recoveredState = replayDirections(
          initialState,
          ops.filter((op): op is Extract<TeeOp, { type: "move" }> => op.type === "move").map((op) => op.dir),
        );
        session = restored;
        resetInputQueue();
        clues.set(stateToClues(recoveredState));
        currentLength.set(snakeLength(recoveredState));
        snakeDead.set(recoveredState.dead);
        inputSyncFailed.set(false);
        obs.commitment.set(restored.commitment);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        obs.lastStatus.set(ctx.t("statusDealt"));
        return true;
      } catch {
        session = null;
        obs.lastStatus.set(ctx.t("statusDealPending"));
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
      obs.lastStatus.set(
        rewarded
          ? ctx.t("statusSolved", { payout: snapshot.payoutGas.toFixed(2) })
          : ctx.t("statusExpired"),
      );
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
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          if (announce) ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return true;
        }
        await finishFromSnapshot(gameId, snapshot, announce);
        return true;
      } catch (error) {
        if (announce) ctx.setError(error, "statusFailed");
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

    // ── Actions ───────────────────────────────────────────────────────────────
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
        ctx.setError(error, "statusFailed");
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
      obs.lastStatus.set(ctx.t("statusStarting"));
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
        currentLength.set(3);
        snakeDead.set(false);
        inputSyncFailed.set(false);
        clues.set("");
        obs.gameStatus.set("committed");
        obs.lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        await openSession(started.gameId, difficulty);
      } catch (error) {
        const recovered = await recoverCurrentGame(startedGameId, false);
        if (recovered) ctx.setStatus(ctx.t("statusRecovered"), "info");
        else ctx.setError(error, "statusFailed");
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("selectDifficulty", async (...args: unknown[]) => {
      const status = obs.gameStatus.get();
      if (!["idle", "solved", "expired", "refunded"].includes(status)) return;
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

    app.actions.register("steerSnake", async (...args: unknown[]) => {
      const dir = Number((args[0] as { dir?: unknown } | undefined)?.dir);
      if (!Number.isInteger(dir) || dir < 0 || dir > 3) return;
      steerDirection.set(dir);
      steerNonce.set(steerNonce.get() + 1);
    });

    app.actions.register("recordMove", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { dir?: unknown; length?: unknown; dead?: unknown };
      const dir = Number(form.dir);
      if (!Number.isInteger(dir) || dir < 0 || dir > 3) return;
      if (app.mode.isGuest()) { guest.recordMove(dir); return; }
      if (
        inputSyncFailed.get() || !session || obs.gameStatus.get() !== "dealt" ||
        (obs.deadline.get() > 0 && Date.now() >= obs.deadline.get())
      ) return;
      if (Number.isFinite(Number(form.length))) currentLength.set(Math.max(1, Math.floor(Number(form.length))));
      snakeDead.set(Boolean(form.dead));
      const task = inputQueue.then(async () => {
        if (inputSyncFailed.get() || !session) return;
        await rewardGame.recordOp(session, { type: "move", dir });
      }).catch((error) => {
        inputSyncFailed.set(true);
        obs.lastStatus.set(ctx.t("statusInputSyncFailed"));
        ctx.setError(error, "statusInputSyncFailed");
      });
      inputQueue = task;
      await task;
    });

    app.actions.register("submitSolution", async () => {
      if (app.mode.isGuest()) { await guest.submitSolution(); return; }
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set(ctx.t("statusSubmitting"));
      try {
        await inputQueue;
        if (inputSyncFailed.get()) throw new Error(ctx.t("statusInputSyncFailed"));
        if (!session && !await resumeSession(gameId, obs.gameDifficulty.get())) throw new Error(ctx.t("statusFailed"));
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        session = null;
        if (finalized.settlement.status === "unknown") {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return;
        }
        const snapshot = await rewardGame.snapshot(gameId);
        if (["unknown", "committed", "dealt"].includes(snapshot.status)) {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return;
        }
        await finishFromSnapshot(gameId, snapshot);
      } catch (error) {
        session = null;
        obs.gameStatus.set("unknown");
        obs.lastStatus.set(ctx.t("statusSettlementPending"));
        ctx.setError(error, "statusFailed");
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
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return;
        }
        await finishFromSnapshot(gameId, snapshot);
      } catch (error) {
        ctx.setError(error, "statusFailed");
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
      currentLength.set(3);
      snakeDead.set(false);
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

    // ── State returned to PlayArea ────────────────────────────────────────────
    return {
      state: {
        ...obs,
        clues, currentLength, snakeDead, appMode,
        inputSyncFailed, isRecovering, isConnectingWallet, walletConnected,
        newPaidRunsEnabled, steerDirection, steerNonce,
      },
      loadData: async () => {
        // Guest never reads the chain — reset to a local lobby and load the
        // off-chain board instead, so no chain/oracle call is made in guest mode.
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

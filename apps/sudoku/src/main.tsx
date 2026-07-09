/**
 * Sudoku Arena — miniapp entry point (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`.  The setup function now expresses only the
 * game-specific logic: puzzle session management, move recording, and solution
 * submission.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import type { RewardGameSession } from "@framework/gamefi";
import { mapField } from "@framework/gamefi";
import { parseBigInt } from "@shared/utils/parsers";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { DIFFICULTY_RULES, ENTRY_MEMO, statusOf, gasDisplay } from "./logic/game-rules";
import { configureBoardStorage, forgetBoard } from "./logic/board-store";
import { createGuestEngine } from "./logic/guest-engine";
import type { LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-sudoku";
const ENGINE_HASH = "679aea4220667dec0e921eb364392f7983dae440a3aa9e43a215a4d054ab58c8";
const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-sudoku:ops:";

type TeeOp = { type: "place"; cell: number; digit: number } | { type: "undo" };

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
  })),
  progression: { enabled: true },
};

// Slot layout for the Sudoku Solved event:
// gameId(0) player(1) difficulty(2) elapsedMs(3) undos(4) payout(5) totalWon(6)
const SOLVED_SLOTS = {
  gameId: 0, player: 1, difficulty: 2, elapsedMs: 3,
  undos: 4, solvedPayout: 5, totalWon: 6,
};

export type { LeaderEntry, SolveRow };

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,
  // Pin the app.storage.local prefix so board-store's "board:<gameId>" key
  // resolves to the legacy "miniapp-sudoku:board:<gameId>" localStorage key
  // byte-for-byte — in-progress puzzles saved before the migration survive.
  storagePrefix: "miniapp-sudoku:",

  setup(ctx) {
    const app = ctx.framework;

    // Wire the pure board-store module to the framework local-storage surface
    // (app.storage.local); with the storagePrefix above the board keys stay
    // byte-identical to the pre-migration localStorage keys.
    configureBoardStorage(app.storage.local);

    // ── Reward-game runner ────────────────────────────────────────────────────
    const rewardGame = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    // ── Standard game session observables (replaces ~20 createObservable lines)
    const obs = app.game.session.observables<SolveRow>(ctx.t);

    // Sudoku-specific extras (not in the base session factory)
    const clues       = createObservable("");
    const walletConnected = createObservable(false);

    // ── Play mode (guest | gamefi) ────────────────────────────────────────────
    // Mirror the launcher-selected mode into an observable the PlayArea reads, so
    // guest can drop the GAS-at-stake / pool / reward framing while the GAMEFI
    // copy stays exactly as-is.
    const appMode = createObservable<string>(app.mode.get());

    // Enclave session handle — rebuilt idempotently from the deterministic
    // session start; nothing needs durable storage.
    let session: RewardGameSession | null = null;

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local Sudoku engine — no chain/oracle/reward calls.
    const guest = createGuestEngine({
      obs,
      clues,
      walletConnected,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the mode observable in sync; switching to guest at the launcher resets
    // to a clean local lobby and loads the off-chain guest board (replacing the
    // on-chain read done on mount).
    app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") void guest.enter();
    });

    // ── Derived convenience refs ──────────────────────────────────────────────
    const setStatus = (msg: string, type: "success" | "error" | "info" | "warning" = "info") => {
      obs.lastStatus.set(msg);
      ctx.setStatus(msg, type);
    };

    // ── Data refresh helpers ──────────────────────────────────────────────────
    const refreshBalances = async () => {
      if (app.mode.isGuest()) return;
      try {
        const balances = await rewardGame.balances(app.game.player.scriptHash());
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
      } catch { /* keep previous values — best-effort */ }
    };

    const refreshStats = async () => {
      if (app.mode.isGuest()) return;
      const { solves, totalWon } = await app.game.stats.load();
      obs.mySolves.set(solves);
      obs.myTotalWon.set(totalWon);
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
      }
    };

    const loadLeaderboard = async () => {
      if (app.mode.isGuest()) return;
      const { ranked, mine } = await app.game.leaderboard.load<SolveRow>(
        "Solved", SOLVED_SLOTS, LEADERBOARD_EVENT_LIMIT,
      );
      obs.leaderboard.set(ranked as LeaderEntry[]);
      const me = ranked.find((e) => e.isUser);
      obs.myRank.set(me?.rank ?? 0);
      obs.myHistory.set(mine);
    };

    // ── Snapshot / session helpers ────────────────────────────────────────────
    const applySnapshot = (game: unknown) => {
      app.game.session.applySnapshot(obs, game, statusOf);
    };

    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      obs.lastStatus.set(ctx.t("statusSealing"));
      try {
        const started = await rewardGame.openSession(gameId, difficulty);
        session = started;
        clues.set(String(started.view.clues ?? ""));
        obs.commitment.set(started.commitment);
        const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        obs.undosUsed.set(0);
        setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
        obs.lastStatus.set(ctx.t("statusDealPending"));
        return false;
      } finally {
        obs.isDealing.set(false);
      }
    };

    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const started = await rewardGame.openSession(gameId, difficulty);
        if (obs.commitment.get() && started.commitment !== obs.commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = started;
        clues.set(String(started.view.clues ?? ""));
        obs.commitment.set(started.commitment);
      } catch {
        obs.lastStatus.set(ctx.t("statusDealPending"));
      }
    };

    const sendOp = async (op: TeeOp) => {
      if (!session) throw new Error(ctx.t("statusFailed"));
      await rewardGame.recordOp(session, op);
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    app.actions.register("startGame", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.startGame(args[0]); return; }
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      if (obs.progressionReady.get() && difficulty < obs.progressionRequiredDifficulty.get()) return;
      obs.isStarting.set(true);
      obs.lastStatus.set(ctx.t("statusStarting"));
      try {
        const started = await startRewardGame(difficulty);
        const gameId  = started.gameId;
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
        obs.undosUsed.set(0);
        clues.set("");
        obs.commitment.set("");
        obs.dealtAt.set(0);
        obs.deadline.set(0);
        obs.gameStatus.set("committed");
        obs.lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        void openSession(gameId, difficulty);
        return started.tx;
      } catch (error) {
        const msg = error instanceof Error && "code" in error && error.code === "POOL_LOW"
          ? ctx.t("statusPoolLow")
          : error instanceof Error
            ? error.message
            : ctx.t("statusFailed");
        setStatus(msg, "error");
        throw error;
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("selectDifficulty", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.selectDifficulty(args[0]); return; }
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      if (obs.progressionReady.get() && difficulty < obs.progressionRequiredDifficulty.get()) return;
      obs.gameDifficulty.set(difficulty);
    });

    app.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isDealing.get() || obs.gameStatus.get() !== "committed") return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("recordMove", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.recordMove(args[0]); return; }
      const form = (args[0] ?? {}) as { cell?: unknown; digit?: unknown };
      const cell  = Number(form.cell);
      const digit = Number(form.digit);
      if (!Number.isInteger(cell) || !Number.isInteger(digit)) return;
      try {
        await sendOp({ type: "place", cell, digit });
      } catch { /* telemetry only */ }
    });

    app.actions.register("useUndo", async () => {
      if (app.mode.isGuest()) { guest.useUndo(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isUndoing.get() || obs.gameStatus.get() !== "dealt") return;
      obs.isUndoing.set(true);
      try {
        await sendOp({ type: "undo" });
        const undos = obs.undosUsed.get() + 1;
        obs.undosUsed.set(undos);
        setStatus(ctx.t("statusUndoUsed", { pct: String(100 - 30 * undos) }), "info");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
        throw error;
      } finally {
        obs.isUndoing.set(false);
      }
    });

    app.actions.register("submitSolution", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { await guest.submitSolution(args[0]); return; }
      const form     = (args[0] ?? {}) as { solution?: unknown };
      const solution = String(form.solution ?? "");
      const gameId   = obs.activeGameId.get();
      if (gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      if (!/^[1-9]{81}$/.test(solution)) {
        ctx.setStatus(ctx.t("statusBoardIncomplete"), "error");
        throw new Error(ctx.t("statusBoardIncomplete"));
      }
      obs.isSubmitting.set(true);
      obs.lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        const settled   = finalized.settlement;
        obs.lastPayout.set(`${settled.payoutGas.toFixed(2)} GAS`);
        obs.lastElapsedMs.set(settled.elapsedMs);
        obs.gameStatus.set(settled.status === "unknown" ? "solved" : settled.status as "solved" | "expired");
        obs.activeGameId.set("0");
        forgetBoard(gameId);
        session = null;
        const msg = settled.payoutGas > 0
          ? ctx.t("statusSolved", { payout: settled.payoutGas.toFixed(2) })
          : ctx.t("statusExpired");
        setStatus(msg, settled.payoutGas > 0 ? "success" : "info");
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard(), refreshProgression()]);
        return finalized.tx;
      } catch (error) {
        const msg = error instanceof Error ? error.message : ctx.t("statusFailed");
        setStatus(msg, "error");
        throw error;
      } finally {
        obs.isSubmitting.set(false);
      }
    });

    app.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0") return;
      try {
        await rewardGame.expire(gameId);
        obs.gameStatus.set("expired");
        obs.activeGameId.set("0");
        forgetBoard(gameId);
        session = null;
        setStatus(ctx.t("statusExpired"), "info");
        await Promise.all([refreshBalances(), refreshProgression()]);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
        throw error;
      }
    });

    const withdrawOp = app.operations.create("withdrawWinnings");
    app.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      if (!app.game.player.scriptHash()) { ctx.setStatus(ctx.t("statusFailed"), "error"); return; }
      if (obs.credit.get() <= 0) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      await withdrawOp.run(async () => {
        await rewardGame.withdrawCredit(app.amount.gasToFixed8(obs.credit.get()));
        await refreshBalances();
      }, { successKey: "creditWithdrawn" });
    });

    app.actions.register("refreshLeaderboard", async () => {
      if (app.mode.isGuest()) { await guest.refreshLeaderboard(); return; }
      await Promise.all([loadLeaderboard(), refreshStats(), refreshProgression()]);
    });

    // ── State returned to PlayArea ────────────────────────────────────────────
    return {
      state: {
        ...obs,
        clues,
        walletConnected,
        appMode,
      },
      loadData: async () => {
        // Guest mode is fully local — reset to a clean local lobby and load the
        // off-chain guest board instead of any chain read.
        if (app.mode.isGuest()) { await guest.enter(); return; }
        // Wallet-connected gate
        const address = app.chain.address.get();
        walletConnected.set(Boolean(address));
        await refreshBalances();
        const playerHash = app.game.player.scriptHash();
        if (playerHash) {
          try {
            const active = String(
              parseBigInt(
                await app.chain.readRaw("activeGameOf", [app.chain.arg.hash160(playerHash)]),
              ) ?? "0",
            );
            if (active !== "0") {
              obs.activeGameId.set(active);
              const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(active)]);
              applySnapshot(game);
              if (obs.gameStatus.get() === "dealt") {
                await resumeSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "committed") {
                void openSession(active, obs.gameDifficulty.get());
              }
            }
          } catch { /* no active game recoverable */ }
        }
        await Promise.all([refreshStats(), loadLeaderboard(), refreshProgression()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set(ctx.t("statusReady"));
      },
    };
  },
});

export { gasDisplay };

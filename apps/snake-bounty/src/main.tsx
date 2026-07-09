/**
 * Snake Bounty — miniapp entry point (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: snake session management, direction recording, and solution submission.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import type { RewardGameSession } from "@framework/gamefi";
import { mapField } from "@framework/gamefi";
import { parseBigInt } from "@shared/utils/parsers";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { DIFFICULTY_RULES, ENTRY_MEMO, statusOf, gasDisplay } from "./logic/game-rules";
import { createGuestEngine } from "./logic/guest-engine";
import type { LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-snake-bounty";
const ENGINE_HASH = "d92d42113646bf9b683bc7458c0cc449df38765b6aa0bcf8ff943556bac889bc";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-snake-bounty:ops:";

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
  solvedPayout: 4, totalWon: 5,
};

export type { LeaderEntry, SolveRow };

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
    const clues = createObservable("");   // initial board clues from enclave

    // Current play mode, mirrored into an observable the PlayArea/scene read so
    // the GAS-centric copy can switch to local/practice framing in guest mode.
    // Kept in sync with the launcher-selected framework mode via app.mode.onChange.
    const appMode = createObservable(app.mode.get());

    let session: RewardGameSession | null = null;

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local snake game — no chain/oracle/reward calls.
    const guest = createGuestEngine({
      obs,
      clues,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the PlayArea's mode mirror in sync, and — on switching to guest at the
    // launcher — reset to a clean local lobby and load the off-chain guest board
    // (replacing the on-chain read done on mount).
    app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") void guest.enter();
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
        obs.lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        obs.lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
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
      if (app.mode.isGuest()) {
        const form = (args[0] ?? {}) as { difficulty?: unknown };
        guest.startGame(Number(form.difficulty ?? 0));
        return;
      }
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      const form       = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      if (obs.progressionReady.get() && difficulty < obs.progressionRequiredDifficulty.get()) return;
      obs.isStarting.set(true);
      obs.lastStatus.set(ctx.t("statusStarting"));
      try {
        const started = await startRewardGame(difficulty);
        const gameId  = started.gameId;
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
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
        obs.lastStatus.set(msg);
        ctx.setStatus(msg, "error");
        throw error;
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("selectDifficulty", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      if (app.mode.isGuest()) { guest.selectDifficulty(Number(form.difficulty ?? 0)); return; }
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
      if (app.mode.isGuest()) return;   // scene owns the local snake simulation
      const form = (args[0] ?? {}) as { dir?: unknown };
      const dir  = Number(form.dir);
      if (!Number.isInteger(dir) || dir < 0 || dir > 3) return;
      try { await sendOp({ type: "move", dir }); } catch { /* telemetry */ }
    });

    app.actions.register("submitSolution", async () => {
      if (app.mode.isGuest()) { await guest.submitSolution(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        const settled   = finalized.settlement;
        obs.lastPayout.set(`${settled.payoutGas.toFixed(2)} GAS`);
        obs.lastElapsedMs.set(settled.elapsedMs);
        obs.gameStatus.set(settled.status as "solved" | "expired");
        obs.activeGameId.set("0");
        session = null;
        if (settled.payoutGas > 0) {
          obs.lastStatus.set(ctx.t("statusSolved", { payout: settled.payoutGas.toFixed(2) }));
          ctx.setStatus(obs.lastStatus.get(), "success");
        } else {
          obs.lastStatus.set(ctx.t("statusExpired"));
          ctx.setStatus(ctx.t("statusExpired"), "info");
        }
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard(), refreshProgression()]);
        return finalized.tx;
      } catch (error) {
        const msg = error instanceof Error ? error.message : ctx.t("statusFailed");
        obs.lastStatus.set(msg);
        ctx.setStatus(msg, "error");
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
        session = null;
        obs.lastStatus.set(ctx.t("statusExpired"));
        ctx.setStatus(ctx.t("statusExpired"), "info");
        await refreshBalances();
      } catch (error) {
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
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
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    // ── State returned to PlayArea ────────────────────────────────────────────
    return {
      // `appMode` is the play-mode mirror the PlayArea reads to pick local vs
      // GAS copy; the scene reads it (via bridgeState) to unlock local play.
      state: { ...obs, clues, appMode },
      loadData: async () => {
        // Guest never reads the chain — reset to a local lobby and load the
        // off-chain board instead, so no chain/oracle call is made in guest mode.
        if (app.mode.isGuest()) { await guest.enter(); return; }
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
              app.game.session.applySnapshot(obs, game, statusOf);
              if (obs.gameStatus.get() === "dealt") {
                await resumeSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "committed") {
                void openSession(active, obs.gameDifficulty.get());
              }
            }
          } catch { /* no active game */ }
        }
        await Promise.all([refreshStats(), loadLeaderboard(), refreshProgression()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set(ctx.t("statusReady"));
      },
    };
  },
});

export { gasDisplay };

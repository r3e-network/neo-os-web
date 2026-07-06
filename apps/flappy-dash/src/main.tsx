/**
 * Flappy Dash — endless runner bird game (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: pipe-layout seed delivery, flap recording, and solution finalization.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import type { RewardGameSession } from "@framework/gamefi";
import { mapField } from "@framework/gamefi";
import { parseBigInt } from "@shared/utils/parsers";
import { eventStateValue } from "@shared/utils/chain-events";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { DIFFICULTY_RULES, ENTRY_MEMO, statusOf, gasDisplay } from "./logic/game-rules";
import type { LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-flappy-dash";
const ENGINE_HASH = "401bb3de1c04a8b20c18d35a9f0750f33647361060884f275d6954d3c74c2b1c";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-flappy-dash:ops:";

type TeeOp = { type: "flap" } | { type: "undo" };

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
    target:       rule.targetPipes,
  })),
};

// Flappy-Dash SolveRow adds pipes count
interface FlappyRow extends SolveRow {
  pipes: number;
}

// Flappy Solved event: gameId(0) player(1) difficulty(2) elapsedMs(3) pipes(4) payout(5) totalWon(6)
const SOLVED_SLOTS = {
  gameId: 0, player: 1, difficulty: 2, elapsedMs: 3,
  solvedPayout: 5, totalWon: 6,
};

export type { LeaderEntry };
export type { FlappyRow as SolveRow };

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;

    // ── Reward-game runner ────────────────────────────────────────────────────
    const reward = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    const { start: startRewardGame, finalize: finalizeRewardGame } = reward;

    // ── Standard session observables ──────────────────────────────────────────
    const obs = app.game.session.observables<FlappyRow>(ctx.t);

    // ── Flappy-specific observables ───────────────────────────────────────────
    const seed        = createObservable("");   // deterministic pipe layout seed
    const pipesPassed = createObservable(0);

    let session: RewardGameSession | null = null;

    // ── Data refresh ──────────────────────────────────────────────────────────
    const refreshBalances = async () => {
      try {
        const balances = await reward.balances();
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
      } catch { /* best-effort */ }
    };

    const refreshStats = async () => {
      const { solves, totalWon } = await app.game.stats.load();
      obs.mySolves.set(solves);
      obs.myTotalWon.set(totalWon);
    };

    const loadLeaderboard = async () => {
      const { ranked, mine } = await app.game.leaderboard.load<FlappyRow>(
        "Solved", SOLVED_SLOTS, LEADERBOARD_EVENT_LIMIT,
        (ev) => {
          return { pipes: asNumber(eventStateValue(ev, 4)) };
        },
      );
      obs.leaderboard.set(ranked as LeaderEntry[]);
      obs.myRank.set(ranked.find((e) => e.isUser)?.rank ?? 0);
      obs.myHistory.set(mine);
    };

    // ── Session helpers ───────────────────────────────────────────────────────
    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      obs.lastStatus.set(ctx.t("statusSealing"));
      try {
        const started = await reward.openSession(gameId, difficulty);
        session = started;
        seed.set(String(started.view.seed ?? ""));
        obs.commitment.set(started.commitment);
        const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        pipesPassed.set(0);
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
        const started = await reward.openSession(gameId, difficulty);
        if (obs.commitment.get() && started.commitment !== obs.commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = started;
        seed.set(String(started.view.seed ?? ""));
        obs.commitment.set(started.commitment);
      } catch {
        obs.lastStatus.set(ctx.t("statusDealPending"));
      }
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    app.actions.register("startGame", async (...args: unknown[]) => {
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      const form       = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      obs.isStarting.set(true);
      obs.lastStatus.set(ctx.t("statusStarting"));
      try {
        const started = await startRewardGame(difficulty);
        const gameId  = started.gameId;
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
        seed.set("");
        obs.commitment.set("");
        obs.dealtAt.set(0);
        obs.deadline.set(0);
        pipesPassed.set(0);
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

    app.actions.register("retryDeal", async () => {
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isDealing.get() || obs.gameStatus.get() !== "committed") return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("recordFlap", async (...args: unknown[]) => {
      const form    = (args[0] ?? {}) as { pipes?: unknown };
      const pipes   = Number(form.pipes ?? pipesPassed.get());
      const gameId  = obs.activeGameId.get();
      if (gameId === "0" || !session || obs.gameStatus.get() !== "dealt") return;
      pipesPassed.set(Math.max(pipesPassed.get(), pipes));
      try {
        await reward.recordOp(session, { type: "flap" });
      } catch { /* telemetry only */ }
    });

    app.actions.register("submitSolution", async (...args: unknown[]) => {
      const form       = (args[0] ?? {}) as { stateHash?: unknown; pipes?: unknown };
      const pipes      = Number(form.pipes ?? pipesPassed.get());
      const gameId     = obs.activeGameId.get();
      if (gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        pipesPassed.set(Math.max(pipesPassed.get(), pipes));
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
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
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
      const gameId = obs.activeGameId.get();
      if (gameId === "0") return;
      try {
        await reward.expire(gameId);
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
      if (!app.game.player.scriptHash()) { ctx.setStatus(ctx.t("statusFailed"), "error"); return; }
      if (obs.credit.get() <= 0) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      await withdrawOp.run(async () => {
        await reward.withdrawCredit(app.amount.gasToFixed8(obs.credit.get()));
        await refreshBalances();
      }, { successKey: "creditWithdrawn" });
    });

    app.actions.register("refreshLeaderboard", async () => {
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    // ── State returned to PlayArea ────────────────────────────────────────────
    return {
      state: { ...obs, seed, pipesPassed },
      loadData: async () => {
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
              pipesPassed.set(asNumber(mapField(game, "pipesPassed") ?? 0));
              if (obs.gameStatus.get() === "dealt") {
                await resumeSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "committed") {
                void openSession(active, obs.gameDifficulty.get());
              }
            }
          } catch { /* no active game */ }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set(ctx.t("statusReady"));
      },
    };
  },
});

export { gasDisplay };

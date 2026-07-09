import { createObservable, defineMiniApp } from "@shared/react";
import { parseBigInt } from "@shared/utils/parsers";
import { asNumber } from "@framework/game";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  DIFFICULTY_RULES,
  ENTRY_MEMO,
  ruleOf,
  statusOf,
  gasDisplay,
} from "./logic/game-rules";
import {
  mapField,
  type RewardGameConfig,
  type RewardGameSession,
} from "@framework/gamefi";
import type { HitResult } from "./logic/aim-engine";
import { createGuestEngine } from "./logic/guest-engine";

const appId = "miniapp-aim-master";
// Operator-whitelisted engine pin (sha-256 of the reviewed aim engine wrapper).
const ENGINE_HASH = "701118ccc91941f1e36d8e71bdee6dc2f357ab42acd48fc754664915d570ca34";

const OPS_STORAGE_PREFIX = "miniapp-aim-master:ops:";

const SOLVED_SLOTS = { gameId: 0, player: 1, difficulty: 2, elapsedMs: 3, solvedPayout: 4, totalWon: 5 };

type TeeOp = { type: "aim"; position: number } | { type: "undo" };

const rewardGameConfig: RewardGameConfig = {
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
    target: rule.targetAccuracy,
  })),
  progression: { enabled: true },
};

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const obs = ctx.framework.game.session.observables(ctx.t);

    // Game-specific observables not covered by the shared session surface.
    const pattern = createObservable("");
    const ringsHit = createObservable(0);
    const roundIndex = createObservable(0);
    const roundResults = createObservable<HitResult[]>([]);
    const targetAccuracy = createObservable(3);
    // Mirror app.mode into the play-area state so PhaserPlayArea + scene copy can
    // branch GAS-centric labels into local/practice framing in guest mode.
    const mode = createObservable(app.mode.get());

    // Enclave session context for the active game.
    let session: RewardGameSession | null = null;

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local target engine — no chain/oracle/reward calls.
    const guest = createGuestEngine({
      obs,
      pattern,
      targetAccuracy,
      ringsHit,
      roundIndex,
      roundResults,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the surfaced mode in sync, and on switching to guest reset to a clean
    // local lobby + load the off-chain guest board (replacing the mount read).
    app.mode.onChange((next) => {
      mode.set(next);
      if (next === "guest") void guest.enter();
    });

    // Reward-game plumbing (session open/start/finalize/expire/withdraw + the
    // per-game op-log store) via the framework SDK. The storage prefix pins
    // the pre-migration localStorage keys so in-flight op-logs survive.
    const rewardGame = ctx.framework.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    // The wrapper methods delegate verbatim to the @framework/gamefi
    // startRewardGame / finalizeRewardGame orchestration; keep the canonical
    // SDK verbs at the entry/settlement call sites.
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    const refreshBalances = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      try {
        const balances = await rewardGame.balances(ctx.framework.game.player.scriptHash());
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
      } catch {
        /* keep the previous values — reads are best-effort */
      }
    };

    const refreshStats = async () => {
      if (app.mode.isGuest()) return;
      const { solves, totalWon } = await ctx.framework.game.stats.load();
      obs.mySolves.set(solves);
      obs.myTotalWon.set(totalWon);
    };

    /**
     * Rebuild the global ranking from Solved events.
     */
    const loadLeaderboard = async () => {
      if (app.mode.isGuest()) return;
      const { ranked, mine } = await ctx.framework.game.leaderboard.load("Solved", SOLVED_SLOTS, 200);
      obs.leaderboard.set(ranked);
      const me = ranked.find(e => e.isUser);
      obs.myRank.set(me?.rank ?? 0);
      obs.myHistory.set(mine);
    };

    /**
     * Open the confidential enclave session for an already-active on-chain game:
     * the enclave generates the seeded target oscillation and returns the pattern
     * view + commitment. No on-chain effect.
     */
    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      obs.lastStatus.set(ctx.t("statusSealing"));
      try {
        const started = await rewardGame.openSession(gameId, difficulty);
        session = started;
        pattern.set(String(started.view.pattern ?? ""));
        obs.commitment.set(started.commitment);
        const game = await ctx.framework.chain.readRaw("getGame", [
          ctx.framework.chain.arg.integer(gameId),
        ]);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        obs.lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        obs.lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(message, "error");
        return false;
      } finally {
        obs.isDealing.set(false);
      }
    };

    /** Reattach to an active game after a reload. */
    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const started = await rewardGame.openSession(gameId, difficulty);
        if (obs.commitment.get() && started.commitment !== obs.commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = started;
        pattern.set(String(started.view.pattern ?? ""));
        obs.commitment.set(started.commitment);
      } catch {
        obs.lastStatus.set(ctx.t("statusDealPending"));
      }
    };

    /** Stream a single aim op to the enclave, recording it into the op-log. */
    const streamAim = async (position: number): Promise<void> => {
      if (!session) return;
      const op: TeeOp = { type: "aim", position };
      await rewardGame.recordOp(session, op);
    };

    ctx.framework.actions.register("aimHit", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        ringsHit?: unknown;
        totalRings?: unknown;
        roundResults?: unknown;
        totalPoints?: unknown;
      };
      if (app.mode.isGuest()) { guest.aimHit(form); return; }
      const hitRings = Number(form.ringsHit ?? 0);
      const total = Number(form.totalRings ?? 0);
      const results = (form.roundResults ?? []) as HitResult[];
      ringsHit.set(hitRings);
      roundIndex.set(total);
      roundResults.set(Array.isArray(results) ? results : []);
      // Stream any newly recorded aim taps into the enclave op-log so the kernel
      // can re-derive the accuracy hits from the run at finalize. The position is
      // recorded but NOT trusted for scoring (the enclave clock tick is), so a
      // gauge position reconstructed from the hit's signed offset is sufficient.
      if (session && Array.isArray(results)) {
        const already = rewardGame.storage.load(session.identity.gameId).length;
        for (let i = already; i < results.length; i += 1) {
          const offset = Number(results[i]?.offset ?? 0);
          const position = Math.max(0, Math.min(300, Math.round(150 + (Number.isFinite(offset) ? offset : 0))));
          try {
            await streamAim(position);
          } catch {
            /* telemetry only — the settlement gate re-validates in the enclave */
          }
        }
      }
    });

    ctx.framework.actions.register("startGame", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      if (app.mode.isGuest()) { guest.startGame(Number(form.difficulty ?? 0)); return; }
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      const rule = ruleOf(difficulty);
      obs.isStarting.set(true);
      obs.lastStatus.set(ctx.t("statusStarting"));
      try {
        const started = await startRewardGame(difficulty);
        const gameId = started.gameId;
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
        targetAccuracy.set(rule.targetAccuracy);
        ringsHit.set(0);
        roundIndex.set(0);
        roundResults.set([]);
        pattern.set("");
        obs.commitment.set("");
        obs.dealtAt.set(0);
        obs.deadline.set(0);
        obs.gameStatus.set("committed");
        obs.lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        void openSession(gameId, difficulty);
        return started.tx;
      } catch (error) {
        const message =
          error instanceof Error && "code" in error && error.code === "POOL_LOW"
            ? ctx.t("statusPoolLow")
            : error instanceof Error
              ? error.message
              : ctx.t("statusFailed");
        obs.lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        obs.isStarting.set(false);
      }
    });

    ctx.framework.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isDealing.get() || obs.gameStatus.get() !== "committed") return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    ctx.framework.actions.register("submitSolution", async () => {
      if (app.mode.isGuest()) { await guest.submitSolution(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) {
          await resumeSession(gameId, obs.gameDifficulty.get());
        }
        if (!session) throw new Error(ctx.t("statusFailed"));
        // The accuracy hits are re-derived by the kernel from the sealed aim
        // op-log (engine.replay); the client no longer signs a ring count.
        const finalized = await finalizeRewardGame(session);
        const settled = finalized.settlement;
        obs.lastPayout.set(`${settled.payoutGas.toFixed(2)} GAS`);
        obs.lastElapsedMs.set(settled.elapsedMs);
        obs.gameStatus.set(settled.status);
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
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        obs.lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        obs.isSubmitting.set(false);
      }
    });

    ctx.framework.actions.register("expireGame", async () => {
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
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
        throw error;
      }
    });

    ctx.framework.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      const playerHash = ctx.framework.game.player.scriptHash();
      if (!playerHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      if (obs.credit.get() <= 0) {
        ctx.setStatus(ctx.t("noCreditToWithdraw"), "info");
        return;
      }
      await ctx.framework.notify.guard(async () => {
        await rewardGame.withdrawCredit(ctx.framework.amount.gasToFixed8(obs.credit.get()));
        await refreshBalances();
      }, { successKey: "creditWithdrawn" });
    });

    ctx.framework.actions.register("refreshLeaderboard", async () => {
      if (app.mode.isGuest()) { await guest.refreshLeaderboard(); return; }
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    return {
      state: { ...obs, pattern, patternData: pattern, targetAccuracy, ringsHit, roundIndex, roundResults, mode },
      loadData: async () => {
        // Guest is a purely local game: skip every chain read on mount and load
        // the off-chain guest board instead. (Guarded loaders below also early
        // return, but this keeps guest mount entirely chain-free.)
        if (app.mode.isGuest()) { await guest.enter(); return; }
        await refreshBalances();
        const playerHash = ctx.framework.game.player.scriptHash();
        if (playerHash) {
          try {
            const active = String(
              parseBigInt(
                await ctx.framework.chain.readRaw("activeGameOf", [
                  ctx.framework.chain.arg.hash160(playerHash),
                ]),
              ) ?? "0",
            );
            if (active !== "0") {
              obs.activeGameId.set(active);
              const game = await ctx.framework.chain.readRaw("getGame", [
                ctx.framework.chain.arg.integer(active),
              ]);
              ctx.framework.game.session.applySnapshot(obs, game, statusOf);
              if (obs.gameStatus.get() === "dealt") {
                await resumeSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "committed") {
                void openSession(active, obs.gameDifficulty.get());
              }
            }
          } catch {
            /* no active game recoverable — start fresh */
          }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (obs.gameStatus.get() === "idle") {
          obs.lastStatus.set(ctx.t("statusReady"));
        }
      },
    };
  },
});

export { gasDisplay };

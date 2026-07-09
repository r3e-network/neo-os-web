/**
 * Pet Potion — virtual pet care game (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: pet stat management, care action recording, and solution finalization.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { eventStateValue } from "@shared/utils/chain-events";
import { eventHashMatches as addrEq, mapField, normalizedHash as normHash } from "@framework/gamefi";
import type { RewardGameSession } from "@framework/gamefi";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { DIFFICULTY_RULES, ENTRY_MEMO, ruleOf, statusOf, evolutionStage, MAX_MOVES } from "./logic/game-rules";
import { createGuestEngine } from "./logic/guest-engine";
import type { GameSessionStatus, LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-pet-potion";
const ENGINE_HASH = "bde403c0627304cf8364003fba442ff3b3479f0426c07cff48afb0d13ee3bb03";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-pet-potion:ops:";

type TeeOp = { type: "feed" } | { type: "play" } | { type: "pet" } | { type: "rest" };

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
    target:       rule.targetHappiness,
  })),
  progression: { enabled: true },
};

// Pet-Potion SolveRow adds happinessAchieved
interface PetRow extends SolveRow {
  happinessAchieved: number;
}

export type { LeaderEntry };
export type { PetRow as SolveRow };

function sessionStatusOf(raw: number): GameSessionStatus {
  switch (statusOf(raw)) {
    case "awaiting-bind": return "committed";
    case "playing": return "dealt";
    case "solved": return "solved";
    case "expired": return "expired";
    case "refunded": return "refunded";
    default: return "unknown";
  }
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function petViewOf(view: Record<string, unknown>): Record<string, unknown> {
  const inner = view.view;
  return inner && typeof inner === "object" ? (inner as Record<string, unknown>) : view;
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
    const obs = app.game.session.observables<PetRow>(ctx.t);

    // ── Pet-specific observables ──────────────────────────────────────────────
    const actionsUsed        = createObservable(0);
    const happinessAchieved  = createObservable(0);
    const petHappiness       = createObservable(50);
    const petHunger          = createObservable(50);
    const petEnergy          = createObservable(50);
    const petStage           = createObservable(0);
    const actionHistory      = createObservable<string[]>([]);
    const lastPayoutFixed8   = createObservable<bigint>(0n);

    // ── Play mode (guest | gamefi) ────────────────────────────────────────────
    // Mirror the launcher-selected mode into an observable the PlayArea/scene
    // read, so guest can drop the GAS-at-stake / pool / reward framing while the
    // GAMEFI lobby/copy stays exactly as-is.
    const appMode = createObservable<string>(app.mode.get());

    let session: RewardGameSession | null = null;

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local pet-care simulation — no chain/oracle/reward calls.
    const guest = createGuestEngine({
      obs,
      actionsUsed,
      happinessAchieved,
      petHappiness,
      petHunger,
      petEnergy,
      petStage,
      actionHistory,
      lastPayoutFixed8,
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

    // ── Pet view helpers ──────────────────────────────────────────────────────
    const publishView = (view: { happiness: number; hunger: number; energy: number; stage?: number }): void => {
      const happy = clampStat(view.happiness);
      petHappiness.set(happy);
      petHunger.set(clampStat(view.hunger));
      petEnergy.set(clampStat(view.energy));
      petStage.set(Number.isInteger(view.stage) ? Number(view.stage) : evolutionStage(happy));
      happinessAchieved.set(Math.max(happinessAchieved.get(), happy));
    };

    const applyStepView = (view: Record<string, unknown>): void => {
      const pet = petViewOf(view);
      publishView({
        happiness: Number(pet.happiness ?? petHappiness.get()),
        hunger:    Number(pet.hunger    ?? petHunger.get()),
        energy:    Number(pet.energy    ?? petEnergy.get()),
        stage:     Number(pet.stage     ?? petStage.get()),
      });
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

    // Pet-potion leaderboard uses `player`/`solved` field names.
    const loadLeaderboard = async () => {
      if (app.mode.isGuest()) return;
      const playerHash = app.game.player.scriptHash();
      try {
        const events = await app.chain.events("Solved", { limit: LEADERBOARD_EVENT_LIMIT });
        const bestByPlayer = new Map<string, LeaderEntry>();
        const mine: PetRow[] = [];
        for (const ev of events) {
          const who = normHash(eventStateValue(ev, 1));
          if (!who) continue;
          const totalWon = fromFixed8(parseBigInt(eventStateValue(ev, 6)));
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
              gameId:              String(parseBigInt(eventStateValue(ev, 0)) ?? ""),
              difficulty:          asNumber(eventStateValue(ev, 2)),
              solveMs:             asNumber(eventStateValue(ev, 3)),
              undos:               asNumber(eventStateValue(ev, 4)),
              payout:              `${fromFixed8(parseBigInt(eventStateValue(ev, 5))).toFixed(2)} GAS`,
              happinessAchieved:   asNumber(eventStateValue(ev, 7)),
            });
          }
        }
        const ranked = [...bestByPlayer.values()]
          .sort((a, b) => b.totalWon - a.totalWon)
          .map((e, i) => ({ ...e, rank: i + 1 }));
        obs.leaderboard.set(ranked);
        const me = playerHash ? ranked.find((e) => addrEq(e.address, playerHash)) : undefined;
        obs.myRank.set(me?.rank ?? 0);
        obs.myHistory.set(mine.reverse().slice(0, 12));
      } catch { /* indexer unreachable */ }
    };

    // ── Session helpers ───────────────────────────────────────────────────────
    const openSession = async (gameId: string, difficulty: number): Promise<void> => {
      obs.isDealing.set(true);
      obs.lastStatus.set("shuffling");
      try {
        session = await rewardGame.openSession(gameId, difficulty);
        obs.commitment.set(session.commitment);
        publishView({
          happiness: Number(session.view.happiness ?? 50),
          hunger:    Number(session.view.hunger    ?? 50),
          energy:    Number(session.view.energy    ?? 50),
          stage:     Number(session.view.stage     ?? 0),
        });
        actionsUsed.set(0);
        actionHistory.set([]);
        const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        obs.undosUsed.set(0);
        obs.lastStatus.set("dealt");
        ctx.setStatus(ctx.t("statusDealt"), "success");
      } catch (error) {
        obs.lastStatus.set("deal-pending");
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      } finally {
        obs.isDealing.set(false);
      }
    };

    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const restored = await rewardGame.openSession(gameId, difficulty);
        if (obs.commitment.get() && restored.commitment !== obs.commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = restored;
        obs.commitment.set(restored.commitment);
        publishView({
          happiness: Number(restored.view.happiness ?? 50),
          hunger:    Number(restored.view.hunger    ?? 50),
          energy:    Number(restored.view.energy    ?? 50),
          stage:     Number(restored.view.stage     ?? 0),
        });
        const ops = rewardGame.storage.load(gameId);
        actionsUsed.set(ops.length);
        actionHistory.set(ops.map((op) => op.type));
        await rewardGame.replayOps(restored, ops, (step) => { applyStepView(step.view); });
      } catch {
        obs.lastStatus.set("deal-pending");
      }
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    app.actions.register("startGame", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.startGame(Number(args[0] ?? 0)); return; }
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      const difficulty = Math.max(0, Math.min(2, Number(args[0] ?? 0) || 0));
      obs.isStarting.set(true);
      obs.lastStatus.set("starting");
      try {
        const started = await startRewardGame(difficulty);
        const gameId  = started.gameId;
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
        obs.undosUsed.set(0);
        obs.commitment.set("");
        happinessAchieved.set(0);
        actionsUsed.set(0);
        actionHistory.set([]);
        obs.gameStatus.set("committed");
        obs.lastStatus.set("started");
        await refreshBalances();
        await openSession(gameId, difficulty);
      } catch (error) {
        obs.lastStatus.set("failed");
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || obs.isDealing.get()) return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("recordAction", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.recordAction(args[0] as { type?: string } | undefined); return; }
      const op     = args[0] as TeeOp | undefined;
      const gameId = obs.activeGameId.get();
      if (!op || !op.type || !gameId || gameId === "0" || !session || obs.gameStatus.get() !== "dealt") return;
      if (actionsUsed.get() >= MAX_MOVES) return;
      try {
        const { step, opLog } = await rewardGame.recordOp(session, op);
        applyStepView(step.view);
        actionsUsed.set(opLog.length);
        actionHistory.set([...actionHistory.get(), op.type]);
        if (petHappiness.get() >= ruleOf(obs.gameDifficulty.get()).targetHappiness) {
          obs.lastStatus.set("all-correct");
        }
      } catch (error) {
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      }
    });

    app.actions.register("submitSolution", async () => {
      if (app.mode.isGuest()) { await guest.submitSolution(); return; }
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set("submitting");
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        const settled   = finalized.settlement;
        let achieved    = happinessAchieved.get();
        let undos       = obs.undosUsed.get();
        try {
          const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
          achieved = asNumber(mapField(game, "happinessAchieved"));
          undos    = asNumber(mapField(game, "undos"));
        } catch { /* fall back */ }
        lastPayoutFixed8.set(settled.payoutFixed8);
        obs.lastElapsedMs.set(settled.elapsedMs);
        happinessAchieved.set(achieved);
        obs.undosUsed.set(undos);
        obs.gameStatus.set(settled.status === "unknown" ? "solved" : settled.status as "solved" | "expired");
        session = null;
        obs.activeGameId.set("0");
        if (settled.payoutFixed8 > 0n) {
          obs.lastStatus.set("solved");
          ctx.setStatus(ctx.t("statusSolved", { payout: settled.payoutGas.toFixed(2) }), "success");
        } else {
          obs.lastStatus.set("expired");
          ctx.setStatus(ctx.t("expiredBanner"), "info");
        }
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
      } catch (error) {
        obs.lastStatus.set("failed");
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      } finally {
        obs.isSubmitting.set(false);
      }
    });

    app.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0") return;
      try {
        await rewardGame.expire(gameId);
        obs.gameStatus.set("expired");
        session = null;
        obs.activeGameId.set("0");
        obs.lastStatus.set("expired");
        ctx.setStatus(ctx.t("statusExpired"), "info");
        await refreshBalances();
      } catch (error) {
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      }
    });

    const withdrawOp = app.operations.create("withdrawWinnings");
    app.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
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
      state: {
        ...obs,
        actionsUsed, happinessAchieved,
        petHappiness, petHunger, petEnergy, petStage,
        actionHistory, lastPayoutFixed8, appMode,
      },
      loadData: async () => {
        // Guest is a purely local game: skip every mount-time chain read (the
        // guest engine's enter() already staged a clean local lobby + board).
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
              app.game.session.applySnapshot(obs, game, sessionStatusOf);
              if (obs.gameStatus.get() === "dealt") {
                await resumeSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "committed") {
                await openSession(active, obs.gameDifficulty.get());
              }
            }
          } catch { /* no active game */ }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set("");
      },
    };
  },
});

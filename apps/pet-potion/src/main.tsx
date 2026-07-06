import React from "react";
import { createObservable, defineMiniApp, useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { addressToScriptHash } from "@shared/utils/neo";
import { eventStateValue } from "@shared/utils/chain-events";
import { PlayArea } from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { DIFFICULTY_RULES, ENTRY_MEMO, ruleOf, statusOf, evolutionStage, MAX_MOVES } from "./logic/game-rules";
import {
  eventHashMatches as addrEq,
  mapField,
  normalizedHash as normHash,
  type RewardGameConfig,
  type RewardGameSession,
} from "@shared/gamefi";

const appId = "miniapp-pet-potion";
// Operator-whitelisted engine pin (sha-256 of the reviewed pet engine wrapper).
const ENGINE_HASH = "bde403c0627304cf8364003fba442ff3b3479f0426c07cff48afb0d13ee3bb03";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX = "miniapp-pet-potion:ops:";

type TeeOp = { type: "feed" } | { type: "play" } | { type: "pet" } | { type: "rest" };

const rewardGameConfig: RewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo: ENTRY_MEMO,
  modes: DIFFICULTY_RULES.map((rule) => ({
    id: rule.difficulty,
    entryFixed8: rule.entry,
    rewardFixed8: rule.reward,
    limitMs: rule.limitMs,
    minSolveMs: rule.minSolveMs,
    target: rule.targetHappiness,
  })),
};

interface LeaderEntry {
  player: string;
  totalWon: number;
  solved: number;
}

interface SolveRow {
  gameId: string;
  difficulty: number;
  payout: number;
  solveMs: number;
  undos: number;
  happinessAchieved: number;
}

function asNumber(value: unknown): number {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Read the pet stats view from a step response (nested under view.view). */
function petViewOf(view: Record<string, unknown>): Record<string, unknown> {
  const inner = view.view;
  return inner && typeof inner === "object" ? (inner as Record<string, unknown>) : view;
}

defineMiniApp({
  appId,
  playArea: PetPotionAdapter,
  manifest,
  messages,

  setup(ctx) {
    const credit = createObservable(0);
    const poolFree = createObservable(0);
    const activeGameId = createObservable<string | null>(null);
    const gameStatus = createObservable("idle");
    const gameDifficulty = createObservable(0);
    const commitment = createObservable("");
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
    const undosUsed = createObservable(0);
    const actionsUsed = createObservable(0);
    const lastPayout = createObservable(0);
    const lastElapsedMs = createObservable(0);
    const happinessAchieved = createObservable(0);
    const petHappiness = createObservable(50);
    const petHunger = createObservable(50);
    const petEnergy = createObservable(50);
    const petStage = createObservable(0);
    const leaderboard = createObservable<LeaderEntry[]>([]);
    const myRank = createObservable(0);
    const myTotalWon = createObservable(0);
    const mySolves = createObservable(0);
    const myHistory = createObservable<SolveRow[]>([]);
    const isStarting = createObservable(false);
    const isDealing = createObservable(false);
    const isSubmitting = createObservable(false);
    const lastStatus = createObservable("");
    const actionHistory = createObservable<string[]>([]);

    let session: RewardGameSession | null = null;

    const app = ctx.framework;
    // All reward-game plumbing (entry payment, enclave session, op-log storage,
    // settlement, credit withdrawal) goes through the framework's reward-game
    // runner; the explicit storagePrefix keeps existing op logs resumable.
    const rewardGame = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    // The wrapper methods delegate verbatim to the @shared/gamefi
    // startRewardGame / finalizeRewardGame orchestration; keep the canonical
    // SDK verbs at the entry/settlement call sites.
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    const publishView = (view: { happiness: number; hunger: number; energy: number; stage?: number }): void => {
      const happy = clampStat(view.happiness);
      petHappiness.set(happy);
      petHunger.set(clampStat(view.hunger));
      petEnergy.set(clampStat(view.energy));
      petStage.set(Number.isInteger(view.stage) ? Number(view.stage) : evolutionStage(happy));
      happinessAchieved.set(Math.max(happinessAchieved.get(), happy));
    };

    const playerScriptHash = (): string => {
      const player = app.chain.address.get();
      return player ? addressToScriptHash(player) : "";
    };

    const refreshBalances = async (): Promise<void> => {
      try {
        const balances = await rewardGame.balances(playerScriptHash());
        poolFree.set(balances.poolFreeGas);
        credit.set(balances.creditGas);
      } catch {
        /* keep previous values */
      }
    };

    const refreshStats = async (): Promise<void> => {
      const playerHash = playerScriptHash();
      if (!playerHash) return;
      try {
        const stats = await ctx.framework.chain.readRaw("statsOf", [
          ctx.framework.chain.arg.hash160(playerHash),
        ]);
        mySolves.set(asNumber(mapField(stats, "solved")));
        myTotalWon.set(fromFixed8(parseBigInt(mapField(stats, "totalWon"))));
      } catch {
        /* stats stay stale */
      }
    };

    const loadLeaderboard = async (): Promise<void> => {
      const playerHash = playerScriptHash();
      try {
        const events = await ctx.framework.chain.events("Solved", {
          limit: LEADERBOARD_EVENT_LIMIT,
        });
        const bestByPlayer = new Map<string, LeaderEntry>();
        const mine: SolveRow[] = [];
        for (const ev of events) {
          const who = normHash(eventStateValue(ev, 1));
          if (!who) continue;
          const totalWon = fromFixed8(parseBigInt(eventStateValue(ev, 6)));
          const prior = bestByPlayer.get(who);
          bestByPlayer.set(who, {
            player: String(eventStateValue(ev, 1) ?? who),
            totalWon: Math.max(prior?.totalWon ?? 0, totalWon),
            solved: (prior?.solved ?? 0) + 1,
          });
          if (playerHash && addrEq(eventStateValue(ev, 1), playerHash)) {
            mine.push({
              gameId: String(parseBigInt(eventStateValue(ev, 0)) ?? ""),
              difficulty: asNumber(eventStateValue(ev, 2)),
              solveMs: asNumber(eventStateValue(ev, 3)),
              undos: asNumber(eventStateValue(ev, 4)),
              payout: asNumber(eventStateValue(ev, 5)),
              happinessAchieved: asNumber(eventStateValue(ev, 7)),
            });
          }
        }
        const ranked = [...bestByPlayer.values()].sort((a, b) => b.totalWon - a.totalWon);
        leaderboard.set(ranked);
        const meIdx = playerHash ? ranked.findIndex((e) => addrEq(e.player, playerHash)) : -1;
        myRank.set(meIdx >= 0 ? meIdx + 1 : 0);
        myHistory.set(mine.reverse().slice(0, 12));
      } catch {
        /* indexer unreachable */
      }
    };

    const applyGameSnapshot = (game: unknown): void => {
      gameStatus.set(statusOf(asNumber(mapField(game, "status"))));
      gameDifficulty.set(asNumber(mapField(game, "difficulty")));
      commitment.set(String(mapField(game, "commitment") ?? ""));
      dealtAt.set(asNumber(mapField(game, "dealtAt")));
      deadline.set(asNumber(mapField(game, "deadline")));
      undosUsed.set(asNumber(mapField(game, "undos") ?? 0));
    };

    /**
     * Open the confidential enclave session for an already-active on-chain game:
     * the enclave owns the pet's deterministic stat evolution and returns the
     * current stat view + commitment. No on-chain effect.
     */
    const openSession = async (gameId: string, difficulty: number): Promise<void> => {
      isDealing.set(true);
      lastStatus.set("shuffling");
      try {
        session = await rewardGame.openSession(gameId, difficulty);
        commitment.set(session.commitment);
        publishView({
          happiness: Number(session.view.happiness ?? 50),
          hunger: Number(session.view.hunger ?? 50),
          energy: Number(session.view.energy ?? 50),
          stage: Number(session.view.stage ?? 0),
        });
        actionsUsed.set(0);
        actionHistory.set([]);
        const game = await ctx.framework.chain.readRaw("getGame", [
          ctx.framework.chain.arg.integer(gameId),
        ]);
        dealtAt.set(asNumber(mapField(game, "dealtAt")));
        deadline.set(asNumber(mapField(game, "deadline")));
        gameStatus.set("playing");
        undosUsed.set(0);
        lastStatus.set("dealt");
        ctx.setStatus(ctx.t("statusDealt"), "success");
      } catch (error) {
        lastStatus.set("deal-pending");
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      } finally {
        isDealing.set(false);
      }
    };

    const applyStepView = (view: Record<string, unknown>): void => {
      const pet = petViewOf(view);
      publishView({
        happiness: Number(pet.happiness ?? petHappiness.get()),
        hunger: Number(pet.hunger ?? petHunger.get()),
        energy: Number(pet.energy ?? petEnergy.get()),
        stage: Number(pet.stage ?? petStage.get()),
      });
    };

    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const restored = await rewardGame.openSession(gameId, difficulty);
        if (commitment.get() && restored.commitment !== commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = restored;
        commitment.set(restored.commitment);
        publishView({
          happiness: Number(restored.view.happiness ?? 50),
          hunger: Number(restored.view.hunger ?? 50),
          energy: Number(restored.view.energy ?? 50),
          stage: Number(restored.view.stage ?? 0),
        });
        const ops = rewardGame.storage.load(gameId);
        actionsUsed.set(ops.length);
        actionHistory.set(ops.map((op) => op.type));
        await rewardGame.replayOps(restored, ops, (step) => {
          applyStepView(step.view);
        });
      } catch {
        lastStatus.set("deal-pending");
      }
    };

    ctx.framework.actions.register("startGame", async (...args: unknown[]) => {
      if (isStarting.get() || isDealing.get()) return;
      const difficulty = Math.max(0, Math.min(2, Number(args[0] ?? 0) || 0));
      isStarting.set(true);
      lastStatus.set("starting");
      try {
        const started = await startRewardGame(difficulty);
        const gameId = started.gameId;
        activeGameId.set(gameId);
        gameDifficulty.set(difficulty);
        undosUsed.set(0);
        commitment.set("");
        happinessAchieved.set(0);
        actionsUsed.set(0);
        actionHistory.set([]);
        gameStatus.set("awaiting-bind");
        lastStatus.set("started");
        await refreshBalances();
        await openSession(gameId, difficulty);
      } catch (error) {
        lastStatus.set("failed");
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      } finally {
        isStarting.set(false);
      }
    });

    ctx.framework.actions.register("retryDeal", async () => {
      const gameId = activeGameId.get();
      if (!gameId || isDealing.get()) return;
      await openSession(gameId, gameDifficulty.get());
    });

    ctx.framework.actions.register("recordAction", async (...args: unknown[]) => {
      const op = args[0] as TeeOp | undefined;
      const gameId = activeGameId.get();
      if (!op || !op.type || !gameId || !session || gameStatus.get() !== "playing") return;
      if (actionsUsed.get() >= MAX_MOVES) return;
      try {
        const { step, opLog } = await rewardGame.recordOp(session, op);
        applyStepView(step.view);
        actionsUsed.set(opLog.length);
        actionHistory.set([...actionHistory.get(), op.type]);
        const rule = ruleOf(gameDifficulty.get());
        if (petHappiness.get() >= rule.targetHappiness) {
          lastStatus.set("all-correct");
        }
      } catch (error) {
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      }
    });

    ctx.framework.actions.register("submitSolution", async () => {
      const gameId = activeGameId.get();
      if (!gameId || isSubmitting.get() || gameStatus.get() !== "playing") return;
      isSubmitting.set(true);
      lastStatus.set("submitting");
      try {
        if (!session) await resumeSession(gameId, gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        // The peak happiness is re-derived by the kernel from the sealed care
        // op-log (engine.replay); the client no longer signs a happiness value.
        const finalized = await finalizeRewardGame(session);
        const settled = finalized.settlement;
        let achieved = happinessAchieved.get();
        let undos = undosUsed.get();
        try {
          const game = await ctx.framework.chain.readRaw("getGame", [
            ctx.framework.chain.arg.integer(gameId),
          ]);
          achieved = asNumber(mapField(game, "happinessAchieved"));
          undos = asNumber(mapField(game, "undos"));
        } catch {
          /* fall back to client-tracked values */
        }
        lastPayout.set(Number(settled.payoutFixed8));
        lastElapsedMs.set(settled.elapsedMs);
        happinessAchieved.set(achieved);
        undosUsed.set(undos);
        gameStatus.set(settled.status === "unknown" ? "solved" : settled.status);
        session = null;
        activeGameId.set(null);
        if (settled.payoutFixed8 > 0n) {
          lastStatus.set("solved");
          ctx.setStatus(ctx.t("statusSolved", { payout: settled.payoutGas.toFixed(2) }), "success");
        } else {
          lastStatus.set("expired");
          ctx.setStatus(ctx.t("expiredBanner"), "info");
        }
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
      } catch (error) {
        lastStatus.set("failed");
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      } finally {
        isSubmitting.set(false);
      }
    });

    ctx.framework.actions.register("expireGame", async () => {
      const gameId = activeGameId.get();
      if (!gameId) return;
      try {
        await rewardGame.expire(gameId);
        gameStatus.set("expired");
        session = null;
        activeGameId.set(null);
        lastStatus.set("expired");
        ctx.setStatus(ctx.t("expiredBanner"), "info");
        await refreshBalances();
      } catch (error) {
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      }
    });

    // Framework operation wrapper: same semantics as the old notify.guard —
    // success toast only after a real withdrawal, error toast + swallow on
    // failure — while the no-credit early return stays silent.
    const withdrawOp = app.operations.create("withdrawWinnings");

    ctx.framework.actions.register("withdrawWinnings", async () => {
      if (credit.get() <= 0) {
        ctx.setStatus(ctx.t("noCreditToWithdraw"), "info");
        return;
      }
      await withdrawOp.run(async () => {
        await rewardGame.withdrawCredit(app.amount.gasToFixed8(credit.get()));
        await refreshBalances();
      }, { successKey: "creditWithdrawn" });
    });

    ctx.framework.actions.register("refreshLeaderboard", async () => {
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    return {
      state: {
        credit, poolFree, activeGameId, gameStatus, gameDifficulty, commitment, dealtAt,
        deadline, undosUsed, actionsUsed, lastPayout, lastElapsedMs, happinessAchieved,
        petHappiness, petHunger, petEnergy, petStage, leaderboard, myRank, myTotalWon,
        mySolves, myHistory, isStarting, isDealing, isSubmitting, lastStatus, actionHistory,
      },
      loadData: async () => {
        await refreshBalances();
        const playerHash = playerScriptHash();
        if (playerHash) {
          try {
            const active = String(parseBigInt(await ctx.framework.chain.readRaw("activeGameOf", [
              ctx.framework.chain.arg.hash160(playerHash),
            ])) ?? "0");
            if (active !== "0") {
              activeGameId.set(active);
              applyGameSnapshot(await ctx.framework.chain.readRaw("getGame", [ctx.framework.chain.arg.integer(active)]));
              if (gameStatus.get() === "playing") {
                await resumeSession(active, gameDifficulty.get());
              } else if (gameStatus.get() === "awaiting-bind") {
                await openSession(active, gameDifficulty.get());
              }
            }
          } catch {
            /* start fresh */
          }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (gameStatus.get() === "idle") lastStatus.set("ready");
      },
    };
  },
});

function PetPotionAdapter({ state, dispatch }: PlayAreaProps) {
  const { str, num, bool, val } = useStateBindings(state);
  const snapshot = {
    credit: num("credit", 0),
    poolFree: num("poolFree", 0),
    activeGameId: (val<string | null>("activeGameId", null) ?? null) as string | null,
    gameStatus: str("gameStatus", "idle"),
    gameDifficulty: num("gameDifficulty", 0),
    commitment: str("commitment", ""),
    dealtAt: num("dealtAt", 0),
    deadline: num("deadline", 0),
    undosUsed: num("undosUsed", 0),
    actionsUsed: num("actionsUsed", 0),
    lastPayout: num("lastPayout", 0),
    lastElapsedMs: num("lastElapsedMs", 0),
    happinessAchieved: num("happinessAchieved", 0),
    petHappiness: num("petHappiness", 50),
    petHunger: num("petHunger", 50),
    petEnergy: num("petEnergy", 50),
    petStage: num("petStage", 0),
    leaderboard: val<LeaderEntry[]>("leaderboard", []) ?? [],
    myRank: num("myRank", 0),
    myTotalWon: num("myTotalWon", 0),
    mySolves: num("mySolves", 0),
    myHistory: val<SolveRow[]>("myHistory", []) ?? [],
    isStarting: bool("isStarting"),
    isDealing: bool("isDealing"),
    isSubmitting: bool("isSubmitting"),
    lastStatus: str("lastStatus", ""),
    actionHistory: val<string[]>("actionHistory", []) ?? [],
  };
  const actions = {
    startGame: (difficulty: number) => dispatch("startGame", difficulty),
    retryDeal: () => dispatch("retryDeal"),
    recordAction: (op: TeeOp) => dispatch("recordAction", op),
    submitSolution: () => dispatch("submitSolution"),
    expireGame: () => dispatch("expireGame"),
    withdrawWinnings: () => dispatch("withdrawWinnings"),
    refreshLeaderboard: () => dispatch("refreshLeaderboard"),
  };
  return <PlayArea state={snapshot} actions={actions} />;
}

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
import { DIFFICULTY_RULES, ENTRY_MEMO, statusOf } from "./logic/game-rules";
import {
  eventHashMatches as addrEq,
  mapField,
  normalizedHash as normHash,
  type RewardGameConfig,
  type RewardGameSession,
} from "@shared/gamefi";

const appId = "miniapp-color-clash";
// Operator-whitelisted engine pin (sha-256 of the reviewed color engine wrapper).
const ENGINE_HASH = "074ec7a8437bb8dbdb7c5aca5ccdad1c970e07f1cdbf06358b89638d90539013";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX = "miniapp-color-clash:ops:";

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
  seqAchieved: number;
}

type PressOp = { type: "press"; color: number };

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
    target: rule.targetSeq,
  })),
};

function asNumber(value: unknown): number {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
}

defineMiniApp({
  appId,
  playArea: ColorClashAdapter,
  manifest,
  messages,

  setup(ctx) {
    const credit = createObservable(0);
    const poolFree = createObservable(0);
    const activeGameId = createObservable<string | null>(null);
    const gameStatus = createObservable("idle");
    const gameDifficulty = createObservable(0);
    // Growing revealed prefix — built up from per-move `reveal` fields, NEVER the
    // full sequence at start (reveal-per-move privacy model).
    const sequence = createObservable("");
    const playerSequence = createObservable("");
    const commitment = createObservable("");
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
    const undosUsed = createObservable(0);
    const lastPayout = createObservable(0);
    const lastElapsedMs = createObservable(0);
    const seqAchieved = createObservable(0);
    const leaderboard = createObservable<LeaderEntry[]>([]);
    const myRank = createObservable(0);
    const myTotalWon = createObservable(0);
    const mySolves = createObservable(0);
    const myHistory = createObservable<SolveRow[]>([]);
    const isStarting = createObservable(false);
    const isDealing = createObservable(false);
    const isSubmitting = createObservable(false);
    const lastStatus = createObservable("");

    let session: RewardGameSession | null = null;

    const app = ctx.framework;
    // All reward-game plumbing (entry payment, enclave session, op-log storage,
    // settlement, credit withdrawal) goes through the framework's reward-game
    // runner; the explicit storagePrefix keeps existing op logs resumable.
    const rewardGame = app.game.reward<PressOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    // The wrapper methods delegate verbatim to the @shared/gamefi
    // startRewardGame / finalizeRewardGame orchestration; keep the canonical
    // SDK verbs at the entry/settlement call sites.
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

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
        /* keep the previous values */
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
              seqAchieved: asNumber(eventStateValue(ev, 7)),
            });
          }
        }
        const ranked = [...bestByPlayer.values()].sort((a, b) => b.totalWon - a.totalWon);
        leaderboard.set(ranked);
        const meIdx = playerHash
          ? ranked.findIndex((entry) => addrEq(entry.player, playerHash))
          : -1;
        myRank.set(meIdx >= 0 ? meIdx + 1 : 0);
        myHistory.set(mine.reverse().slice(0, 12));
      } catch {
        /* indexer unreachable — the run stays playable without rankings */
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
     * the enclave seals the colour sequence and returns only the commitment. The
     * revealed prefix grows one colour per completed round (reveal-per-round). No
     * on-chain effect.
     */
    const openSession = async (gameId: string, difficulty: number): Promise<void> => {
      isDealing.set(true);
      lastStatus.set("shuffling");
      try {
        session = await rewardGame.openSession(gameId, difficulty);
        commitment.set(session.commitment);
        // Reveal-per-round: start with the revealed prefix the enclave exposed
        // (empty by policy); further colours drip via step `reveal` fields.
        sequence.set(String(session.view.sequence ?? ""));
        playerSequence.set("");
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

    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const restored = await rewardGame.openSession(gameId, difficulty);
        if (commitment.get() && restored.commitment !== commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = restored;
        commitment.set(restored.commitment);
        // Rebuild the revealed prefix from the persisted op log length: the player
        // has already seen (correct presses + 1) colours.
        const ops = rewardGame.storage.load(gameId);
        if (ops.length > 0) playerSequence.set(ops.map((op) => String(op.color)).join(""));
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
        sequence.set("");
        playerSequence.set("");
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

    ctx.framework.actions.register("recordPress", async (...args: unknown[]) => {
      const color = Number(args[0]);
      const gameId = activeGameId.get();
      if (!Number.isInteger(color) || color < 0 || color > 3) return;
      if (!gameId || !session || gameStatus.get() !== "playing") return;
      try {
        const previousOps = rewardGame.storage.load(gameId);
        const { step } = await rewardGame.recordOp(session, {
          type: "press",
          color,
        });
        const view = step.view;
        if (view.correct !== true || view.wrong === true) {
          rewardGame.storage.save(gameId, previousOps);
          lastStatus.set("wrong");
          ctx.setStatus(ctx.t("wrongPress"), "error");
          return;
        }
        const nextPlayer = playerSequence.get() + String(color);
        playerSequence.set(nextPlayer);
        if (view.reveal !== undefined && view.reveal !== null) {
          // A new colour was unlocked: extend the revealed prefix and reset the
          // player's echo for the next round.
          sequence.set(sequence.get() + String(view.reveal));
          playerSequence.set("");
          seqAchieved.set(Number(view.round ?? seqAchieved.get()));
        } else if (nextPlayer.length >= sequence.get().length) {
          // Completed the current revealed prefix without a new reveal — round done.
          seqAchieved.set(sequence.get().length);
          playerSequence.set("");
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
        // The longest completed round is re-derived by the kernel from the sealed
        // press op-log (engine.replay); the client no longer signs a sequence.
        const finalized = await finalizeRewardGame(session);
        const settled = finalized.settlement;
        let achieved = seqAchieved.get();
        let undos = undosUsed.get();
        try {
          const game = await ctx.framework.chain.readRaw("getGame", [
            ctx.framework.chain.arg.integer(gameId),
          ]);
          achieved = asNumber(mapField(game, "seqAchieved"));
          undos = asNumber(mapField(game, "undos"));
        } catch {
          /* fall back to the client-tracked values */
        }
        lastPayout.set(Number(settled.payoutFixed8));
        lastElapsedMs.set(settled.elapsedMs);
        seqAchieved.set(achieved);
        undosUsed.set(undos);
        gameStatus.set(settled.status === "unknown" ? "solved" : settled.status);
        session = null;
        activeGameId.set(null);
        if (settled.payoutFixed8 > 0n) {
          lastStatus.set("solved");
          ctx.setStatus(
            ctx.t("statusSolved", { payout: settled.payoutGas.toFixed(2) }),
            "success",
          );
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
        credit,
        poolFree,
        activeGameId,
        gameStatus,
        gameDifficulty,
        sequence,
        playerSequence,
        commitment,
        dealtAt,
        deadline,
        undosUsed,
        lastPayout,
        lastElapsedMs,
        seqAchieved,
        leaderboard,
        myRank,
        myTotalWon,
        mySolves,
        myHistory,
        isStarting,
        isDealing,
        isSubmitting,
        lastStatus,
      },
      loadData: async () => {
        await refreshBalances();
        const playerHash = playerScriptHash();
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
              activeGameId.set(active);
              const game = await ctx.framework.chain.readRaw("getGame", [
                ctx.framework.chain.arg.integer(active),
              ]);
              applyGameSnapshot(game);
              if (gameStatus.get() === "playing") {
                await resumeSession(active, gameDifficulty.get());
              } else if (gameStatus.get() === "awaiting-bind") {
                await openSession(active, gameDifficulty.get());
              }
            }
          } catch {
            /* no active game recoverable — start fresh */
          }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (gameStatus.get() === "idle") {
          lastStatus.set("ready");
        }
      },
    };
  },
});

/**
 * Adapter: MiniAppRoot renders playArea with { t, state, dispatch }. The color
 * clash scene is written against a plain { state, actions } contract (and its
 * own useT()), so this bridge reads the observables into a plain snapshot and
 * maps the scene's action callbacks onto dispatch.
 */
function ColorClashAdapter({ state, dispatch }: PlayAreaProps) {
  const { str, num, bool, val } = useStateBindings(state);
  const snapshot = {
    credit: num("credit", 0),
    poolFree: num("poolFree", 0),
    activeGameId: (val<string | null>("activeGameId", null) ?? null) as string | null,
    gameStatus: str("gameStatus", "idle"),
    gameDifficulty: num("gameDifficulty", 0),
    sequence: str("sequence", ""),
    playerSequence: str("playerSequence", ""),
    commitment: str("commitment", ""),
    dealtAt: num("dealtAt", 0),
    deadline: num("deadline", 0),
    undosUsed: num("undosUsed", 0),
    lastPayout: num("lastPayout", 0),
    lastElapsedMs: num("lastElapsedMs", 0),
    seqAchieved: num("seqAchieved", 0),
    leaderboard: val<LeaderEntry[]>("leaderboard", []) ?? [],
    myRank: num("myRank", 0),
    myTotalWon: num("myTotalWon", 0),
    mySolves: num("mySolves", 0),
    myHistory: val<SolveRow[]>("myHistory", []) ?? [],
    isStarting: bool("isStarting"),
    isDealing: bool("isDealing"),
    isSubmitting: bool("isSubmitting"),
    lastStatus: str("lastStatus", ""),
  };
  const actions = {
    startGame: (difficulty: number) => dispatch("startGame", difficulty),
    retryDeal: () => dispatch("retryDeal"),
    recordPress: (color: number) => dispatch("recordPress", color),
    submitSolution: () => dispatch("submitSolution"),
    expireGame: () => dispatch("expireGame"),
    withdrawWinnings: () => dispatch("withdrawWinnings"),
    refreshLeaderboard: () => dispatch("refreshLeaderboard"),
  };
  return <PlayArea state={snapshot} actions={actions} />;
}

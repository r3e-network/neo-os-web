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
import { DIFFICULTY_RULES, ENTRY_MEMO, statusOf, emptyBoard, BOARD_SIZE } from "./logic/game-rules";
import {
  eventHashMatches as addrEq,
  mapField,
  normalizedHash as normHash,
  type RewardGameConfig,
  type RewardGameSession,
} from "@shared/gamefi";

const appId = "miniapp-merge-kingdom";
// Operator-whitelisted engine pin (sha-256 of the reviewed merge engine wrapper).
const ENGINE_HASH = "a918acd944bd4fb5b893a8ad70b1ae0193147ff6b39fed0791192ff3895cf700";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX = "miniapp-merge-kingdom:ops:";

type TeeOp =
  | { type: "move"; from: { row: number; col: number }; to: { row: number; col: number } }
  | { type: "undo" };

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
    target: rule.targetTile,
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
  tileAchieved: number;
}

function asNumber(value: unknown): number {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
}

/** Highest tile on the board. */
function highestTile(board: number[][]): number {
  let best = 0;
  for (const row of board) for (const cell of row) if (cell > best) best = cell;
  return best;
}

defineMiniApp({
  appId,
  playArea: MergeKingdomAdapter,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const credit = createObservable(0);
    const poolFree = createObservable(0);
    const activeGameId = createObservable<string | null>(null);
    const gameStatus = createObservable("idle");
    const gameDifficulty = createObservable(0);
    const board = createObservable<number[][]>([]);
    const commitment = createObservable("");
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
    const undosUsed = createObservable(0);
    const lastPayout = createObservable(0);
    const lastElapsedMs = createObservable(0);
    const tileAchieved = createObservable(0);
    const moveCount = createObservable(0);
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

    // Reward-game plumbing (start/session/finalize/expire/withdraw + the
    // per-game op-log store) via the framework SDK. The storage prefix pins
    // the pre-migration localStorage keys so in-flight op-logs survive.
    const rewardGame = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    // The wrapper methods delegate verbatim to the @shared/gamefi
    // startRewardGame / finalizeRewardGame orchestration; keep the canonical
    // SDK verbs at the entry/settlement call sites.
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    const publishBoard = (next: number[][]): void => {
      board.set(next.map((row) => [...row]));
      tileAchieved.set(highestTile(next));
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
        const stats = await app.chain.readRaw("statsOf", [
          app.chain.arg.hash160(playerHash),
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
        const events = await app.chain.events("Solved", {
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
              tileAchieved: asNumber(eventStateValue(ev, 7)),
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
     * the enclave owns the board state and returns the visible board + commitment.
     * No on-chain effect.
     */
    const openSession = async (gameId: string, difficulty: number): Promise<void> => {
      isDealing.set(true);
      lastStatus.set("shuffling");
      try {
        session = await rewardGame.openSession(gameId, difficulty);
        commitment.set(session.commitment);
        const grid = (session.view.board ?? []) as number[][];
        publishBoard(Array.isArray(grid) && grid.length === 4 ? grid : emptyBoard());
        moveCount.set(0);
        const game = await app.chain.readRaw("getGame", [
          app.chain.arg.integer(gameId),
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
        const ops = rewardGame.storage.load(gameId);
        moveCount.set(ops.length);
        // Replay the persisted op log to restore the visible board.
        const startGrid = (restored.view.board ?? []) as number[][];
        let live = Array.isArray(startGrid) && startGrid.length === 4 ? startGrid : emptyBoard();
        await rewardGame.replayOps(restored, ops, (step) => {
          const grid = step.view.board as number[][] | undefined;
          if (grid && grid.length === 4) live = grid;
        });
        publishBoard(live);
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
        board.set(emptyBoard());
        tileAchieved.set(0);
        moveCount.set(0);
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

    ctx.framework.actions.register("recordMove", async (...args: unknown[]) => {
      const fromRow = Number(args[0]);
      const fromCol = Number(args[1]);
      const toRow = Number(args[2]);
      const toCol = Number(args[3]);
      const gameId = activeGameId.get();
      if (!gameId || !session || gameStatus.get() !== "playing") return;
      const inRange = (v: number) => Number.isInteger(v) && v >= 0 && v < BOARD_SIZE;
      if (![fromRow, fromCol, toRow, toCol].every(inRange)) return;
      const op: TeeOp = {
        type: "move",
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
      };
      try {
        const { step, opLog } = await rewardGame.recordOp(session, op);
        const grid = step.view.board as number[][] | undefined;
        if (grid && grid.length === 4) publishBoard(grid);
        moveCount.set(opLog.length);
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
        // The highest tile is re-derived by the kernel from the sealed move
        // op-log (engine.replay); the client no longer signs a tile value.
        const finalized = await finalizeRewardGame(session);
        const settled = finalized.settlement;
        let achieved = tileAchieved.get();
        let undos = undosUsed.get();
        try {
          const game = await app.chain.readRaw("getGame", [
            app.chain.arg.integer(gameId),
          ]);
          achieved = asNumber(mapField(game, "tileAchieved"));
          undos = asNumber(mapField(game, "undos"));
        } catch {
          /* fall back to client-tracked values */
        }
        lastPayout.set(Number(settled.payoutFixed8));
        lastElapsedMs.set(settled.elapsedMs);
        tileAchieved.set(achieved);
        undosUsed.set(undos);
        gameStatus.set(settled.status === "unknown" ? "solved" : settled.status);
        session = null;
        activeGameId.set(null);
        if (settled.payoutFixed8 > 0n) {
          lastStatus.set("solved");
          ctx.setStatus(ctx.t("statusSolved", { payout: settled.payoutGas.toFixed(2) }), "success");
        } else {
          lastStatus.set("expired");
          ctx.setStatus(ctx.t("statusExpired"), "info");
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
        ctx.setStatus(ctx.t("statusExpired"), "info");
        await refreshBalances();
      } catch (error) {
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      }
    });

    ctx.framework.actions.register("withdrawWinnings", async () => {
      if (credit.get() <= 0) {
        ctx.setStatus(ctx.t("noCreditToWithdraw"), "info");
        return;
      }
      await ctx.services.notify.guard(async () => {
        await rewardGame.withdrawCredit(app.amount.gasToFixed8(credit.get()));
        await refreshBalances();
      }, "creditWithdrawn");
    });

    ctx.framework.actions.register("refreshLeaderboard", async () => {
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    return {
      state: {
        credit, poolFree, activeGameId, gameStatus, gameDifficulty, board, commitment,
        dealtAt, deadline, undosUsed, lastPayout, lastElapsedMs, tileAchieved, moveCount,
        leaderboard, myRank, myTotalWon, mySolves, myHistory, isStarting, isDealing,
        isSubmitting, lastStatus, walletConnected: ctx.services.chain.isConnected,
      },
      loadData: async () => {
        await refreshBalances();
        const playerHash = playerScriptHash();
        if (playerHash) {
          try {
            const active = String(parseBigInt(await app.chain.readRaw("activeGameOf", [
              app.chain.arg.hash160(playerHash),
            ])) ?? "0");
            if (active !== "0") {
              activeGameId.set(active);
              applyGameSnapshot(await app.chain.readRaw("getGame", [app.chain.arg.integer(active)]));
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

function MergeKingdomAdapter({ state, dispatch }: PlayAreaProps) {
  const { str, num, bool, val } = useStateBindings(state);
  const snapshot = {
    credit: num("credit", 0),
    poolFree: num("poolFree", 0),
    activeGameId: (val<string | null>("activeGameId", null) ?? null) as string | null,
    gameStatus: str("gameStatus", "idle"),
    gameDifficulty: num("gameDifficulty", 0),
    board: val<number[][]>("board", []) ?? [],
    commitment: str("commitment", ""),
    dealtAt: num("dealtAt", 0),
    deadline: num("deadline", 0),
    undosUsed: num("undosUsed", 0),
    lastPayout: num("lastPayout", 0),
    lastElapsedMs: num("lastElapsedMs", 0),
    tileAchieved: num("tileAchieved", 0),
    moveCount: num("moveCount", 0),
    leaderboard: val<LeaderEntry[]>("leaderboard", []) ?? [],
    myRank: num("myRank", 0),
    myTotalWon: num("myTotalWon", 0),
    mySolves: num("mySolves", 0),
    myHistory: val<SolveRow[]>("myHistory", []) ?? [],
    isStarting: bool("isStarting"),
    isDealing: bool("isDealing"),
    isSubmitting: bool("isSubmitting"),
    walletConnected: bool("walletConnected"),
    lastStatus: str("lastStatus", ""),
  };
  const actions = {
    startGame: (difficulty: number) => dispatch("startGame", difficulty),
    retryDeal: () => dispatch("retryDeal"),
    recordMove: (fromRow: number, fromCol: number, toRow: number, toCol: number) =>
      dispatch("recordMove", fromRow, fromCol, toRow, toCol),
    submitSolution: () => dispatch("submitSolution"),
    expireGame: () => dispatch("expireGame"),
    withdrawWinnings: () => dispatch("withdrawWinnings"),
    refreshLeaderboard: () => dispatch("refreshLeaderboard"),
  };
  return <PlayArea state={snapshot} actions={actions} />;
}

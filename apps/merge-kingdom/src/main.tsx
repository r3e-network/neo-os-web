/**
 * Merge Kingdom — tile-merging puzzle (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: board management, tile-move recording, and solution finalization.
 */
import React from "react";
import { createObservable, defineMiniApp, useStateBindings } from "@shared/react";
import type { PlayAreaProps } from "@shared/react";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { eventStateValue } from "@shared/utils/chain-events";
import { eventHashMatches as addrEq, mapField, normalizedHash as normHash } from "@framework/gamefi";
import type { RewardGameSession } from "@framework/gamefi";
import { PlayArea } from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { DIFFICULTY_RULES, ENTRY_MEMO, statusOf, emptyBoard, BOARD_SIZE } from "./logic/game-rules";
import type { GameSessionStatus, LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-merge-kingdom";
const ENGINE_HASH = "a918acd944bd4fb5b893a8ad70b1ae0193147ff6b39fed0791192ff3895cf700";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-merge-kingdom:ops:";

type TeeOp =
  | { type: "move"; from: { row: number; col: number }; to: { row: number; col: number } }
  | { type: "undo" };

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
    target:       rule.targetTile,
  })),
};

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

// Merge-Kingdom SolveRow adds tileAchieved (unique field)
interface MergeRow extends SolveRow {
  tileAchieved: number;
}

export type { LeaderEntry };
export type { MergeRow as SolveRow };

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

    // ── Reward-game runner ────────────────────────────────────────────────────
    const rewardGame = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    // ── Standard session observables ──────────────────────────────────────────
    const obs = app.game.session.observables<MergeRow>(ctx.t);

    // ── Merge-kingdom specific observables ───────────────────────────────────
    const board        = createObservable<number[][]>([]);
    const tileAchieved = createObservable(0);
    const moveCount    = createObservable(0);
    // lastPayout is a fixed8 bigint in this game
    const lastPayoutFixed8 = createObservable<bigint>(0n);

    let session: RewardGameSession | null = null;

    const publishBoard = (next: number[][]): void => {
      board.set(next.map((row) => [...row]));
      tileAchieved.set(highestTile(next));
    };

    // ── Data refresh ──────────────────────────────────────────────────────────
    const refreshBalances = async () => {
      try {
        const balances = await rewardGame.balances(app.game.player.scriptHash());
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
      } catch { /* best-effort */ }
    };

    const refreshStats = async () => {
      const { solves, totalWon } = await app.game.stats.load();
      obs.mySolves.set(solves);
      obs.myTotalWon.set(totalWon);
    };

    // Merge-kingdom leaderboard uses `player`/`solved` field names (not standard).
    const loadLeaderboard = async () => {
      const playerHash = app.game.player.scriptHash();
      try {
        const events = await app.chain.events("Solved", { limit: LEADERBOARD_EVENT_LIMIT });
        const bestByPlayer = new Map<string, LeaderEntry>();
        const mine: MergeRow[] = [];
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
              gameId:       String(parseBigInt(eventStateValue(ev, 0)) ?? ""),
              difficulty:   asNumber(eventStateValue(ev, 2)),
              solveMs:      asNumber(eventStateValue(ev, 3)),
              undos:        asNumber(eventStateValue(ev, 4)),
              payout:       `${fromFixed8(parseBigInt(eventStateValue(ev, 5))).toFixed(2)} GAS`,
              tileAchieved: asNumber(eventStateValue(ev, 7)),
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
        const grid = (session.view.board ?? []) as number[][];
        publishBoard(Array.isArray(grid) && grid.length === 4 ? grid : emptyBoard());
        moveCount.set(0);
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
        const ops = rewardGame.storage.load(gameId);
        moveCount.set(ops.length);
        const startGrid = (restored.view.board ?? []) as number[][];
        let live = Array.isArray(startGrid) && startGrid.length === 4 ? startGrid : emptyBoard();
        await rewardGame.replayOps(restored, ops, (step) => {
          const grid = step.view.board as number[][] | undefined;
          if (grid && grid.length === 4) live = grid;
        });
        publishBoard(live);
      } catch {
        obs.lastStatus.set("deal-pending");
      }
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    app.actions.register("startGame", async (...args: unknown[]) => {
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
        board.set(emptyBoard());
        tileAchieved.set(0);
        moveCount.set(0);
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
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || obs.isDealing.get()) return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("recordMove", async (...args: unknown[]) => {
      const fromRow = Number(args[0]);
      const fromCol = Number(args[1]);
      const toRow   = Number(args[2]);
      const toCol   = Number(args[3]);
      const gameId  = obs.activeGameId.get();
      if (!gameId || gameId === "0" || !session || obs.gameStatus.get() !== "dealt") return;
      const inRange = (v: number) => Number.isInteger(v) && v >= 0 && v < BOARD_SIZE;
      if (![fromRow, fromCol, toRow, toCol].every(inRange)) return;
      try {
        const { step, opLog } = await rewardGame.recordOp(session, {
          type: "move", from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol },
        });
        const grid = step.view.board as number[][] | undefined;
        if (grid && grid.length === 4) publishBoard(grid);
        moveCount.set(opLog.length);
      } catch (error) {
        ctx.setStatus(error instanceof Error ? error.message : ctx.t("statusFailed"), "error");
      }
    });

    app.actions.register("submitSolution", async () => {
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set("submitting");
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        const settled   = finalized.settlement;
        let achieved    = tileAchieved.get();
        let undos       = obs.undosUsed.get();
        try {
          const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
          achieved = asNumber(mapField(game, "tileAchieved"));
          undos    = asNumber(mapField(game, "undos"));
        } catch { /* fall back */ }
        lastPayoutFixed8.set(settled.payoutFixed8);
        obs.lastElapsedMs.set(settled.elapsedMs);
        tileAchieved.set(achieved);
        obs.undosUsed.set(undos);
        obs.gameStatus.set(settled.status === "unknown" ? "solved" : settled.status as "solved" | "expired");
        session = null;
        obs.activeGameId.set("0");
        if (settled.payoutFixed8 > 0n) {
          obs.lastStatus.set("solved");
          ctx.setStatus(ctx.t("statusSolved", { payout: settled.payoutGas.toFixed(2) }), "success");
        } else {
          obs.lastStatus.set("expired");
          ctx.setStatus(ctx.t("statusExpired"), "info");
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
      if (obs.credit.get() <= 0) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      await withdrawOp.run(async () => {
        await rewardGame.withdrawCredit(app.amount.gasToFixed8(obs.credit.get()));
        await refreshBalances();
      }, { successKey: "creditWithdrawn" });
    });

    app.actions.register("refreshLeaderboard", async () => {
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    // ── State returned to PlayArea ────────────────────────────────────────────
    return {
      state: { ...obs, board, tileAchieved, moveCount, lastPayoutFixed8, walletConnected: app.chain.address },
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

// ── Adapter ───────────────────────────────────────────────────────────────────
function MergeKingdomAdapter(props: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(props.state);
  const state: import("./PlayArea").AppState = {
    credit:          num("credit"),
    poolFree:        num("poolFree"),
    activeGameId:    val<string | null>("activeGameId"),
    gameStatus:      str("gameStatus", "idle"),
    gameDifficulty:  num("gameDifficulty"),
    board:           (val("board") ?? []) as number[][],
    commitment:      str("commitment", ""),
    dealtAt:         num("dealtAt"),
    deadline:        num("deadline"),
    undosUsed:       num("undosUsed"),
    lastPayout:      Number(val<bigint>("lastPayoutFixed8", 0n) ?? 0n),
    lastElapsedMs:   num("lastElapsedMs"),
    tileAchieved:    num("tileAchieved"),
    moveCount:       num("moveCount"),
    leaderboard:     (val("leaderboard") ?? []) as import("./PlayArea").AppState["leaderboard"],
    myRank:          num("myRank"),
    myTotalWon:      num("myTotalWon"),
    mySolves:        num("mySolves"),
    myHistory:       (val("myHistory") ?? []) as import("./PlayArea").AppState["myHistory"],
    isStarting:      bool("isStarting"),
    isDealing:       bool("isDealing"),
    isSubmitting:    bool("isSubmitting"),
    walletConnected: bool("walletConnected"),
    lastStatus:      str("lastStatus", ""),
  };

  const actions: import("./PlayArea").Actions = {
    startGame:         (difficulty) => props.dispatch("startGame", difficulty),
    retryDeal:         ()           => props.dispatch("retryDeal"),
    recordMove:        (fr, fc, tr, tc) => props.dispatch("recordMove", fr, fc, tr, tc),
    submitSolution:    ()           => props.dispatch("submitSolution"),
    expireGame:        ()           => props.dispatch("expireGame"),
    withdrawWinnings:  ()           => props.dispatch("withdrawWinnings"),
    refreshLeaderboard: ()          => props.dispatch("refreshLeaderboard"),
  };

  return React.createElement(PlayArea, { state, actions });
}

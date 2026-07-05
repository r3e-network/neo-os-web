import { createObservable, defineMiniApp } from "@shared/react";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { addressToScriptHash } from "@shared/utils/neo";
import { eventStateValue } from "@shared/utils/chain-events";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { DIFFICULTY_RULES, ENTRY_MEMO, statusOf, gasDisplay } from "./logic/game-rules";
import { forgetBoard } from "./logic/board-store";
import {
  createLocalStorageRewardGameStorage,
  eventHashMatches as addrEq,
  expireRewardGame,
  finalizeRewardGame,
  mapField,
  normalizedHash as normHash,
  openRewardGameSession,
  recordRewardGameOp,
  refreshRewardGameBalances,
  startRewardGame,
  withdrawRewardCredit,
  type RewardGameConfig,
  type RewardGameSession,
} from "@shared/gamefi";

const appId = "miniapp-sudoku";
// Operator-whitelisted engine pin (sha-256 of the reviewed sudoku engine wrapper
// in the worker registry). The session host rejects any other hash for this app.
const ENGINE_HASH = "679aea4220667dec0e921eb364392f7983dae440a3aa9e43a215a4d054ab58c8";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX = "miniapp-sudoku:ops:";

/** A sudoku session op — structurally a generic TeeSessionOp. */
type TeeOp = { type: "place"; cell: number; digit: number } | { type: "undo" };

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
  })),
};

const opStorage = createLocalStorageRewardGameStorage<TeeOp>(OPS_STORAGE_PREFIX);

function asNumber(value: unknown): number {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
}

export interface LeaderEntry {
  rank: number;
  address: string;
  totalWon: number;
  solves: number;
  isUser: boolean;
}

export interface SolveRow {
  gameId: string;
  difficulty: number;
  elapsedMs: number;
  undos: number;
  payout: string;
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const credit = createObservable(0);
    const poolFree = createObservable(0);
    const activeGameId = createObservable("0");
    const gameStatus = createObservable("idle");
    const gameDifficulty = createObservable(0);
    const clues = createObservable("");
    const commitment = createObservable("");
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
    const undosUsed = createObservable(0);
    const lastPayout = createObservable("");
    const lastElapsedMs = createObservable(0);
    const leaderboard = createObservable<LeaderEntry[]>([]);
    const myRank = createObservable(0);
    const myTotalWon = createObservable(0);
    const mySolves = createObservable(0);
    const myHistory = createObservable<SolveRow[]>([]);
    const isStarting = createObservable(false);
    const isDealing = createObservable(false);
    const isSubmitting = createObservable(false);
    const isUndoing = createObservable(false);
    const lastStatus = createObservable(ctx.t("statusReady"));

    // Generic enclave session context for the active game (rebuilt idempotently
    // from the deterministic session start, so nothing here needs durable
    // storage).
    let session: RewardGameSession | null = null;

    const playerScriptHash = (): string => {
      const player = ctx.services.chain.address.get();
      return player ? addressToScriptHash(player) : "";
    };

    const refreshBalances = async (): Promise<void> => {
      try {
        const balances = await refreshRewardGameBalances(
          rewardGameConfig,
          ctx.services.chain,
          playerScriptHash(),
        );
        poolFree.set(balances.poolFreeGas);
        credit.set(balances.creditGas);
      } catch {
        /* keep the previous values — reads are best-effort */
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

    /**
     * Rebuild the global ranking from Solved events. The event's totalWon slot
     * carries the player's CUMULATIVE winnings at solve time, so taking the
     * MAX per player is order-independent (robust to indexer sort direction).
     */
    const loadLeaderboard = async (): Promise<void> => {
      const playerHash = playerScriptHash();
      try {
        const events = await ctx.framework.chain.events("Solved", {
          limit: LEADERBOARD_EVENT_LIMIT,
        });
        const bestByPlayer = new Map<string, { totalWon: number; solves: number; raw: unknown }>();
        const mine: SolveRow[] = [];
        for (const ev of events) {
          const who = normHash(eventStateValue(ev, 1));
          if (!who) continue;
          const totalWon = fromFixed8(parseBigInt(eventStateValue(ev, 6)));
          const prior = bestByPlayer.get(who);
          bestByPlayer.set(who, {
            totalWon: Math.max(prior?.totalWon ?? 0, totalWon),
            solves: (prior?.solves ?? 0) + 1,
            raw: eventStateValue(ev, 1),
          });
          if (playerHash && addrEq(eventStateValue(ev, 1), playerHash)) {
            mine.push({
              gameId: String(parseBigInt(eventStateValue(ev, 0)) ?? ""),
              difficulty: asNumber(eventStateValue(ev, 2)),
              elapsedMs: asNumber(eventStateValue(ev, 3)),
              undos: asNumber(eventStateValue(ev, 4)),
              payout: `${fromFixed8(parseBigInt(eventStateValue(ev, 5))).toFixed(2)} GAS`,
            });
          }
        }
        const ranked: LeaderEntry[] = [...bestByPlayer.entries()]
          .map(([address, entry]) => ({
            address,
            totalWon: entry.totalWon,
            solves: entry.solves,
            isUser: playerHash ? addrEq(entry.raw, playerHash) : false,
          }))
          .sort((a, b) => b.totalWon - a.totalWon)
          .map((entry, idx) => ({ rank: idx + 1, ...entry }));
        leaderboard.set(ranked);
        const me = ranked.find((entry) => entry.isUser);
        myRank.set(me ? me.rank : 0);
        myHistory.set(mine.reverse().slice(0, 12));
      } catch {
        /* indexer unreachable — the board stays playable without rankings */
      }
    };

    const applyGameSnapshot = (game: unknown): void => {
      const status = statusOf(asNumber(mapField(game, "status")));
      gameStatus.set(status);
      gameDifficulty.set(asNumber(mapField(game, "difficulty")));
      commitment.set(String(mapField(game, "commitment") ?? ""));
      dealtAt.set(asNumber(mapField(game, "dealtAt")));
      deadline.set(asNumber(mapField(game, "deadline")));
      undosUsed.set(asNumber(mapField(game, "undos") ?? 0));
    };

    /**
     * Open the confidential enclave session for an already-active on-chain game.
     * The contract's StartGame set the game live (status 1) and armed the solve
     * clock; this just fetches the puzzle view + commitment from the enclave (no
     * on-chain effect). The SDK session start is deterministic per game, so retries and
     * reloads converge on the same puzzle. Returns true once the board is ready.
     */
    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      isDealing.set(true);
      lastStatus.set(ctx.t("statusSealing"));
      try {
        const started = await openRewardGameSession(
          rewardGameConfig,
          ctx.services.chain,
          gameId,
          difficulty,
        );
        session = started;
        clues.set(String(started.view.clues ?? ""));
        commitment.set(started.commitment);
        // dealtAt/deadline come from the on-chain game (armed at StartGame).
        const game = await ctx.framework.chain.readRaw("getGame", [
          ctx.framework.chain.arg.integer(gameId),
        ]);
        dealtAt.set(asNumber(mapField(game, "dealtAt")));
        deadline.set(asNumber(mapField(game, "deadline")));
        gameStatus.set("dealt");
        undosUsed.set(0);
        lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(message, "error");
        return false;
      } finally {
        isDealing.set(false);
      }
    };

    /** Reattach to an active game after a reload: same identity, same puzzle. */
    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const started = await openRewardGameSession(
          rewardGameConfig,
          ctx.services.chain,
          gameId,
          difficulty,
        );
        if (commitment.get() && started.commitment !== commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = started;
        clues.set(String(started.view.clues ?? ""));
        commitment.set(started.commitment);
      } catch {
        lastStatus.set(ctx.t("statusDealPending"));
      }
    };

    const sendOp = async (op: TeeOp): Promise<void> => {
      if (!session) throw new Error(ctx.t("statusFailed"));
      await recordRewardGameOp(session, opStorage, op);
    };

    ctx.framework.actions.register("startGame", async (...args: unknown[]) => {
      if (isStarting.get() || isDealing.get()) return;
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      isStarting.set(true);
      lastStatus.set(ctx.t("statusStarting"));
      try {
        const started = await startRewardGame(
          rewardGameConfig,
          ctx.services.chain,
          difficulty,
          opStorage,
        );
        const gameId = started.gameId;
        activeGameId.set(gameId);
        gameDifficulty.set(difficulty);
        undosUsed.set(0);
        clues.set("");
        commitment.set("");
        dealtAt.set(0);
        deadline.set(0);
        // The game is already active on-chain; show the sealing phase while the
        // enclave session opens (committed = "opening the enclave session").
        gameStatus.set("committed");
        lastStatus.set(ctx.t("statusStarted"));
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
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isStarting.set(false);
      }
    });

    // Retry handle for an enclave session that failed to open (TEE unreachable).
    ctx.framework.actions.register("retryDeal", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || isDealing.get() || gameStatus.get() !== "committed") return;
      await openSession(gameId, gameDifficulty.get());
    });

    // Fire-and-forget placement telemetry: the enclave tracks the op stream for
    // its behavioral gate + the op-log that settles the game; play never blocks.
    ctx.framework.actions.register("recordMove", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { cell?: unknown; digit?: unknown };
      const cell = Number(form.cell);
      const digit = Number(form.digit);
      if (!Number.isInteger(cell) || !Number.isInteger(digit)) return;
      try {
        await sendOp({ type: "place", cell, digit });
      } catch {
        /* telemetry only — the settlement gate re-validates in the enclave */
      }
    });

    // Paid undo: recorded in the enclave session (no transaction). The penalty
    // lands at settlement — the kernel replays the undo count into the payout.
    ctx.framework.actions.register("useUndo", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || isUndoing.get() || gameStatus.get() !== "dealt") return;
      isUndoing.set(true);
      try {
        await sendOp({ type: "undo" });
        const undos = undosUsed.get() + 1;
        undosUsed.set(undos);
        lastStatus.set(ctx.t("statusUndoUsed", { pct: String(100 - 30 * undos) }));
        ctx.setStatus(lastStatus.get(), "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isUndoing.set(false);
      }
    });

    ctx.framework.actions.register("submitSolution", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { solution?: unknown };
      const solution = String(form.solution ?? "");
      const gameId = activeGameId.get();
      if (gameId === "0" || isSubmitting.get() || gameStatus.get() !== "dealt") return;
      if (!/^[1-9]{81}$/.test(solution)) {
        ctx.setStatus(ctx.t("statusBoardIncomplete"), "error");
        throw new Error(ctx.t("statusBoardIncomplete"));
      }
      isSubmitting.set(true);
      lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) {
          await resumeSession(gameId, gameDifficulty.get());
        }
        if (!session) throw new Error(ctx.t("statusFailed"));
        // Seal the accumulated op-log to the oracle and hand it to the contract:
        // FinalizeGame turns it into a kernel request, the kernel replays the run
        // and credits the pool via onMiniAppResult.
        const finalized = await finalizeRewardGame(
          rewardGameConfig,
          ctx.services.chain,
          session,
          opStorage,
        );
        // Settlement is credited by the kernel callback; observe it on-chain.
        const settled = finalized.settlement;
        lastPayout.set(`${settled.payoutGas.toFixed(2)} GAS`);
        lastElapsedMs.set(settled.elapsedMs);
        gameStatus.set(settled.status);
        activeGameId.set("0");
        forgetBoard(gameId);
        session = null;
        if (settled.payoutGas > 0) {
          lastStatus.set(ctx.t("statusSolved", { payout: settled.payoutGas.toFixed(2) }));
          ctx.setStatus(lastStatus.get(), "success");
        } else {
          lastStatus.set(ctx.t("statusExpired"));
          ctx.setStatus(ctx.t("statusExpired"), "info");
        }
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
        return finalized.tx;
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isSubmitting.set(false);
      }
    });

    // Permissionless housekeeping: release the reward reservation of a game
    // whose deadline passed (or an abandoned settling game past its grace).
    ctx.framework.actions.register("expireGame", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0") return;
      try {
        await expireRewardGame(rewardGameConfig, ctx.services.chain, gameId, opStorage);
        gameStatus.set("expired");
        activeGameId.set("0");
        forgetBoard(gameId);
        session = null;
        lastStatus.set(ctx.t("statusExpired"));
        ctx.setStatus(ctx.t("statusExpired"), "info");
        await refreshBalances();
      } catch (error) {
        const message = error instanceof Error ? error.message : ctx.t("statusFailed");
        ctx.setStatus(message, "error");
        throw error;
      }
    });

    ctx.framework.actions.register("withdrawWinnings", async () => {
      const playerHash = playerScriptHash();
      if (!playerHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      if (credit.get() <= 0) {
        ctx.setStatus(ctx.t("noCreditToWithdraw"), "info");
        return;
      }
      await ctx.services.notify.guard(async () => {
        await withdrawRewardCredit(
          rewardGameConfig,
          ctx.services.chain,
          ctx.framework.amount.gasToFixed8(credit.get()),
        );
        await refreshBalances();
      }, "creditWithdrawn");
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
        clues,
        commitment,
        dealtAt,
        deadline,
        undosUsed,
        lastPayout,
        lastElapsedMs,
        leaderboard,
        myRank,
        myTotalWon,
        mySolves,
        myHistory,
        isStarting,
        isDealing,
        isSubmitting,
        isUndoing,
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
              if (gameStatus.get() === "dealt") {
                await resumeSession(active, gameDifficulty.get());
              } else if (gameStatus.get() === "committed") {
                void openSession(active, gameDifficulty.get());
              }
            }
          } catch {
            /* no active game recoverable — start fresh */
          }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (gameStatus.get() === "idle") {
          lastStatus.set(ctx.t("statusReady"));
        }
      },
    };
  },
});

export { gasDisplay };

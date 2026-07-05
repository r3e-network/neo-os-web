import { createObservable, defineMiniApp } from "@shared/react";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { addressToScriptHash } from "@shared/utils/neo";
import { eventStateValue } from "@shared/utils/chain-events";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  DIFFICULTY_RULES,
  ENTRY_MEMO,
  statusOf,
  gasDisplay,
} from "./logic/game-rules";
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

const appId = "miniapp-snake-bounty";
// Operator-whitelisted engine pin (sha-256 of the reviewed snake engine wrapper).
const ENGINE_HASH = "d92d42113646bf9b683bc7458c0cc449df38765b6aa0bcf8ff943556bac889bc";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX = "miniapp-snake-bounty:ops:";

type TeeOp = { type: "move"; dir: number } | { type: "undo" };

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
    target: rule.targetLength,
  })),
  eventSlots: {
    solvedPayout: 4,
  },
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
  payout: string;
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const credit = createObservable(0);
    const poolFree = createObservable(0);
    const activeGameId = createObservable("0");
    const gameStatus = createObservable("idle");
    const gameDifficulty = createObservable(0);
    const clues = createObservable("");
    const commitment = createObservable("");
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
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
    const lastStatus = createObservable(ctx.t("statusReady"));

    // Enclave session context for the active game (rebuilt idempotently from the
    // deterministic session start, so nothing here needs durable storage).
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
        const stats = await app.chain.readRaw("statsOf", [
          app.chain.arg.hash160(playerHash),
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
     *
     * Snake Solved event has 6 params: gameId, player, difficulty, elapsedMs,
     * payout, totalWon. No undos slot.
     */
    const loadLeaderboard = async (): Promise<void> => {
      const playerHash = playerScriptHash();
      try {
        const events = await app.chain.events("Solved", {
          limit: LEADERBOARD_EVENT_LIMIT,
        });
        const bestByPlayer = new Map<string, { totalWon: number; solves: number; raw: unknown }>();
        const mine: SolveRow[] = [];
        for (const ev of events) {
          const who = normHash(eventStateValue(ev, 1));
          if (!who) continue;
          const totalWon = fromFixed8(parseBigInt(eventStateValue(ev, 5)));
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
              payout: `${fromFixed8(parseBigInt(eventStateValue(ev, 4))).toFixed(2)} GAS`,
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
    };

    /**
     * Open the confidential enclave session for an already-active on-chain game:
     * the enclave holds the food sequence (never revealed ahead of play) and
     * returns the initial snake clues + commitment. No on-chain effect.
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
        const game = await app.chain.readRaw("getGame", [
          app.chain.arg.integer(gameId),
        ]);
        dealtAt.set(asNumber(mapField(game, "dealtAt")));
        deadline.set(asNumber(mapField(game, "deadline")));
        gameStatus.set("dealt");
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
        clues.set("");
        commitment.set("");
        dealtAt.set(0);
        deadline.set(0);
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

    // Fire-and-forget direction telemetry: the enclave tracks the op stream for
    // its behavioral gate + the op-log that settles the game; play never blocks.
    ctx.framework.actions.register("recordMove", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { dir?: unknown };
      const dir = Number(form.dir);
      if (!Number.isInteger(dir) || dir < 0 || dir > 3) return;
      try {
        await sendOp({ type: "move", dir });
      } catch {
        /* telemetry only — the settlement gate re-validates in the enclave */
      }
    });

    ctx.framework.actions.register("submitSolution", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || isSubmitting.get() || gameStatus.get() !== "dealt") return;
      isSubmitting.set(true);
      lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) {
          await resumeSession(gameId, gameDifficulty.get());
        }
        if (!session) throw new Error(ctx.t("statusFailed"));
        // The snake length is re-derived by the kernel from the sealed move
        // op-log (engine.replay); the client no longer signs a state hash.
        const finalized = await finalizeRewardGame(
          rewardGameConfig,
          ctx.services.chain,
          session,
          opStorage,
        );
        const settled = finalized.settlement;
        lastPayout.set(`${settled.payoutGas.toFixed(2)} GAS`);
        lastElapsedMs.set(settled.elapsedMs);
        gameStatus.set(settled.status);
        activeGameId.set("0");
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
          app.amount.gasToFixed8(credit.get()),
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
        lastStatus,
        walletConnected: ctx.services.chain.isConnected,
      },
      loadData: async () => {
        await refreshBalances();
        const playerHash = playerScriptHash();
        if (playerHash) {
          try {
            const active = String(
              parseBigInt(
                await app.chain.readRaw("activeGameOf", [
                  app.chain.arg.hash160(playerHash),
                ]),
              ) ?? "0",
            );
            if (active !== "0") {
              activeGameId.set(active);
              const game = await app.chain.readRaw("getGame", [
                app.chain.arg.integer(active),
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

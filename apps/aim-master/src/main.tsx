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
  ruleOf,
  statusOf,
  gasDisplay,
} from "./logic/game-rules";
import {
  eventHashMatches as addrEq,
  mapField,
  normalizedHash as normHash,
  type RewardGameConfig,
  type RewardGameSession,
} from "@shared/gamefi";
import type { HitResult } from "./logic/aim-engine";

const appId = "miniapp-aim-master";
// Operator-whitelisted engine pin (sha-256 of the reviewed aim engine wrapper).
const ENGINE_HASH = "701118ccc91941f1e36d8e71bdee6dc2f357ab42acd48fc754664915d570ca34";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX = "miniapp-aim-master:ops:";

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
};

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
  ringsHit: number;
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
    const pattern = createObservable("");
    const commitment = createObservable("");
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
    const ringsHit = createObservable(0);
    const roundIndex = createObservable(0);
    const roundResults = createObservable<HitResult[]>([]);
    const targetAccuracy = createObservable(3);
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

    // Enclave session context for the active game.
    let session: RewardGameSession | null = null;

    // Reward-game plumbing (session open/start/finalize/expire/withdraw + the
    // per-game op-log store) via the framework SDK. The storage prefix pins
    // the pre-migration localStorage keys so in-flight op-logs survive.
    const rewardGame = ctx.framework.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    // The wrapper methods delegate verbatim to the @shared/gamefi
    // startRewardGame / finalizeRewardGame orchestration; keep the canonical
    // SDK verbs at the entry/settlement call sites.
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    const playerScriptHash = (): string => {
      const player = ctx.framework.chain.address.get();
      return player ? addressToScriptHash(player) : "";
    };

    const refreshBalances = async (): Promise<void> => {
      try {
        const balances = await rewardGame.balances(playerScriptHash());
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
     * Rebuild the global ranking from Solved events.
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
              ringsHit: asNumber(eventStateValue(ev, 4)),
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
      ringsHit.set(asNumber(mapField(game, "ringsHit") ?? 0));
      targetAccuracy.set(asNumber(mapField(game, "targetAccuracy") ?? 3));
    };

    /**
     * Open the confidential enclave session for an already-active on-chain game:
     * the enclave generates the seeded target oscillation and returns the pattern
     * view + commitment. No on-chain effect.
     */
    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      isDealing.set(true);
      lastStatus.set(ctx.t("statusSealing"));
      try {
        const started = await rewardGame.openSession(gameId, difficulty);
        session = started;
        pattern.set(String(started.view.pattern ?? ""));
        commitment.set(started.commitment);
        const game = await ctx.framework.chain.readRaw("getGame", [
          ctx.framework.chain.arg.integer(gameId),
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

    /** Reattach to an active game after a reload. */
    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const started = await rewardGame.openSession(gameId, difficulty);
        if (commitment.get() && started.commitment !== commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = started;
        pattern.set(String(started.view.pattern ?? ""));
        commitment.set(started.commitment);
      } catch {
        lastStatus.set(ctx.t("statusDealPending"));
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
      if (isStarting.get() || isDealing.get()) return;
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      const rule = ruleOf(difficulty);
      isStarting.set(true);
      lastStatus.set(ctx.t("statusStarting"));
      try {
        const started = await startRewardGame(difficulty);
        const gameId = started.gameId;
        activeGameId.set(gameId);
        gameDifficulty.set(difficulty);
        targetAccuracy.set(rule.targetAccuracy);
        ringsHit.set(0);
        roundIndex.set(0);
        roundResults.set([]);
        pattern.set("");
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

    ctx.framework.actions.register("retryDeal", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0" || isDealing.get() || gameStatus.get() !== "committed") return;
      await openSession(gameId, gameDifficulty.get());
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
        // The accuracy hits are re-derived by the kernel from the sealed aim
        // op-log (engine.replay); the client no longer signs a ring count.
        const finalized = await finalizeRewardGame(session);
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

    ctx.framework.actions.register("expireGame", async () => {
      const gameId = activeGameId.get();
      if (gameId === "0") return;
      try {
        await rewardGame.expire(gameId);
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
        await rewardGame.withdrawCredit(ctx.framework.amount.gasToFixed8(credit.get()));
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
        pattern,
        commitment,
        dealtAt,
        deadline,
        ringsHit,
        roundIndex,
        roundResults,
        targetAccuracy,
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

/**
 * Color Clash — Simon Says memory game (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: sequence reveal-per-round, press recording, and solution finalization.
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
import { DIFFICULTY_RULES, ENTRY_MEMO, statusOf } from "./logic/game-rules";
import type { GameSessionStatus, LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-color-clash";
const ENGINE_HASH = "074ec7a8437bb8dbdb7c5aca5ccdad1c970e07f1cdbf06358b89638d90539013";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-color-clash:ops:";

type PressOp = { type: "press"; color: number };

function sessionStatusOf(raw: number): GameSessionStatus {
  const status = statusOf(raw);
  if (status === "awaiting-bind") return "committed";
  if (status === "playing") return "dealt";
  if (
    status === "committed" ||
    status === "dealt" ||
    status === "solved" ||
    status === "expired" ||
    status === "refunded" ||
    status === "unknown"
  ) {
    return status;
  }
  return "unknown";
}

// Color-clash SolveRow adds seqAchieved (unique to this game)
interface ColorClashRow extends SolveRow {
  seqAchieved: number;
}

// Color-clash LeaderEntry uses the standard structure; we re-export for PlayArea
export type { LeaderEntry };
export type { ColorClashRow as SolveRow };

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
    target:       rule.targetSeq,
  })),
};

// Slot layout for the Color-Clash Solved event:
// gameId(0) player(1) difficulty(2) elapsedMs(3) undos(4) payout(5) totalWon(6) seqAchieved(7)
const SOLVED_SLOTS = {
  gameId: 0, player: 1, difficulty: 2, elapsedMs: 3,
  undos: 4, solvedPayout: 5, totalWon: 6,
};

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;

    // ── Reward-game runner ────────────────────────────────────────────────────
    const rewardGame = app.game.reward<PressOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    // ── Standard session observables ──────────────────────────────────────────
    const obs = app.game.session.observables<ColorClashRow>(ctx.t);

    // ── Color-clash specific observables ──────────────────────────────────────
    // Growing revealed prefix — built up from per-round `reveal` fields.
    const sequence       = createObservable("");
    const playerSequence = createObservable("");
    const seqAchieved    = createObservable(0);
    // lastPayout is a number (fixed8 bigint) in this game
    const lastPayoutFixed8 = createObservable<bigint>(0n);

    let session: RewardGameSession | null = null;

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

    // Color-clash leaderboard has `player` + `solved` field names (not address/solves).
    // Keep a custom implementation that handles the unique field layout.
    const loadLeaderboard = async () => {
      const playerHash = app.game.player.scriptHash();
      try {
        const events = await app.chain.events("Solved", { limit: LEADERBOARD_EVENT_LIMIT });
        const bestByPlayer = new Map<string, LeaderEntry>();
        const mine: ColorClashRow[] = [];
        for (const ev of events) {
          const who = normHash(eventStateValue(ev, 1));
          if (!who) continue;
          const totalWon = fromFixed8(parseBigInt(eventStateValue(ev, SOLVED_SLOTS.totalWon)));
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
              seqAchieved:  asNumber(eventStateValue(ev, 7)),
            });
          }
        }
        const ranked = [...bestByPlayer.values()]
          .sort((a, b) => b.totalWon - a.totalWon)
          .map((e, i) => ({ ...e, rank: i + 1 }));
        obs.leaderboard.set(ranked);
        const me = playerHash
          ? ranked.find((entry) => addrEq(entry.address, playerHash))
          : undefined;
        obs.myRank.set(me?.rank ?? 0);
        obs.myHistory.set(mine.reverse().slice(0, 12));
      } catch { /* indexer unreachable */ }
    };

    const applySnapshot = (game: unknown) => {
      app.game.session.applySnapshot(obs, game, sessionStatusOf);
    };

    // ── Session open / resume ─────────────────────────────────────────────────
    const openSession = async (gameId: string, difficulty: number): Promise<void> => {
      obs.isDealing.set(true);
      obs.lastStatus.set("shuffling");
      try {
        session = await rewardGame.openSession(gameId, difficulty);
        obs.commitment.set(session.commitment);
        sequence.set(String(session.view.sequence ?? ""));
        playerSequence.set("");
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
        if (ops.length > 0) playerSequence.set(ops.map((op) => String(op.color)).join(""));
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
        sequence.set("");
        playerSequence.set("");
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

    app.actions.register("recordPress", async (...args: unknown[]) => {
      const color  = Number(args[0]);
      const gameId = obs.activeGameId.get();
      if (!Number.isInteger(color) || color < 0 || color > 3) return;
      if (!gameId || gameId === "0" || !session || obs.gameStatus.get() !== "dealt") return;
      try {
        const previousOps = rewardGame.storage.load(gameId);
        const { step }    = await rewardGame.recordOp(session, { type: "press", color });
        const view        = step.view;
        if (view.correct !== true || view.wrong === true) {
          rewardGame.storage.save(gameId, previousOps);
          obs.lastStatus.set("wrong");
          ctx.setStatus(ctx.t("wrongPress"), "error");
          return;
        }
        const nextPlayer = playerSequence.get() + String(color);
        playerSequence.set(nextPlayer);
        if (view.reveal !== undefined && view.reveal !== null) {
          sequence.set(sequence.get() + String(view.reveal));
          playerSequence.set("");
          seqAchieved.set(Number(view.round ?? seqAchieved.get()));
        } else if (nextPlayer.length >= sequence.get().length) {
          seqAchieved.set(sequence.get().length);
          playerSequence.set("");
          obs.lastStatus.set("all-correct");
        }
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
        let achieved    = seqAchieved.get();
        let undos       = obs.undosUsed.get();
        try {
          const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
          achieved = asNumber(mapField(game, "seqAchieved"));
          undos    = asNumber(mapField(game, "undos"));
        } catch { /* fall back to client values */ }
        lastPayoutFixed8.set(settled.payoutFixed8);
        obs.lastElapsedMs.set(settled.elapsedMs);
        seqAchieved.set(achieved);
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
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0") return;
      try {
        await rewardGame.expire(gameId);
        obs.gameStatus.set("expired");
        session = null;
        obs.activeGameId.set("0");
        obs.lastStatus.set("expired");
        ctx.setStatus(ctx.t("expiredBanner"), "info");
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
      state: {
        ...obs,
        sequence,
        playerSequence,
        seqAchieved,
        lastPayoutFixed8,
      },
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
              applySnapshot(game);
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

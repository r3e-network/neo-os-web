/**
 * 2048 Rush — tile-cascade puzzle (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: tile-run management, move/undo recording, and solution finalization.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import { fromFixed8 } from "@shared/utils/format";
import { eventStateValue } from "@shared/utils/chain-events";
import type { RewardGameSession, RewardGameSnapshot } from "@framework/gamefi";
import { eventHashMatches as addrEq, mapField, normalizedHash as normHash } from "@framework/gamefi";
import { parseBigInt } from "@shared/utils/parsers";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  canReleaseExpiredGame,
  DIFFICULTY_RULES,
  ENTRY_MEMO,
  MAX_MOVES,
  MAX_UNDOS,
  SETTLEMENT_GRACE_MS,
  statusOf,
  gasDisplay,
  ruleOf,
} from "./logic/game-rules";
import {
  MOVE_ANIMATION_MS,
  applyMove,
  hasAnyMove,
  isValidSpawn,
  requireBoard,
} from "./logic/engine-2048";
import type { MoveTransition } from "./logic/engine-2048";
import {
  applyStepWithTransition,
  forgetRun,
  persistRun,
  startRun,
  trimLastMove,
} from "./logic/run-store";
import type { LiveRun, TeeSpawn } from "./logic/run-store";
import { createGuestEngine } from "./logic/guest-engine";
import type { LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-game-2048";
const ENGINE_HASH = "2fd50277231865f3da3535d27ebd74ef14662ee7fb2a5e037badd43c968814bb";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-game-2048:ops:";
const SUBMIT_BUFFER_MS        = 15_000;
const MIN_SOLVE_BUFFER_MS     = 10_000;

type TeeOp = { type: "move"; dir: number } | { type: "undo" };

const rewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo:  ENTRY_MEMO,
  modes: DIFFICULTY_RULES.map((rule) => ({
    id:           rule.difficulty,
    key:          rule.key,
    entryFixed8:  rule.entryFixed8,
    rewardFixed8: rule.rewardFixed8,
    limitMs:      rule.limitMs,
    minSolveMs:   rule.minSolveMs,
    target:       rule.targetTile,
  })),
  progression: { enabled: true },
};

// 2048 Solved event: gameId(0) player(1) difficulty(2) elapsedMs(3) undos(4) payout(5) totalWon(6)
const SOLVED_SLOTS = {
  gameId: 0, player: 1, difficulty: 2, elapsedMs: 3,
  undos: 4, solvedPayout: 5, totalWon: 6,
};

function parseSpawn(view: Record<string, unknown>): TeeSpawn | null {
  return isValidSpawn(view.spawn) ? { ...view.spawn } : null;
}

function sameBoard(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export type { LeaderEntry, SolveRow };

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
    const obs = app.game.session.observables<SolveRow>(ctx.t);

    // ── 2048-specific observables ─────────────────────────────────────────────
    const runBoard     = createObservable<number[]>([]);
    const runMoveCount = createObservable(0);
    const runMaxExp    = createObservable(0);
    const moveTransition = createObservable<MoveTransition | null>(null);
    const isMoving     = createObservable(false);
    // True once the reward-pool balance has been confirmed at least once, so the
    // in-canvas start button can show a neutral "checking pool" state instead of
    // a discouraging "pool low" while balances are still unknown.
    const balancesReady = createObservable(false);
    const selectedDifficulty = createObservable(0);
    const settlementGraceMs = createObservable(SETTLEMENT_GRACE_MS);
    const isRecovering = createObservable(false);

    let session: RewardGameSession | null = null;
    let run: LiveRun | null = null;
    let moveSequence = 0;
    let moveUnlockTimer: ReturnType<typeof setTimeout> | null = null;

    const clearMovePresentation = (resetSequence = false): void => {
      if (moveUnlockTimer !== null) clearTimeout(moveUnlockTimer);
      moveUnlockTimer = null;
      moveTransition.set(null);
      isMoving.set(false);
      if (resetSequence) moveSequence = 0;
    };

    const scheduleMoveUnlock = (): void => {
      if (moveUnlockTimer !== null) clearTimeout(moveUnlockTimer);
      moveUnlockTimer = setTimeout(() => {
        moveUnlockTimer = null;
        isMoving.set(false);
      }, MOVE_ANIMATION_MS);
    };

    // Run log persists via framework's namespaced local KV.
    const runStorage = app.storage.local;

    const publishRun = (): void => {
      runBoard.set(run ? [...run.board] : []);
      runMoveCount.set(run ? run.moves.length : 0);
      runMaxExp.set(run ? run.maxExp : 0);
    };

    // ── Play mode (guest | gamefi) ────────────────────────────────────────────
    // Mirror the launcher-selected mode into an observable the PlayArea/scene
    // read, so guest can drop the GAS-at-stake / pool / reward framing while
    // GAMEFI copy stays exactly as-is.
    const appMode = createObservable<string>(app.mode.get());

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local 2048 engine — no chain/oracle/reward calls.
    const guest = createGuestEngine({
      obs,
      runBoard,
      runMoveCount,
      runMaxExp,
      moveTransition,
      isMoving,
      balancesReady,
      guestLeaderboard: app.mode.guestLeaderboard,
      storage: app.storage.local,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the mode observable in sync; switching to guest at the launcher resets
    // to a clean local lobby and loads the off-chain guest board (replacing the
    // on-chain read done on mount).
    app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") {
        clearMovePresentation(true);
        void guest.enter();
      }
    });

    // ── Data refresh ──────────────────────────────────────────────────────────
    const refreshBalances = async () => {
      if (app.mode.isGuest()) return;
      try {
        const balances = await rewardGame.balances(app.game.player.scriptHash());
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
        balancesReady.set(true);
      } catch { /* best-effort */ }
    };

    const refreshStats = async () => {
      if (app.mode.isGuest()) return;
      const { solves, totalWon } = await app.game.stats.load();
      obs.mySolves.set(solves);
      obs.myTotalWon.set(totalWon);
    };

    const refreshGameConfig = async () => {
      if (app.mode.isGuest()) return;
      try {
        const config = await app.chain.readRaw("getConfig", []);
        const configuredGrace = asNumber(mapField(config, "settleGraceMs"));
        settlementGraceMs.set(configuredGrace > 0 ? configuredGrace : SETTLEMENT_GRACE_MS);
      } catch {
        settlementGraceMs.set(SETTLEMENT_GRACE_MS);
      }
    };

    const loadLeaderboard = async () => {
      if (app.mode.isGuest()) return;
      const playerHash = app.game.player.scriptHash();
      try {
        const events = await app.chain.events("Solved", { limit: LEADERBOARD_EVENT_LIMIT });
        const bestByPlayer = new Map<string, LeaderEntry>();
        const mine: SolveRow[] = [];
        for (const event of events) {
          const who = normHash(eventStateValue(event, SOLVED_SLOTS.player));
          const payoutFixed8 = parseBigInt(eventStateValue(event, SOLVED_SLOTS.solvedPayout));
          // The contract emits Solved for every verified terminal run, including
          // losses. Only positive-payout wins belong in ranks and win history.
          if (!who || payoutFixed8 <= 0n) continue;
          const totalWon = fromFixed8(parseBigInt(eventStateValue(event, SOLVED_SLOTS.totalWon)));
          const prior = bestByPlayer.get(who);
          bestByPlayer.set(who, {
            rank: 0,
            address: String(eventStateValue(event, SOLVED_SLOTS.player) ?? who),
            totalWon: Math.max(prior?.totalWon ?? 0, totalWon),
            solves: (prior?.solves ?? 0) + 1,
            isUser: playerHash ? addrEq(eventStateValue(event, SOLVED_SLOTS.player), playerHash) : false,
          });
          if (playerHash && addrEq(eventStateValue(event, SOLVED_SLOTS.player), playerHash)) {
            mine.push({
              gameId: String(parseBigInt(eventStateValue(event, SOLVED_SLOTS.gameId))),
              difficulty: Math.max(0, Math.min(2, Math.round(asNumber(
                eventStateValue(event, SOLVED_SLOTS.difficulty),
              )))),
              solveMs: asNumber(eventStateValue(event, SOLVED_SLOTS.elapsedMs)),
              undos: asNumber(eventStateValue(event, SOLVED_SLOTS.undos)),
              payout: `${fromFixed8(payoutFixed8).toFixed(2)} GAS`,
            });
          }
        }
        const ranked = [...bestByPlayer.values()]
          .sort((left, right) => right.totalWon - left.totalWon)
          .map((entry, index) => ({ ...entry, rank: index + 1 }));
        obs.leaderboard.set(ranked);
        obs.myRank.set(ranked.find((entry) => entry.isUser)?.rank ?? 0);
        obs.myHistory.set(mine);
      } catch {
        obs.leaderboard.set([]);
        obs.myRank.set(0);
        obs.myHistory.set([]);
      }
    };

    // ── Session helpers ───────────────────────────────────────────────────────
    const applySnapshotTiming = (snapshot: RewardGameSnapshot): void => {
      obs.gameDifficulty.set(Math.max(0, Math.min(2, Math.round(snapshot.difficulty))));
      selectedDifficulty.set(obs.gameDifficulty.get());
      if (snapshot.commitment) obs.commitment.set(snapshot.commitment);
      obs.dealtAt.set(snapshot.dealtAt);
      obs.deadline.set(snapshot.deadline);
    };

    const rebuildSessionRun = async (
      opened: RewardGameSession,
      gameId: string,
    ): Promise<LiveRun> => {
      const initialBoard = requireBoard(opened.view.board);
      let rebuilt = startRun(initialBoard);
      if (!rebuilt) throw new Error(ctx.t("invalidBoardPayload"));
      const ops = rewardGame.storage.load(gameId);
      if (ops.length > 0) {
        await rewardGame.replayOps(opened, ops, (step, op, index) => {
          if (op.type === "move") {
            const spawn = parseSpawn(step.view);
            const applied = spawn
              ? applyStepWithTransition(rebuilt!, op.dir, spawn, index + 1)
              : null;
            if (!applied) throw new Error(ctx.t("invalidSessionPayload"));
            rebuilt = applied.run;
          } else {
            rebuilt = trimLastMove(rebuilt!);
          }
          const verifiedBoard = requireBoard(step.view.board);
          if (!sameBoard(verifiedBoard, rebuilt!.board)) {
            throw new Error(ctx.t("invalidSessionPayload"));
          }
        });
      }
      moveSequence = ops.length;
      obs.undosUsed.set(Math.min(MAX_UNDOS, ops.filter((op) => op.type === "undo").length));
      persistRun(runStorage, gameId, rebuilt);
      return rebuilt;
    };

    const applyObservedSettlement = async (snapshot: RewardGameSnapshot): Promise<void> => {
      const won = snapshot.status === "solved" && snapshot.payoutFixed8 > 0n;
      obs.lastPayout.set(`${snapshot.payoutGas.toFixed(2)} GAS`);
      obs.lastElapsedMs.set(snapshot.solveMs);
      obs.gameStatus.set(won ? "solved" : "expired");
      obs.activeGameId.set("0");
      forgetRun(runStorage, snapshot.gameId);
      rewardGame.storage.forget(snapshot.gameId);
      session = null;
      run = null;
      clearMovePresentation(true);
      publishRun();
      obs.lastStatus.set(won
        ? ctx.t("statusSolved", { payout: snapshot.payoutGas.toFixed(2) })
        : ctx.t("statusExpired"));
      ctx.setStatus(obs.lastStatus.get(), won ? "success" : "info");
      await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
    };

    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      obs.lastStatus.set(ctx.t("statusSealing"));
      try {
        const snapshot = await rewardGame.snapshot(gameId);
        applySnapshotTiming(snapshot);
        if (["solved", "expired", "refunded"].includes(snapshot.status)) {
          await applyObservedSettlement(snapshot);
          return false;
        }
        const opened = await rewardGame.openSession(gameId, difficulty);
        session = opened;
        clearMovePresentation(true);
        run = await rebuildSessionRun(opened, gameId);
        publishRun();
        obs.commitment.set(opened.commitment);
        obs.gameStatus.set("dealt");
        obs.lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        session = null;
        obs.lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        return false;
      } finally {
        obs.isDealing.set(false);
      }
    };

    const resumeSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      try {
        const restored = await rewardGame.openSession(gameId, difficulty);
        if (obs.commitment.get() && restored.commitment !== obs.commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = restored;
        clearMovePresentation(true);
        run = await rebuildSessionRun(restored, gameId);
        publishRun();
        obs.commitment.set(restored.commitment);
        obs.gameStatus.set("dealt");
        obs.lastStatus.set(ctx.t("statusDealt"));
        return true;
      } catch (error) {
        session = null;
        obs.lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        return false;
      } finally {
        obs.isDealing.set(false);
      }
    };

    const sendOp = async (op: TeeOp): Promise<{ ok: boolean; spawn: TeeSpawn | null; board: number[] }> => {
      if (!session) throw new Error(ctx.t("statusFailed"));
      const { step } = await rewardGame.recordOp(session, op);
      const board = requireBoard(step.view.board);
      return { ok: step.view.ok !== false, spawn: parseSpawn(step.view), board };
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    app.actions.register("setDifficulty", async (...args: unknown[]) => {
      if (
        obs.isStarting.get()
        || obs.isDealing.get()
        || obs.isSubmitting.get()
        || ["dealt", "committed", "unknown"].includes(obs.gameStatus.get())
      ) return;
      selectedDifficulty.set(Math.max(0, Math.min(2, Math.round(Number(args[0]) || 0))));
    });

    app.actions.register("startGame", async (...args: unknown[]) => {
      const form       = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Math.round(
        Number(form.difficulty ?? selectedDifficulty.get()) || 0,
      )));
      selectedDifficulty.set(difficulty);
      if (app.mode.isGuest()) { guest.startGame({ difficulty }); return; }
      if (manifest.supportsGameFi === false) {
        throw new Error(ctx.t("entryGameFiUnavailable"));
      }
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      obs.isStarting.set(true);
      obs.lastStatus.set(ctx.t("statusStarting"));
      try {
        const started = await startRewardGame(difficulty);
        const gameId  = started.gameId;
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
        obs.undosUsed.set(0);
        obs.commitment.set("");
        obs.dealtAt.set(0);
        obs.deadline.set(0);
        run = null;
        clearMovePresentation(true);
        publishRun();
        obs.gameStatus.set("committed");
        obs.lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        await openSession(gameId, difficulty);
        return started.tx;
      } catch (error) {
        const msg = app.errors.is(error, "POOL_LOW")
          ? ctx.t("statusPoolLow")
          : app.errors.messageOf(error, ctx.t("statusFailed"));
        obs.lastStatus.set(msg);
        ctx.setStatus(msg, "error");
        throw error;
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = obs.activeGameId.get();
      const status = obs.gameStatus.get();
      if (
        gameId === "0"
        || obs.isDealing.get()
        || !["committed", "dealt"].includes(status)
        || (status === "dealt" && run !== null)
      ) return;
      if (status === "committed") await openSession(gameId, obs.gameDifficulty.get());
      else await resumeSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("checkSettlement", async () => {
      if (app.mode.isGuest() || isRecovering.get()) return;
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || obs.gameStatus.get() !== "unknown") return;
      isRecovering.set(true);
      try {
        const snapshot = await rewardGame.snapshot(gameId);
        applySnapshotTiming(snapshot);
        if (snapshot.status === "unknown") {
          obs.lastStatus.set(ctx.t("settlementStillPending"));
          ctx.setStatus(ctx.t("settlementStillPending"), "info");
          return;
        }
        if (snapshot.status === "dealt") {
          obs.gameStatus.set("dealt");
          session = null;
          run = null;
          clearMovePresentation(true);
          publishRun();
          obs.lastStatus.set(ctx.t("sessionRecoveryReady"));
          ctx.setStatus(ctx.t("sessionRecoveryReady"), "info");
          return;
        }
        if (["solved", "expired", "refunded"].includes(snapshot.status)) {
          await applyObservedSettlement(snapshot);
        }
      } catch (error) {
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        isRecovering.set(false);
      }
    });

    app.actions.register("playMove", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.playMove(args[0]); return; }
      const form = (args[0] ?? {}) as { dir?: unknown };
      const dir  = Number(form.dir);
      if (!Number.isInteger(dir) || dir < 0 || dir > 3) return;
      if (!run || !session || obs.gameStatus.get() !== "dealt" || isMoving.get()) return;
      if (obs.deadline.get() > 0 && Date.now() >= obs.deadline.get()) return;
      if (run.moves.length >= MAX_MOVES) return;
      if (!applyMove([...run.board], dir)) return; // no-op move
      isMoving.set(true);
      let animationQueued = false;
      try {
        const result = await sendOp({ type: "move", dir });
        if (!result.ok || !result.spawn) throw new Error(ctx.t("invalidSessionPayload"));
        const applied = applyStepWithTransition(run, dir, result.spawn, moveSequence + 1);
        if (!applied || !sameBoard(applied.run.board, result.board)) {
          throw new Error(ctx.t("invalidSessionPayload"));
        }
        moveSequence += 1;
        // The transition is published first so an unbatched bridge update still
        // animates from the currently rendered board instead of snapping ahead.
        moveTransition.set(applied.transition);
        run = applied.run;
        persistRun(runStorage, obs.activeGameId.get(), run);
        publishRun();
        scheduleMoveUnlock();
        animationQueued = true;
      } catch (error) {
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        if (!animationQueued) isMoving.set(false);
      }
    });

    app.actions.register("useUndo", async () => {
      if (app.mode.isGuest()) { guest.useUndo(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isUndoing.get() || obs.gameStatus.get() !== "dealt") return;
      if (
        !run
        || !session
        || run.moves.length === 0
        || isMoving.get()
        || obs.undosUsed.get() >= MAX_UNDOS
        || (obs.deadline.get() > 0 && Date.now() >= obs.deadline.get() - 15_000)
      ) return;
      obs.isUndoing.set(true);
      try {
        const result = await sendOp({ type: "undo" });
        const trimmed = trimLastMove(run);
        if (!result.ok || !sameBoard(trimmed.board, result.board)) {
          throw new Error(ctx.t("invalidSessionPayload"));
        }
        run = trimmed;
        moveTransition.set(null);
        persistRun(runStorage, gameId, run);
        publishRun();
        const undos = obs.undosUsed.get() + 1;
        obs.undosUsed.set(undos);
        obs.lastStatus.set(ctx.t("statusUndoUsed", { pct: String(100 - 30 * undos) }));
        ctx.setStatus(obs.lastStatus.get(), "info");
      } catch (error) {
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        throw error;
      } finally {
        obs.isUndoing.set(false);
      }
    });

    app.actions.register("submitRun", async () => {
      if (app.mode.isGuest()) { await guest.submitRun(); return; }
      const gameId = obs.activeGameId.get();
      const rule = ruleOf(obs.gameDifficulty.get());
      const now = Date.now();
      const runEnded = Boolean(run) && (
        run!.maxExp >= rule.targetExp
        || !hasAnyMove(run!.board)
        || run!.moves.length >= MAX_MOVES
      );
      if (
        gameId === "0"
        || obs.isSubmitting.get()
        || obs.gameStatus.get() !== "dealt"
        || !run
        || !runEnded
        || now < obs.dealtAt.get() + rule.minSolveMs + MIN_SOLVE_BUFFER_MS
        || (obs.deadline.get() > 0 && now >= obs.deadline.get() - SUBMIT_BUFFER_MS)
      ) {
        obs.lastStatus.set(ctx.t("submitNotReady"));
        return;
      }
      obs.isSubmitting.set(true);
      obs.lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        const settled   = finalized.settlement;
        if (settled.status === "unknown") {
          obs.gameStatus.set("unknown");
          session = null;
          obs.lastStatus.set(ctx.t("settlementStillPending"));
          ctx.setStatus(ctx.t("settlementStillPending"), "info");
          return finalized.tx;
        }
        obs.lastPayout.set(`${settled.payoutGas.toFixed(2)} GAS`);
        obs.lastElapsedMs.set(settled.elapsedMs);
        obs.gameStatus.set(settled.payoutFixed8 > 0n ? "solved" : "expired");
        obs.activeGameId.set("0");
        forgetRun(runStorage, gameId);
        session = null;
        run = null;
        clearMovePresentation(true);
        publishRun();
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
        session = null;
        try {
          const snapshot = await rewardGame.snapshot(gameId);
          applySnapshotTiming(snapshot);
          if (snapshot.status === "unknown") {
            obs.gameStatus.set("unknown");
            obs.lastStatus.set(ctx.t("settlementStillPending"));
            ctx.setStatus(ctx.t("settlementStillPending"), "info");
            return;
          }
          if (["solved", "expired", "refunded"].includes(snapshot.status)) {
            await applyObservedSettlement(snapshot);
            return;
          }
        } catch {
          // Retry sealing reconstructs the TEE state from the persisted op log.
        }
        obs.lastStatus.set(ctx.t("sessionRecoveryReady"));
        ctx.setStatus(
          app.errors.messageOf(error, ctx.t("sessionRecoveryReady")),
          "error",
        );
      } finally {
        obs.isSubmitting.set(false);
      }
    });

    app.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { await guest.expireGame(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0") return;
      if (!canReleaseExpiredGame(obs.deadline.get(), settlementGraceMs.get())) {
        ctx.setStatus(ctx.t("releaseWaitStatus"), "info");
        return;
      }
      try {
        await rewardGame.expire(gameId);
        // A wallet result only proves broadcast. Keep the exact run recoverable
        // until the contract readback exposes a terminal state.
        const snapshot = await rewardGame.snapshot(gameId);
        applySnapshotTiming(snapshot);
        if (["solved", "expired", "refunded"].includes(snapshot.status)) {
          await applyObservedSettlement(snapshot);
          return;
        }
        session = null;
        obs.gameStatus.set("unknown");
        obs.lastStatus.set(ctx.t("settlementStillPending"));
        ctx.setStatus(ctx.t("settlementStillPending"), "info");
      } catch (error) {
        // The request may have reached a wallet or RPC even when the response
        // was lost. Preserve the id and let Check settlement resolve it.
        session = null;
        obs.gameStatus.set("unknown");
        obs.lastStatus.set(ctx.t("settlementStillPending"));
        ctx.setStatus(
          app.errors.messageOf(error, ctx.t("settlementStillPending")),
          "error",
        );
      }
    });

    const withdrawOp = app.operations.create("withdrawWinnings");
    app.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      if (!app.wallet.isConnected()) {
        ctx.setStatus(ctx.t("connectWalletFirst"), "info");
        return;
      }
      const playerHash = app.game.player.scriptHash();
      if (!playerHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      await withdrawOp.run(async () => {
        const before = await rewardGame.balances(playerHash);
        if (before.creditFixed8 <= 0n) throw new Error(ctx.t("noCreditToWithdraw"));
        const result = await rewardGame.withdrawCredit(before.creditFixed8);
        if (result.skipped) throw new Error(ctx.t("noCreditToWithdraw"));
        const exactEvent = result.tx.event != null
          && addrEq(eventStateValue(result.tx.event, 0), playerHash)
          && parseBigInt(eventStateValue(result.tx.event, 1)) === before.creditFixed8;
        const after = await rewardGame.balances(playerHash);
        obs.poolFree.set(after.poolFreeGas);
        obs.credit.set(after.creditGas);
        if (!exactEvent && after.creditFixed8 !== 0n) {
          throw new Error(ctx.t("withdrawPending"));
        }
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
        runBoard,
        runMoveCount,
        runMaxExp,
        moveTransition,
        isMoving,
        balancesReady,
        selectedDifficulty,
        settlementGraceMs,
        isRecovering,
        appMode,
      },
      loadData: async () => {
        // Guest is a purely local game: skip every mount-time chain read (the
        // guest engine's enter() already staged a clean local lobby + board).
        if (app.mode.isGuest()) { await guest.enter(); return; }
        await Promise.all([refreshBalances(), refreshGameConfig()]);
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
              app.game.session.applySnapshot(obs, game, statusOf);
              selectedDifficulty.set(Math.max(0, Math.min(2, obs.gameDifficulty.get())));
              if (obs.gameStatus.get() === "dealt") {
                await resumeSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "committed") {
                await openSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "unknown") {
                obs.lastStatus.set(ctx.t("settlementStillPending"));
              }
            }
          } catch { /* no active game */ }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set(ctx.t("statusReady"));
      },
    };
  },
});

export { gasDisplay };

/**
 * Merge Kingdom — tile-merging puzzle (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: board management, tile-move recording, and solution finalization.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import { createDerived } from "@shared/react/context";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { eventStateValue } from "@shared/utils/chain-events";
import { eventHashMatches as addrEq, mapField, normalizedHash as normHash } from "@framework/gamefi";
import type { RewardGameSession } from "@framework/gamefi";
import { classifyChainError } from "@framework/utils/chain-errors";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  BOARD_SIZE,
  DIFFICULTY_RULES,
  ENTRY_MEMO,
  GAMEFI_NEW_ENTRIES_ENABLED,
  canExpireAfterGrace,
  emptyBoard,
  statusOf,
} from "./logic/game-rules";
import { createGuestEngine } from "./logic/guest-engine";
import {
  boardFromSessionView,
  classifyMove,
  highestTile,
} from "./logic/merge-engine";
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
  progression: { enabled: true },
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
  /** Device-local guest result; absent on historical on-chain rows. */
  won?: boolean;
}

export type { LeaderEntry };
export type { MergeRow as SolveRow };

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
    const obs = app.game.session.observables<MergeRow>(ctx.t);

    // ── Merge-kingdom specific observables ───────────────────────────────────
    const board        = createObservable<number[][]>([]);
    const tileAchieved = createObservable(0);
    const moveCount    = createObservable(0);
    // lastPayout is a fixed8 bigint in this game
    const lastPayoutFixed8 = createObservable<bigint>(0n);
    const walletConnected = createDerived(
      () => app.wallet.isConnected(),
      [app.chain.address],
    );
    const isConnectingWallet = createObservable(false);
    const isMoving = createObservable(false);
    const inputSyncFailed = createObservable(false);
    const isRecovering = createObservable(false);

    let session: RewardGameSession | null = null;

    const publishBoard = (next: number[][]): void => {
      board.set(next.map((row) => [...row]));
      tileAchieved.set(highestTile(next));
    };

    // ── Play mode (guest | gamefi) ────────────────────────────────────────────
    // Mirror the launcher-selected mode into an observable the PlayArea/scene
    // read, so guest can drop the GAS-at-stake / pool / reward framing while
    // GAMEFI copy stays exactly as-is.
    const appMode = createObservable<string>(app.mode.get());

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local merge engine — no chain/oracle/reward calls.
    const guestLeaderboard = import.meta.env.DEV
      ? {
          async submit(): Promise<void> { return; },
          async get(): Promise<Array<{ user: string; score: string }>> { return []; },
        }
      : app.mode.guestLeaderboard;
    const guest = createGuestEngine({
      obs,
      board,
      tileAchieved,
      moveCount,
      lastPayoutFixed8,
      guestLeaderboard,
      storage: app.storage.local,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the mode observable in sync; switching to guest at the launcher resets
    // to a clean local lobby and loads the off-chain guest board (replacing the
    // on-chain read done on mount).
    const stopModeSync = app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") void guest.enter();
    });

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

    // Merge-kingdom leaderboard uses `player`/`solved` field names (not standard).
    const loadLeaderboard = async () => {
      if (app.mode.isGuest()) return;
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
    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      obs.lastStatus.set("shuffling");
      session = null;
      try {
        // Capture the contract clock before contacting Morpheus so expiry
        // recovery remains available even when the session host is down.
        const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        session = await rewardGame.openSession(gameId, difficulty);
        obs.commitment.set(session.commitment);
        const openedBoard = boardFromSessionView(session.view);
        if (!openedBoard) throw new Error(ctx.t("invalidBoardState"));
        publishBoard(openedBoard);
        moveCount.set(0);
        inputSyncFailed.set(false);
        obs.gameStatus.set("dealt");
        obs.undosUsed.set(0);
        obs.lastStatus.set("dealt");
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        session = null;
        obs.lastStatus.set("deal-pending");
        ctx.setError(error, "statusFailed");
        return false;
      } finally {
        obs.isDealing.set(false);
      }
    };

    const resumeSession = async (
      gameId: string,
      difficulty: number,
      announce = false,
    ): Promise<boolean> => {
      try {
        const restored = await rewardGame.openSession(gameId, difficulty);
        if (obs.commitment.get() && restored.commitment !== obs.commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = restored;
        obs.commitment.set(restored.commitment);
        const ops = rewardGame.storage.load(gameId);
        moveCount.set(ops.length);
        const restoredBoard = boardFromSessionView(restored.view);
        if (!restoredBoard) throw new Error(ctx.t("invalidBoardState"));
        let live = restoredBoard;
        await rewardGame.replayOps(restored, ops, (step) => {
          const grid = boardFromSessionView(step.view);
          if (!grid) throw new Error(ctx.t("invalidBoardState"));
          live = grid;
        });
        publishBoard(live);
        inputSyncFailed.set(false);
        return true;
      } catch (error) {
        session = null;
        inputSyncFailed.set(true);
        obs.lastStatus.set("input-sync-failed");
        if (announce) {
          ctx.setError(error, "statusFailed");
        }
        return false;
      }
    };

    const finishFromSnapshot = async (
      gameId: string,
      snapshot: Awaited<ReturnType<typeof rewardGame.snapshot>>,
      announce = true,
    ): Promise<void> => {
      const achieved = asNumber(mapField(snapshot.raw, "tileAchieved"));
      const undos = asNumber(mapField(snapshot.raw, "undos"));
      const rewarded = snapshot.status === "solved" && snapshot.payoutFixed8 > 0n;

      obs.gameDifficulty.set(snapshot.difficulty);
      obs.commitment.set(snapshot.commitment);
      obs.dealtAt.set(snapshot.dealtAt);
      obs.deadline.set(snapshot.deadline);
      obs.lastElapsedMs.set(snapshot.solveMs);
      obs.undosUsed.set(undos);
      lastPayoutFixed8.set(snapshot.payoutFixed8);
      tileAchieved.set(achieved);
      obs.gameStatus.set(rewarded ? "solved" : "expired");
      obs.activeGameId.set("0");
      session = null;
      inputSyncFailed.set(false);
      rewardGame.storage.forget(gameId);

      if (rewarded) {
        obs.lastStatus.set("solved");
        if (announce) {
          ctx.setStatus(ctx.t("statusSolved", { payout: snapshot.payoutGas.toFixed(2) }), "success");
        }
      } else {
        obs.lastStatus.set("expired");
        if (announce) ctx.setStatus(ctx.t("statusExpired"), "info");
      }
      await Promise.allSettled([refreshBalances(), refreshStats(), loadLeaderboard()]);
    };

    const recoverCurrentGame = async (
      preferredGameId?: string,
      announce = true,
    ): Promise<boolean> => {
      if (app.mode.isGuest() || isRecovering.get()) return false;
      const gameId = preferredGameId && preferredGameId !== "0"
        ? preferredGameId
        : obs.activeGameId.get();
      if (!gameId || gameId === "0") return false;

      isRecovering.set(true);
      try {
        const snapshot = await rewardGame.snapshot(gameId);
        obs.activeGameId.set(gameId);
        app.game.session.applySnapshot(obs, snapshot.raw, sessionStatusOf);

        if (
          snapshot.status === "solved"
          || snapshot.status === "expired"
          || snapshot.status === "refunded"
        ) {
          await finishFromSnapshot(gameId, snapshot, announce);
          return true;
        }

        if (snapshot.status === "unknown") {
          session = null;
          obs.gameStatus.set("unknown");
          obs.lastStatus.set("settlement-pending");
          if (announce) ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return true;
        }

        inputSyncFailed.set(false);
        if (snapshot.status === "dealt") {
          obs.lastStatus.set("dealt");
          await resumeSession(gameId, snapshot.difficulty, announce);
          return true;
        }

        obs.lastStatus.set("deal-pending");
        await openSession(gameId, snapshot.difficulty);
        return true;
      } catch (error) {
        if (announce) {
          ctx.setError(error, "statusFailed");
        }
        return false;
      } finally {
        isRecovering.set(false);
      }
    };

    /**
     * Resolve an operation whose start transaction may have been broadcast but
     * whose GameStarted event never reached this client. The contract's
     * activeGameOf index is authoritative and prevents a second paid entry.
     */
    const recoverActiveGame = async (announce = true): Promise<boolean> => {
      if (app.mode.isGuest() || isRecovering.get()) return false;
      const active = await rewardGame.recoverActive();
      if (!active.snapshot || active.gameId === "0") return false;
      obs.activeGameId.set(active.gameId);
      return recoverCurrentGame(active.gameId, announce);
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    app.actions.register("connectWallet", async () => {
      if (app.mode.isGuest() || isConnectingWallet.get() || app.wallet.isConnected()) return;
      isConnectingWallet.set(true);
      try {
        const address = await app.wallet.ensure();
        if (!address) throw new Error(ctx.t("walletUnavailable"));
        await Promise.allSettled([refreshBalances(), refreshStats(), loadLeaderboard()]);
        obs.lastStatus.set("ready");
        ctx.setStatus(ctx.t("walletConnectedReady"), "success");
      } catch (error) {
        ctx.setError(error, "walletUnavailable");
        throw error;
      } finally {
        isConnectingWallet.set(false);
      }
    });
    app.actions.register("selectDifficulty", async (...args: unknown[]) => {
      if (
        obs.isStarting.get()
        || obs.isDealing.get()
        || obs.isSubmitting.get()
        || !["idle", "solved", "expired", "refunded"].includes(obs.gameStatus.get())
      ) return;
      const raw = Number(args[0] ?? 0);
      obs.gameDifficulty.set(Math.max(0, Math.min(2, Number.isFinite(raw) ? Math.round(raw) : 0)));
    });

    app.actions.register("startGame", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.startGame(Number(args[0] ?? 0)); return; }
      if (!GAMEFI_NEW_ENTRIES_ENABLED) {
        ctx.setStatus(ctx.t("gameFiMaintenanceBody"), "info");
        return;
      }
      if (
        obs.isStarting.get()
        || obs.isDealing.get()
        || obs.isSubmitting.get()
        || obs.activeGameId.get() !== "0"
        || !["idle", "solved", "expired", "refunded"].includes(obs.gameStatus.get())
      ) return;
      const rawDifficulty = Number(args[0] ?? 0);
      const difficulty = Math.max(
        0,
        Math.min(2, Number.isFinite(rawDifficulty) ? Math.round(rawDifficulty) : 0),
      );
      const rule = DIFFICULTY_RULES[difficulty] ?? DIFFICULTY_RULES[0]!;
      if (obs.poolFree.get() < fromFixed8(BigInt(rule.reward))) {
        ctx.setStatus(ctx.t("statusPoolLow"), "info");
        return;
      }
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
        inputSyncFailed.set(false);
        obs.gameStatus.set("committed");
        obs.lastStatus.set("started");
        await refreshBalances();
        await openSession(gameId, difficulty);
        return started.tx;
      } catch (error) {
        session = null;
        // A wallet/RPC timeout can arrive after the paid start was broadcast.
        // First ask the contract for the player's authoritative active game;
        // never offer another entry while that outcome remains uncertain.
        try {
          if (await recoverActiveGame(true)) return;
        } catch { /* preserve the uncertain state below */ }

        const code = error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";
        const family = classifyChainError(error);
        const definitelyNotBroadcast = [
          "BAD_WALLET",
          "DIFFICULTY_LOCKED",
          "NO_CONTRACT",
          "POOL_LOW",
        ].includes(code) || [
          "userRejected",
          "contractUnavailable",
          "insufficientGas",
          "transactionFailed",
        ].includes(family ?? "");

        if (definitelyNotBroadcast) {
          obs.gameStatus.set("idle");
          obs.lastStatus.set("failed");
          ctx.setError(error, "statusFailed");
          throw error;
        }

        obs.gameStatus.set("unknown");
        obs.lastStatus.set("settlement-pending");
        ctx.setStatus(ctx.t("statusSettlementPending"), "info");
        return;
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = obs.activeGameId.get();
      if (
        !gameId
        || gameId === "0"
        || obs.isDealing.get()
        || obs.gameStatus.get() !== "committed"
      ) return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("recordMove", async (...args: unknown[]) => {
      if (app.mode.isGuest()) {
        guest.recordMove(Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3]));
        return;
      }
      const fromRow = Number(args[0]);
      const fromCol = Number(args[1]);
      const toRow   = Number(args[2]);
      const toCol   = Number(args[3]);
      const gameId  = obs.activeGameId.get();
      if (
        !gameId
        || gameId === "0"
        || !session
        || obs.gameStatus.get() !== "dealt"
        || isMoving.get()
        || inputSyncFailed.get()
      ) return;
      if (obs.deadline.get() > 0 && Date.now() >= obs.deadline.get()) return;
      const inRange = (v: number) => Number.isInteger(v) && v >= 0 && v < BOARD_SIZE;
      if (![fromRow, fromCol, toRow, toCol].every(inRange)) return;
      if (!classifyMove(board.get(), { row: fromRow, col: fromCol }, { row: toRow, col: toCol })) {
        return;
      }
      isMoving.set(true);
      try {
        const { step } = await rewardGame.recordOp(session, {
          type: "move", from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol },
        });
        const grid = boardFromSessionView(step.view);
        if (!grid || step.view.ok === false) throw new Error(ctx.t("statusMoveRejected"));
        publishBoard(grid);
        moveCount.set(step.opCount);
        inputSyncFailed.set(false);
      } catch (error) {
        inputSyncFailed.set(true);
        obs.lastStatus.set("input-sync-failed");
        ctx.setError(error, "statusInputSyncFailed");
        throw error;
      } finally {
        isMoving.set(false);
      }
    });

    app.actions.register("submitSolution", async () => {
      if (app.mode.isGuest()) { await guest.submitSolution(); return; }
      const gameId = obs.activeGameId.get();
      if (
        !gameId
        || gameId === "0"
        || obs.isSubmitting.get()
        || isMoving.get()
        || isRecovering.get()
        || inputSyncFailed.get()
        || obs.gameStatus.get() !== "dealt"
      ) return;
      const rule = DIFFICULTY_RULES[obs.gameDifficulty.get()] ?? DIFFICULTY_RULES[0]!;
      const now = Date.now();
      if (tileAchieved.get() < rule.targetTile) return;
      if (obs.deadline.get() > 0 && now >= obs.deadline.get()) return;
      if (obs.dealtAt.get() <= 0 || now < obs.dealtAt.get() + rule.minSolveMs) {
        ctx.setStatus(ctx.t("proofNotReady"), "info");
        return;
      }
      obs.isSubmitting.set(true);
      obs.lastStatus.set("submitting");
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get(), true);
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        const settled   = finalized.settlement;
        session = null;

        if (settled.status === "unknown") {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set("settlement-pending");
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return finalized.tx;
        }

        const snapshot = await rewardGame.snapshot(gameId);
        if (
          snapshot.status === "unknown"
          || snapshot.status === "dealt"
          || snapshot.status === "committed"
        ) {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set("settlement-pending");
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return finalized.tx;
        }
        await finishFromSnapshot(gameId, snapshot);
        return finalized.tx;
      } catch (error) {
        // A timeout can arrive after broadcast. Preserve this run until a
        // chain snapshot proves whether the callback settled it.
        session = null;
        obs.gameStatus.set("unknown");
        obs.lastStatus.set("settlement-pending");
        ctx.setError(error, "statusFailed");
        throw error;
      } finally {
        obs.isSubmitting.set(false);
      }
    });

    app.actions.register("refreshGame", async () => {
      if (app.mode.isGuest()) return;
      if (obs.activeGameId.get() !== "0") {
        await recoverCurrentGame(undefined, true);
        return;
      }
      await recoverActiveGame(true);
    });

    app.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { await guest.expireGame(); return; }
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || isRecovering.get()) return;
      if (!canExpireAfterGrace(obs.deadline.get())) {
        ctx.setStatus(ctx.t("releaseNotReady"), "info");
        return;
      }
      isRecovering.set(true);
      try {
        await rewardGame.expire(gameId);
        session = null;
        // Hand the lock to authoritative snapshot recovery; it owns the same
        // observable and would otherwise treat our outer lock as a duplicate.
        isRecovering.set(false);
        const recovered = await recoverCurrentGame(gameId, true);
        if (!recovered) {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set("settlement-pending");
        }
      } catch (error) {
        session = null;
        obs.gameStatus.set("unknown");
        obs.lastStatus.set("settlement-pending");
        ctx.setError(error, "statusFailed");
        throw error;
      } finally {
        isRecovering.set(false);
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
        board,
        tileAchieved,
        moveCount,
        lastPayoutFixed8,
        walletConnected,
        isConnectingWallet,
        isMoving,
        inputSyncFailed,
        isRecovering,
        appMode,
      },
      loadData: async () => {
        // Guest is a purely local game: skip every mount-time chain read (the
        // guest engine's enter() already staged a clean local lobby + board).
        if (app.mode.isGuest()) { await guest.enter(); return; }
        await refreshBalances();
        if (app.game.player.scriptHash()) {
          try { await recoverActiveGame(false); } catch { /* no active game */ }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set("");
      },
      cleanup: () => {
        stopModeSync();
        session = null;
      },
    };
  },
});

import { createObservable, defineMiniApp } from "@shared/react";
import type { Observable } from "@shared/react";
import { parseBigInt } from "@shared/utils/parsers";
import { addressToScriptHash } from "@shared/utils/neo";
import { eventStateValue } from "@shared/utils/chain-events";
import type { RewardGameConfig, RewardGameSession } from "@framework/gamefi";
import type { SolveRow } from "@framework/game";
import type { TeeSessionOp } from "@framework/logic/tee-session";
import type { FrameworkPlatformGameSnapshot } from "@framework/platform-game-surface";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  ENTRY_MEMO,
  GAMEFI_MAX_UNDOS,
  SETTLE_GRACE_MS,
  ruleOf,
  gasDisplay,
} from "./logic/game-rules";
import { createGuestEngine } from "./logic/guest-engine";
import type { Platform } from "./logic/jump-engine";

const appId = "miniapp-jump-rush";
const ENGINE_HASH = "a61fca9f6cfc3a88cde4230d6817d7fc84491f42b03815453775585a3d9c820f";
/** Paid starts remain unavailable until the contract and Morpheus rules match. */
const GAMEFI_NEW_ENTRIES_ENABLED = false;

const LEADERBOARD_EVENT_LIMIT = 200;
type TeeOp = ({ type: "jump"; chargeLevel: number } | { type: "undo" }) & TeeSessionOp;

const rewardGameConfig: RewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo: ENTRY_MEMO,
  modes: [0, 1, 2].map((difficulty) => {
    const rule = ruleOf(difficulty);
    return {
      id: difficulty,
      key: rule.key,
      entryFixed8: rule.entryFixed8,
      rewardFixed8: rule.rewardFixed8,
      limitMs: rule.limitMs,
      minSolveMs: rule.minSolveMs,
      target: rule.targetJumps,
    };
  }),
};

function asNumber(value: unknown): number {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
}

/**
 * The chrome's read-out of a player's global ranking, across three honest
 * phases. `myRank` stays a plain number for the PlayArea; this is what the
 * stat rail and sidebar bind, because a bare integer cannot tell the truth:
 *
 *   · `undefined` (unread)  → `undefined`, so the shell renders the binding's
 *                             pendingKey copy. The read has not settled.
 *   · `>= 1` (ranked)       → "#N", a real place on the board.
 *   · `<= 0` (unranked)     → an honest word, never "0". Rank 0 does not exist;
 *                             a settled 0 means no board position (always so in
 *                             local guest play). A real reading, not an absence.
 */
export function formatRankDisplay(
  rank: number | undefined,
  t: (key: string) => string,
): string | undefined {
  if (rank === undefined) return undefined;
  return rank >= 1 ? `#${rank}` : t("rankUnranked");
}

export interface LeaderEntry {
  rank: number;
  address: string;
  totalWon: number;
  runs: number;
  isUser: boolean;
}

export interface RunRow {
  gameId: string;
  difficulty: number;
  elapsedMs: number;
  undos: number;
  jumps: number;
  /** Null when the deployed Solved event does not publish the perfect count. */
  perfects: number | null;
  payout: string;
}

type SharedRunRow = SolveRow & Pick<RunRow, "jumps" | "perfects">;

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    // Route ad-hoc arg-building / reads / invokes / events through the MiniApp
    // framework SDK. Behaviour-preserving: arg.* builders emit the identical
    // stack items, and readRaw/invoke/events/detectNetwork are raw passthroughs
    // to the host chain service the framework wraps.
    const app = ctx.framework;
    const rewardGame = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: `neo:${appId}:ops/`,
    });

    // Fail closed for direct Vite launches and stale platform hosts. The public
    // manifest intentionally exposes only local practice until the live
    // Morpheus and contract schemas/timing rules have passed full settlement.
    if (manifest.supportsGameFi === false && !app.mode.isGuest()) {
      app.mode.set("guest");
    }
    const credit = createObservable(0);
    const poolFree = createObservable(0);
    const activeGameId = createObservable("0");
    const gameStatus = createObservable("idle");
    const gameDifficulty = createObservable(0);
    const platformsView = createObservable<Platform[]>([]);
    const commitment = createObservable("");
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
    const startedAt = createObservable(0);
    const undosUsed = createObservable(0);
    const lastPayout = createObservable("");
    const lastElapsedMs = createObservable(0);
    const leaderboard = createObservable<LeaderEntry[]>([]);
    // `undefined`, not 0, until a read settles. These bind straight into shell
    // chrome (stat rail + sidebar) that MiniAppRoot renders with no loading gate
    // of its own, so a `0` at rest was published as "Best run 0 / Runs 0 / Rank
    // 0" before any leaderboard or profile read had run — a fabricated claim,
    // not an absence. `undefined` is the shell's pendingKey trigger; a SETTLED 0
    // is a real reading (a player with 0 runs) and still renders as 0.
    const myRank = createObservable<number | undefined>(undefined);
    const myTotalWon = createObservable<number | undefined>(undefined);
    const myRuns = createObservable<number | undefined>(undefined);
    const myHistory = createObservable<RunRow[]>([]);
    const isStarting = createObservable(false);
    const isDealing = createObservable(false);
    const isSubmitting = createObservable(false);
    const isUndoing = createObservable(false);
    const lastStatus = createObservable(ctx.t("statusReady"));

    // Jump Rush specific observables
    const currentPlatform = createObservable(0);
    const jumpCount = createObservable(0);
    const perfectCount = createObservable(0);
    const comboCount = createObservable(0);
    const chargeLevel = createObservable(0);
    const isCharging = createObservable(false);
    const isJumping = createObservable(false);
    const missedPlatform = createObservable(false);
    const inputSyncFailed = createObservable(false);

    // Current play mode, mirrored into an observable the PlayArea reads so the
    // GAS-centric copy can switch to local/practice framing in guest mode. Kept
    // in sync with the launcher-selected framework mode via app.mode.onChange.
    const appMode = createObservable(app.mode.get());

    // The chrome's read-out of the ranking. `myRank` stays a plain number for
    // the PlayArea's `myRank > 0` arithmetic; this derivation is what the stat
    // rail and sidebar bind, because "Global rank" cannot be printed as a bare
    // integer without lying:
    //
    //   · unread   → `undefined`. The read has not settled; the shell renders
    //                the binding's pendingKey copy.
    //   · ranked   → "#N". A real place on the board.
    //   · unranked → an honest word, never "0". Rank 0 does not exist; a
    //                settled `0` means the player holds no board position
    //                (always so in guest, where play is local, not globally
    //                ranked). This is a real reading, distinct from unread.
    const myRankDisplay: Observable<string | undefined> = {
      get: () => formatRankDisplay(myRank.get(), ctx.t),
      set: () => {},
      subscribe: (fn) => myRank.subscribe(fn),
    };

    // TEE session context for the active shared-engine game.
    let session: RewardGameSession | null = null;

    const playerScriptHash = (): string => {
      const player = app.chain.address.get();
      return player ? addressToScriptHash(player) : "";
    };

    const refreshBalances = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      try {
        const balances = await rewardGame.balances(playerScriptHash());
        poolFree.set(balances.poolFreeGas);
        credit.set(balances.creditGas);
      } catch {
        /* keep the previous values — reads are best-effort */
      }
    };

    const refreshStats = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      const playerHash = playerScriptHash();
      if (!playerHash) return;
      try {
        const stats = await app.game.stats.load(playerHash);
        myRuns.set(stats.solves);
        myTotalWon.set(stats.totalWon);
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
      if (app.mode.isGuest()) return;
      try {
        const { ranked, mine } = await app.game.leaderboard.load<SharedRunRow>(
          "Solved",
          { solvedPayout: 5, totalWon: 6, undos: 7 },
          LEADERBOARD_EVENT_LIMIT,
          (event) => {
            const difficulty = asNumber(eventStateValue(event, 2));
            return {
              jumps: ruleOf(difficulty).targetJumps,
              perfects: null,
            };
          },
        );
        const rows = ranked.map((entry) => ({ ...entry, runs: entry.solves }));
        leaderboard.set(rows);
        const me = rows.find((entry) => entry.isUser);
        myRank.set(me ? me.rank : 0);
        myHistory.set(mine.slice(0, 12).map((row) => ({
          gameId: row.gameId,
          difficulty: row.difficulty,
          elapsedMs: row.solveMs,
          undos: row.undos,
          jumps: row.jumps,
          perfects: row.perfects,
          payout: row.payout,
        })));
      } catch {
        /* indexer unreachable — the board stays playable without rankings */
      }
    };

    const applyGameSnapshot = (game: FrameworkPlatformGameSnapshot): void => {
      gameStatus.set(game.status);
      gameDifficulty.set(game.difficulty);
      if (game.commitment) commitment.set(game.commitment);
      dealtAt.set(game.dealtAt);
      deadline.set(game.deadline);
      startedAt.set(game.startTime);
      undosUsed.set(game.undos);
    };

    const applyProgressView = (view: Record<string, unknown>): void => {
      currentPlatform.set(asNumber(view.platformIndex));
      jumpCount.set(asNumber(view.jumps));
      perfectCount.set(asNumber(view.perfects));
      comboCount.set(0);
      missedPlatform.set(view.failed === true);
    };

    const restoreSharedSession = async (
      gameId: string,
      difficulty: number,
    ): Promise<RewardGameSession> => {
      const started = await rewardGame.openSession(gameId, difficulty);
      const ops = rewardGame.storage.load(gameId);
      let progressView = started.currentView;
      if (started.opCount === 0 && ops.length > 0) {
        const replayed = await rewardGame.replayOps(started, ops);
        progressView = replayed.at(-1)?.view ?? started.view;
      } else if (started.opCount !== ops.length) {
        throw new Error(ctx.t("statusFailed"));
      }
      const platforms = Array.isArray(started.view.platforms)
        ? started.view.platforms as Platform[]
        : [];
      if (platforms.length === 0) throw new Error(ctx.t("statusFailed"));
      session = started;
      platformsView.set(platforms);
      applyProgressView(progressView);
      commitment.set(started.commitment);
      return started;
    };

    /**
     * Open the generic confidential session for the active PlatformGame run.
     * The TEE start is deterministic per game, so retries and reloads converge
     * on the same platform layout.
     */
    const openSharedSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      isDealing.set(true);
      lastStatus.set(ctx.t("statusSealing"));
      try {
        await restoreSharedSession(gameId, difficulty);
        const game = await app.platformGame.getGame(gameId);
        if (game) applyGameSnapshot(game);
        gameStatus.set("dealt");
        undosUsed.set(0);
        chargeLevel.set(0);
        isCharging.set(false);
        isJumping.set(false);
        missedPlatform.set(false);
        inputSyncFailed.set(false);
        lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        const message = app.errors.messageOf(error, ctx.t("statusFailed"));
        lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(message, "error");
        return false;
      } finally {
        isDealing.set(false);
      }
    };

    /** Reattach to an active game after reload: same TEE identity and layout. */
    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const previousCommitment = commitment.get();
        const started = await restoreSharedSession(gameId, difficulty);
        if (previousCommitment && started.commitment !== previousCommitment) {
          throw new Error(ctx.t("statusFailed"));
        }
      } catch {
        session = null;
        lastStatus.set(ctx.t("statusDealPending"));
      }
    };

    const sendOp = async (op: TeeOp): Promise<Record<string, unknown>> => {
      if (!session) throw new Error(ctx.t("statusFailed"));
      const result = await rewardGame.recordOp(session, op);
      return result.step.view;
    };

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local platform runner — no chain/oracle/reward calls.
    const guestLeaderboard = import.meta.env.DEV
      ? {
          async submit(): Promise<void> { return; },
          async get(): Promise<Array<{ user: string; score: string }>> { return []; },
        }
      : app.mode.guestLeaderboard;
    const guest = createGuestEngine({
      gameStatus,
      activeGameId,
      gameDifficulty,
      platformsView,
      commitment,
      dealtAt,
      deadline,
      undosUsed,
      lastPayout,
      lastElapsedMs,
      leaderboard,
      myRank,
      myTotalWon,
      myRuns,
      myHistory,
      isStarting,
      isDealing,
      isSubmitting,
      isUndoing,
      lastStatus,
      jumpCount,
      currentPlatform,
      perfectCount,
      comboCount,
      chargeLevel,
      isCharging,
      isJumping,
      missedPlatform,
      guestLeaderboard,
      storage: app.storage.local,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the PlayArea's mode mirror in sync, and — when switching to guest at
    // the launcher — reset to a clean local lobby + load the off-chain board.
    app.mode.onChange((mode) => {
      if (manifest.supportsGameFi === false && mode !== "guest") {
        app.mode.set("guest");
        return;
      }
      appMode.set(mode);
      if (mode === "guest") {
        inputSyncFailed.set(false);
        void guest.enter();
      }
    });

    ctx.framework.actions.register("selectDifficulty", async (...args: unknown[]) => {
      const status = gameStatus.get();
      if (status !== "idle" && status !== "solved" && status !== "expired" && status !== "refunded") return;
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Math.round(Number(form.difficulty) || 0)));
      gameDifficulty.set(difficulty);
    });

    ctx.framework.actions.register("startGame", async (...args: unknown[]) => {
      if (app.mode.isGuest()) {
        const form = (args[0] ?? {}) as { difficulty?: unknown };
        guest.startGame(Number(form.difficulty ?? 0));
        return;
      }
      if (!GAMEFI_NEW_ENTRIES_ENABLED) {
        app.mode.set("guest");
        lastStatus.set(ctx.t("paidModeUnavailable"));
        ctx.setStatus(lastStatus.get(), "info");
        return;
      }
      if (isStarting.get() || isDealing.get()) return;
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      isStarting.set(true);
      lastStatus.set(ctx.t("statusStarting"));
      try {
        const result = await rewardGame.start(difficulty);
        const gameId = result.gameId;
        activeGameId.set(gameId);
        gameDifficulty.set(difficulty);
        undosUsed.set(0);
        platformsView.set([]);
        commitment.set("");
        dealtAt.set(0);
        deadline.set(0);
        startedAt.set(Date.now());
        gameStatus.set("dealt");
        inputSyncFailed.set(false);
        lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        void openSharedSession(gameId, difficulty);
        return result.tx;
      } catch (error) {
        const message = app.errors.messageOf(error, ctx.t("statusFailed"));
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isStarting.set(false);
      }
    });

    // Retry opening a shared session after a transient TEE failure.
    ctx.framework.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = activeGameId.get();
      if (gameId === "0" || isDealing.get() || gameStatus.get() !== "dealt") return;
      await openSharedSession(gameId, gameDifficulty.get());
    });

    // Record a jump in the TEE session for telemetry + undo accounting.
    ctx.framework.actions.register("recordJump", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        chargeLevel?: unknown;
        landed?: unknown;
        perfect?: unknown;
        platformIndex?: unknown;
      };
      if (app.mode.isGuest()) {
        guest.recordJump(
          Number(form.platformIndex ?? 0),
          form.landed !== false,
          form.perfect === true,
        );
        return;
      }
      const chargeLevel = Math.round(Number(form.chargeLevel));
      if (!Number.isInteger(chargeLevel) || chargeLevel < 0 || chargeLevel > 100) return;
      try {
        const view = await sendOp({ type: "jump", chargeLevel });
        inputSyncFailed.set(false);
        if (view.landed !== true || view.failed === true) {
          applyProgressView(view);
          missedPlatform.set(true);
          comboCount.set(0);
          return;
        }
        const previousCombo = comboCount.get();
        applyProgressView(view);
        comboCount.set(view.perfect === true ? previousCombo + 1 : 0);
        missedPlatform.set(false);
      } catch (error) {
        inputSyncFailed.set(true);
        const message = app.errors.messageOf(error, ctx.t("statusInputSyncFailed"));
        lastStatus.set(ctx.t("statusInputSyncFailed"));
        ctx.setStatus(message, "error");
        throw error;
      }
    });

    // Paid undo: recorded in the TEE session (no transaction).
    ctx.framework.actions.register("useUndo", async () => {
      if (app.mode.isGuest()) { guest.useUndo(); return; }
      const gameId = activeGameId.get();
      if (gameId === "0" || isUndoing.get() || gameStatus.get() !== "dealt") return;
      if (undosUsed.get() >= GAMEFI_MAX_UNDOS) {
        ctx.setStatus(ctx.t("undoLimitReached"), "info");
        return;
      }
      isUndoing.set(true);
      try {
        await sendOp({ type: "undo" });
        const undos = undosUsed.get() + 1;
        undosUsed.set(undos);
        missedPlatform.set(false);
        inputSyncFailed.set(false);
        lastStatus.set(ctx.t("statusUndoUsed", { pct: String(100 - 30 * undos) }));
        ctx.setStatus(lastStatus.get(), "info");
      } catch (error) {
        const message = app.errors.messageOf(error, ctx.t("statusFailed"));
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isUndoing.set(false);
      }
    });

    ctx.framework.actions.register("submitRun", async () => {
      if (app.mode.isGuest()) { await guest.submitRun(); return; }
      const gameId = activeGameId.get();
      if (gameId === "0" || isSubmitting.get() || gameStatus.get() !== "dealt") return;
      isSubmitting.set(true);
      lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) {
          await resumeSession(gameId, gameDifficulty.get());
        }
        if (!session) throw new Error(ctx.t("statusFailed"));
        const result = await rewardGame.finalize(session);
        const payoutGas = result.settlement.payoutGas;
        lastPayout.set(`${payoutGas.toFixed(2)} GAS`);
        lastElapsedMs.set(result.settlement.elapsedMs);
        if (result.settlement.status === "unknown") {
          gameStatus.set("unknown");
          lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(lastStatus.get(), "info");
          return result.tx;
        }
        gameStatus.set(result.settlement.status);
        activeGameId.set("0");
        session = null;
        lastStatus.set(
          result.settlement.status === "solved"
            ? ctx.t("statusSolved", { payout: payoutGas.toFixed(2) })
            : ctx.t("statusExpired"),
        );
        ctx.setStatus(lastStatus.get(), result.settlement.status === "solved" ? "success" : "info");
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
        return result.tx;
      } catch (error) {
        const message = app.errors.messageOf(error, ctx.t("statusFailed"));
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isSubmitting.set(false);
      }
    });

    // Permissionless housekeeping: release the reward reservation of a game
    // whose settlement deadline and grace period have passed.
    ctx.framework.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      const gameId = activeGameId.get();
      if (gameId === "0") return;
      const status = gameStatus.get();
      const now = Date.now();
      const canExpire = status === "dealt"
        && deadline.get() > 0
        && now > deadline.get() + SETTLE_GRACE_MS;
      if (!canExpire) {
        ctx.setStatus(ctx.t("statusReleasePending"), "info");
        return;
      }
      try {
        await rewardGame.expire(gameId);
        gameStatus.set("expired");
        activeGameId.set("0");
        session = null;
        lastStatus.set(ctx.t("statusExpired"));
        ctx.setStatus(ctx.t("statusExpired"), "info");
        await refreshBalances();
      } catch (error) {
        const message = app.errors.messageOf(error, ctx.t("statusFailed"));
        ctx.setStatus(message, "error");
        throw error;
      }
    });

    // Framework operation keeps notify.guard semantics: success toast only
    // after a real withdrawal, error toast + swallow on failure — while the
    // pre-check early returns stay silent.
    const withdrawOp = app.operations.create("withdrawWinnings");

    ctx.framework.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      const playerHash = playerScriptHash();
      if (!playerHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      if (credit.get() <= 0) {
        ctx.setStatus(ctx.t("noCreditToWithdraw"), "info");
        return;
      }
      await withdrawOp.run(async () => {
        await rewardGame.withdrawCredit();
        await refreshBalances();
      }, { successKey: "creditWithdrawn" });
    });

    ctx.framework.actions.register("refreshLeaderboard", async () => {
      if (app.mode.isGuest()) { await guest.refreshLeaderboard(); return; }
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    return {
      state: {
        credit,
        poolFree,
        activeGameId,
        gameStatus,
        gameDifficulty,
        platformsView,
        commitment,
        dealtAt,
        deadline,
        startedAt,
        undosUsed,
        lastPayout,
        lastElapsedMs,
        leaderboard,
        myRank,
        myRankDisplay,
        myTotalWon,
        myRuns,
        myHistory,
        isStarting,
        isDealing,
        isSubmitting,
        isUndoing,
        lastStatus,
        // Jump Rush specific
        currentPlatform,
        jumpCount,
        perfectCount,
        comboCount,
        chargeLevel,
        isCharging,
        isJumping,
        missedPlatform,
        inputSyncFailed,
        // Play mode mirror consumed by the PlayArea to pick local vs GAS copy.
        appMode,
      },
      loadData: async () => {
        // Guest is a local game: skip every chain read and load the off-chain
        // board instead, so no chain/oracle call is made in guest mode.
        if (app.mode.isGuest()) { await guest.enter(); return; }
        await refreshBalances();
        const playerHash = playerScriptHash();
        if (playerHash) {
          try {
            const recovered = await rewardGame.recoverActive();
            const active = recovered.gameId;
            if (active !== "0") {
              activeGameId.set(active);
              const game = await app.platformGame.getGame(active);
              if (game) applyGameSnapshot(game);
              if (gameStatus.get() === "dealt") {
                await resumeSession(active, gameDifficulty.get());
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

/**
 * framework/gamefi/reward-runner — reward-game lifecycle runner (RFC P0-7).
 *
 * Each TEE reward game hand-wires the same lifecycle state machine in its
 * main.tsx: the openSession wrapper, resumeSession + replayOps recovery, the
 * settlement apply + snapshot verify, the wallet-change session reset, the
 * refreshBalances/refreshStats/loadLeaderboard trio, and the four standard
 * actions. The runner composes the EXISTING reward-game SDK primitives
 * (start/openSession/recordOp/replayOps/finalize/recoverActive/expire/
 * withdrawCredit/snapshot) into that state machine once — the primitives stay
 * exported and remain the escape hatch.
 *
 * The game supplies only its deterministic logic through
 * {@link FrameworkRewardRunnerHooks}: `createView` builds the fresh game view
 * for a session, `applyOp` advances it one op (used identically for live play
 * and resume-replay), `verifyView` checks the local view against the on-chain
 * snapshot at settlement.
 *
 * Wallet-change reset is wired internally via `wallet.onAccountChanged`
 * (RFC P0-5): an identity change clears the session/view and lands on
 * `"settlement-pending"` when a settlement was in flight, `"idle"` otherwise.
 */

import { createObservable, type Observable } from "../reactive";
import { singleFlight } from "../utils/async-utils";
import type { TeeSessionOp, TeeStepResult } from "../logic/tee-session";
import { RewardGameError } from "./reward-game-sdk";
import type {
  NormalizedRewardGameMode,
  RewardGameBalances,
  RewardGameConfig,
  RewardGameFinalizeResult,
  RewardGameRecoverResult,
  RewardGameSession,
  RewardGameSnapshot,
  RewardGameStartResult,
  RewardGameStepResult,
  RewardGameStorage,
  RewardGameTxResult,
} from "./reward-game-sdk";

/** Lifecycle phases the runner drives (observable + `onPhase` tap). */
export type FrameworkRewardPhase =
  | "idle"
  | "dealing"
  | "deal-pending"
  | "playing"
  | "finalizing"
  | "settlement-pending"
  | "settled"
  | "expired"
  | "error";

/** One ranked leaderboard row surfaced by {@link FrameworkRewardRunner.leaderboard}. */
export interface FrameworkRewardLeaderboardEntry {
  user: string;
  score: string;
}

/** The deterministic game logic a reward game plugs into the runner. */
export interface FrameworkRewardRunnerHooks<Op extends TeeSessionOp, View> {
  /** Build the fresh deterministic game view for a newly opened session. */
  createView(session: RewardGameSession): View;
  /** Apply one op — used identically for live play and resume-replay. */
  applyOp(view: View, op: Op): View;
  /**
   * Finalize-confirm verification: does the local view match the on-chain
   * snapshot? Omitted → accept (the settlement is authoritative regardless;
   * this hook only powers the "desync detected" UX).
   */
  verifyView?(view: View, snapshot: RewardGameSnapshot): boolean;
  /** Optional phase-transition tap (drive ctx.setStatus / scene changes). */
  onPhase?(phase: FrameworkRewardPhase, detail?: { error?: unknown }): void;
}

/** Options for {@link FrameworkRewardRunner.start}. */
export interface FrameworkRewardStartOptions {
  /** Explicit difficulty id (`RewardGameMode.id`). */
  difficulty?: number;
  /** Difficulty by mode key (`RewardGameMode.key`) — e.g. `"hard"`. */
  modeKey?: string;
}

/** Minimal actions-surface shape {@link FrameworkRewardRunner.registerStandardActions} needs. */
export interface RewardRunnerActionsSurface {
  register(key: string, handler: () => Promise<unknown>): void;
}

/**
 * The composed lifecycle state machine — see the module doc. All observables
 * are read via `.get()`/`.subscribe()` (framework reactive contract).
 */
export interface FrameworkRewardRunner<Op extends TeeSessionOp, View> {
  readonly phase: Observable<FrameworkRewardPhase>;
  readonly view: Observable<View | null>;
  readonly session: Observable<RewardGameSession | null>;
  readonly balances: Observable<RewardGameBalances | null>;
  readonly stats: Observable<unknown | null>;
  readonly leaderboard: Observable<FrameworkRewardLeaderboardEntry[]>;
  /**
   * openSession lane: `"dealing"` gate → SDK start (payment/credit entry) →
   * TEE session open → view fan-out → `"deal-pending"`. Re-entrant calls
   * join the in-flight start (single-flight). Errors set `"error"` and
   * rethrow (register the action with an errorKey for the toast).
   */
  start(options?: FrameworkRewardStartOptions): Promise<void>;
  /**
   * recoverActive + storage.load + replayOps + phase reconstruction.
   * Resolves `true` when a playable run was resumed (`"playing"` with ops,
   * `"deal-pending"` without); `false` when there is nothing to resume
   * (no wallet, no active game, or the active game already settled —
   * an expired game additionally lands the phase on `"expired"`).
   */
  resume(): Promise<boolean>;
  /**
   * Apply one op to the deterministic view (optimistically) and record it on
   * the TEE session. The first recorded op moves `"deal-pending"` →
   * `"playing"`. Record failures rethrow WITHOUT a phase transition — the
   * per-op failure is the game's call (retry, or `resume()` to resync).
   */
  record(op: Op): Promise<void>;
  /**
   * finalize (seal + broadcast) → settlement observe → snapshot verify →
   * `"settled"` (or `"expired"` for expired/refunded settlements) → refresh.
   * An unobservable settlement lands on `"settlement-pending"` (the op-log is
   * retained by the SDK for recovery). Errors set `"error"` and rethrow.
   */
  finalize(): Promise<void>;
  /** withdrawCredit (skips silently when no credit) + refresh. */
  withdraw(): Promise<void>;
  /** Expire the active game (recovering its id when needed) + refresh. */
  expire(): Promise<void>;
  /** refreshBalances + refreshStats + loadLeaderboard, single-flighted. */
  refresh(): Promise<void>;
  /**
   * Register the four standard actions with their standard bodies:
   * `withdrawWinnings` / `refreshLeaderboard` / `expireGame` / `retryDeal`
   * (retryDeal ≡ resume — the re-open lane for a failed TEE deal).
   *
   * @example
   * ```ts
   * const runner = app.game.reward(config).runner({ createView, applyOp });
   * runner.registerStandardActions(app.actions);
   * ```
   */
  registerStandardActions(actions: RewardRunnerActionsSurface): void;
  /** Release the internal wallet-change subscription. */
  dispose(): void;
}

/** The reward-surface primitives the runner composes (guards included). */
export interface RewardRunnerHandle<Op extends TeeSessionOp> {
  mode(difficulty: number | string): NormalizedRewardGameMode;
  start(difficulty: number): Promise<RewardGameStartResult>;
  openSession(gameId: string, difficulty: number): Promise<RewardGameSession>;
  recordOp(session: RewardGameSession, op: Op): Promise<RewardGameStepResult<Op>>;
  replayOps(
    session: RewardGameSession,
    ops: readonly Op[],
    onStep?: (step: TeeStepResult, op: Op, index: number) => void | Promise<void>,
  ): Promise<TeeStepResult[]>;
  finalize(session: RewardGameSession): Promise<RewardGameFinalizeResult>;
  recoverActive(): Promise<RewardGameRecoverResult>;
  expire(gameId: string): Promise<RewardGameTxResult>;
  withdrawCredit(): Promise<unknown>;
  snapshot(gameId: string): Promise<RewardGameSnapshot>;
  balances(): Promise<RewardGameBalances>;
  storage: RewardGameStorage<Op>;
}

/** Dependencies injected by the framework's `game.reward(...).runner(...)` wiring. */
export interface RewardRunnerDeps<Op extends TeeSessionOp> {
  config: RewardGameConfig;
  handle: RewardRunnerHandle<Op>;
  loadStats(): Promise<unknown>;
  loadLeaderboard(): Promise<FrameworkRewardLeaderboardEntry[]>;
  onAccountChanged(
    handler: (change: { previous: string | null; current: string | null }) => void,
  ): () => void;
}

/** Build a {@link FrameworkRewardRunner} (see `app.game.reward(config).runner(hooks)`). */
export function createRewardRunner<Op extends TeeSessionOp, View>(
  deps: RewardRunnerDeps<Op>,
  hooks: FrameworkRewardRunnerHooks<Op, View>,
): FrameworkRewardRunner<Op, View> {
  const { config, handle } = deps;

  const phase = createObservable<FrameworkRewardPhase>("idle");
  const view = createObservable<View | null>(null);
  const session = createObservable<RewardGameSession | null>(null);
  const balances = createObservable<RewardGameBalances | null>(null);
  const stats = createObservable<unknown | null>(null);
  const leaderboard = createObservable<FrameworkRewardLeaderboardEntry[]>([]);

  let activeGameId: string | null = null;

  const setPhase = (next: FrameworkRewardPhase, detail?: { error?: unknown }): void => {
    phase.set(next);
    try {
      hooks.onPhase?.(next, detail);
    } catch (error) {
      console.error(`[${config.appId}] reward-runner onPhase hook threw:`, error);
    }
  };

  const resolveDifficulty = (options?: FrameworkRewardStartOptions): number => {
    if (options?.difficulty !== undefined) return Math.max(0, Math.trunc(options.difficulty));
    if (options?.modeKey !== undefined) {
      const mode = config.modes.find((entry) => entry.key === options.modeKey);
      if (!mode) {
        throw new RewardGameError(
          "NO_MODE",
          `${config.appId} has no reward-game mode with key "${options.modeKey}"`,
        );
      }
      return mode.id;
    }
    return config.modes[0]?.id ?? 0;
  };

  const refresh = singleFlight(
    () => "refresh",
    async (): Promise<void> => {
      await Promise.all([
        handle.balances().then(
          (value) => balances.set(value),
          () => undefined, // keep the last known balances on read errors
        ),
        deps.loadStats().then(
          (value) => stats.set(value),
          () => undefined,
        ),
        deps.loadLeaderboard().then(
          (rows) => leaderboard.set(rows),
          () => undefined,
        ),
      ]);
    },
    { mode: "join" },
  );

  const start = singleFlight<[options?: FrameworkRewardStartOptions], void>(
    () => "start",
    async (options?: FrameworkRewardStartOptions): Promise<void> => {
      const difficulty = resolveDifficulty(options);
      setPhase("dealing");
      try {
        const started = await handle.start(difficulty);
        const opened = await handle.openSession(started.gameId, difficulty);
        activeGameId = started.gameId;
        balances.set(started.balances);
        session.set(opened);
        view.set(hooks.createView(opened));
        setPhase("deal-pending");
      } catch (error) {
        setPhase("error", { error });
        throw error;
      }
    },
    { mode: "join" },
  );

  const resume = singleFlight(
    () => "resume",
    async (): Promise<boolean> => {
      let recovered: RewardGameRecoverResult;
      try {
        recovered = await handle.recoverActive();
      } catch {
        return false; // no wallet / unreadable state — nothing to resume
      }
      const snapshot = recovered.snapshot;
      if (!snapshot || !recovered.gameId || recovered.gameId === "0") return false;
      if (snapshot.status === "expired") {
        setPhase("expired");
        return false;
      }
      if (snapshot.status !== "dealt" && snapshot.status !== "committed") return false;
      try {
        const opened = await handle.openSession(recovered.gameId, snapshot.difficulty);
        const ops = handle.storage.load(recovered.gameId);
        let replayed = hooks.createView(opened);
        for (const op of ops) replayed = hooks.applyOp(replayed, op);
        if (ops.length > 0) await handle.replayOps(opened, ops);
        activeGameId = recovered.gameId;
        session.set(opened);
        view.set(replayed);
        setPhase(ops.length > 0 ? "playing" : "deal-pending");
        return true;
      } catch (error) {
        setPhase("error", { error });
        throw error;
      }
    },
    { mode: "join" },
  );

  const finalize = singleFlight(
    () => "finalize",
    async (): Promise<void> => {
      const current = session.get();
      if (!current) {
        throw new RewardGameError("NO_SESSION", "No active session — call start() or resume() first");
      }
      setPhase("finalizing");
      try {
        const result = await handle.finalize(current);
        if (result.settlement.status === "unknown") {
          // Broadcast but not yet observable — the SDK retained the op-log.
          setPhase("settlement-pending");
          return;
        }
        if (hooks.verifyView) {
          const snap = await handle.snapshot(current.identity.gameId);
          const currentView = view.get();
          if (currentView !== null && !hooks.verifyView(currentView, snap)) {
            throw new RewardGameError(
              "VIEW_MISMATCH",
              "Local game view does not match the settled on-chain snapshot",
            );
          }
        }
        session.set(null);
        activeGameId = null;
        setPhase(result.settlement.status === "solved" ? "settled" : "expired");
        await refresh();
      } catch (error) {
        setPhase("error", { error });
        throw error;
      }
    },
    { mode: "join" },
  );

  const runner: FrameworkRewardRunner<Op, View> = {
    phase,
    view,
    session,
    balances,
    stats,
    leaderboard,

    start: (options?: FrameworkRewardStartOptions) => start(options) as Promise<void>,

    resume: async () => (await resume()) === true,

    async record(op: Op): Promise<void> {
      const current = session.get();
      if (!current) {
        throw new RewardGameError("NO_SESSION", "No active session — call start() or resume() first");
      }
      const currentView = view.get();
      if (currentView !== null) view.set(hooks.applyOp(currentView, op));
      await handle.recordOp(current, op);
      if (phase.get() === "deal-pending") setPhase("playing");
    },

    finalize: () => finalize() as Promise<void>,

    async withdraw(): Promise<void> {
      await handle.withdrawCredit();
      await refresh();
    },

    async expire(): Promise<void> {
      let gameId = activeGameId;
      if (!gameId || gameId === "0") {
        try {
          gameId = (await handle.recoverActive()).gameId;
        } catch {
          gameId = null;
        }
      }
      if (!gameId || gameId === "0") return;
      await handle.expire(gameId);
      activeGameId = null;
      session.set(null);
      setPhase("expired");
      await refresh();
    },

    refresh: () => refresh() as Promise<void>,

    registerStandardActions(actions: RewardRunnerActionsSurface): void {
      actions.register("withdrawWinnings", () => runner.withdraw());
      actions.register("refreshLeaderboard", () => runner.refresh());
      actions.register("expireGame", () => runner.expire());
      actions.register("retryDeal", () => runner.resume());
    },

    dispose(): void {
      stopAccountWatch();
    },
  };

  // Wallet-change session reset (the color-clash semantics): an identity
  // change invalidates the TEE session; a settlement that was in flight is
  // reported as pending rather than lost.
  const stopAccountWatch = deps.onAccountChanged(({ current }) => {
    const wasSettling = phase.get() === "finalizing" || phase.get() === "settlement-pending";
    session.set(null);
    view.set(null);
    activeGameId = null;
    setPhase(wasSettling ? "settlement-pending" : "idle");
    if (current) void refresh();
  });

  return runner;
}

/**
 * framework/game-facade — app.game (RFC P0-1 §2 step 10, moved verbatim
 * from index.ts).
 *
 * The reward-game SDK facade (`game.reward(config)` incl. the guarded
 * reward-chain adapter and the RFC P0-7 lifecycle runner wiring) plus the
 * player / stats / leaderboard / session helpers and the RFC P1-2
 * `game.rules(config)` factory.
 */

import { createGameRules } from "./game-rules";
import type { FrameworkGuardDeps } from "./internal/guards";
import { localStorageAvailable } from "./utils/safe-storage";
import {
  createLocalStorageRewardGameStorage,
  createPlatformGameRewardChain,
  createRewardRunner,
  expireRewardGame,
  finalizeRewardGame,
  observeRewardGameSettlement,
  openRewardGameSession,
  readRewardGameSnapshot,
  readRewardGameProgression,
  recoverActiveRewardGame,
  recordRewardGameOp,
  refreshRewardGameBalances,
  replayRewardGameOps,
  rewardGameEvents,
  rewardGameModeOf,
  rewardGameProgressionOf,
  platformGameEventsForApp,
  RewardGameError,
  startRewardGame,
  withdrawRewardCredit,
} from "./gamefi";
import type {
  FrameworkRewardRunner,
  FrameworkRewardRunnerHooks,
  RewardGameConfig,
  RewardGameSession,
} from "./gamefi";
import type { FrameworkPlatformGameSurface } from "./platform-game-surface";
import type { TeeSessionOp, TeeStepResult } from "./logic/tee-session";
import {
  toScriptHash,
  buildLeaderboard,
  createGameSessionObservables,
  applyGameSnapshot,
  parsePlayerStats,
} from "./game";
import type {
  LeaderEntry,
  SolveRow,
  GameSessionStatus,
  SolvedEventSlots,
  GameSessionObservables,
} from "./game";
import type {
  FrameworkContractArg,
  FrameworkGameSurface,
  FrameworkInvokeOptions,
  FrameworkRewardGameConfig,
  FrameworkRewardGameFinalizeOptions,
  FrameworkRewardGameOptions,
  FrameworkRewardGameSettlementOptions,
  FrameworkRewardGameSurface,
  MiniAppFrameworkChain,
} from "./types";

export interface GameFacadeDeps {
  /** Default reward-game app id (config.appId falls back to it). */
  appId: string;
  /** Framework storage prefix (`neo:<appId>:`) for the op-log lane. */
  storagePrefix: string;
  /** Raw host chain service (the reward-chain adapter wraps it). */
  chain: MiniAppFrameworkChain;
  /** Guest guard + S11 permission gate (RFC P0-2). */
  guards: FrameworkGuardDeps;
  /** Launch-context network fallback for the adapter's detectNetwork. */
  fallbackNetwork(): string;
  /** `app.wallet.onAccountChanged` (RFC P0-5) — the runner's session reset. */
  onAccountChanged(
    handler: (change: { previous: string | null; current: string | null }) => void,
  ): () => void;
  /** Shared PlatformGame surface used only when an engine hash is configured. */
  platformGame?: () => FrameworkPlatformGameSurface;
  /** Deployed shared engine hash; absent keeps the legacy clone backend. */
  platformGameHash?: string;
}

/**
 * Build the `app.game` surface (see module doc).
 *
 * @example
 * ```ts
 * const game = createGameFacade({ appId, storagePrefix, chain, guards, ... });
 * const reward = game.reward({ scriptHash, difficulties });
 * ```
 */
export function createGameFacade(deps: GameFacadeDeps): FrameworkGameSurface {
  const { appId, storagePrefix, chain, guards } = deps;
  const assertNotGuest = () => guards.assertNotGuest();
  const requireInvokePrimary = () => guards.requirePermission("invoke:primary");
  const requireOracleRequest = () => guards.requirePermission("oracle:request");

  /**
   * Chain adapter for the reward-game SDK (app.game.reward). The broadcast
   * lanes (invoke / invokeWithPayment) wrap the RAW host chain service, so
   * they carry the SAME guards as app.chain.invoke — guest guard first, then
   * the S11 "invoke:primary" manifest gate (ordering matches the round-2
   * idiom) — otherwise the entire app.game.reward surface (start / finalize /
   * expire / withdrawCredit) would broadcast primary-contract invokes with no
   * permission check. `async` so a denial rejects instead of throwing
   * synchronously. Hosts that deliver NO permission declaration default-allow
   * (see app.permissions), so existing games are unchanged; TEE games with
   * pinned empty declarations are guest-only, where this firing is desired
   * defense-in-depth. Read lanes (read / listEvents / address / detectNetwork)
   * stay ungated so guests can still read the reward pool.
   */
  const rewardChain = () => ({
    address: chain.address,
    contractAddress: chain.contractAddress ?? { get: () => "" },
    ensureWallet: () => chain.ensureWallet(),
    detectNetwork: async () => chain.detectNetwork?.() ?? deps.fallbackNetwork(),
    read: (operation: string, args?: FrameworkContractArg[]) => chain.read(operation, args),
    invoke: async (
      operation: string,
      args: FrameworkContractArg[],
      invokeOptions?: FrameworkInvokeOptions,
    ) => {
      assertNotGuest();
      requireInvokePrimary();
      return chain.invoke(operation, args, invokeOptions);
    },
    invokeWithPayment: async (
      paymentAmount: string,
      memo: string,
      operation: string,
      args: FrameworkContractArg[],
      invokeOptions?: FrameworkInvokeOptions,
    ) => {
      assertNotGuest();
      requireInvokePrimary();
      return chain.invokeWithPayment(paymentAmount, memo, operation, args, invokeOptions);
    },
    ...(chain.listEvents
      ? {
          listEvents: (eventName: string, options?: { limit?: number; offset?: number }) =>
            chain.listEvents?.(eventName, options) ?? Promise.resolve([]),
        }
      : {}),
  });

  const game: FrameworkGameSurface = {
    /**
     * Standard game-rules helpers from the game's constants (RFC P1-2) —
     * see {@link createGameRules}. Apps re-export the result from their
     * `logic/game-rules.ts`; per-game constants stay in the app.
     */
    rules: createGameRules,

    reward<Op extends TeeSessionOp = TeeSessionOp>(
      rewardConfig: FrameworkRewardGameConfig,
      rewardOptions: FrameworkRewardGameOptions<Op> = {},
    ) {
      const config: RewardGameConfig = {
        ...rewardConfig,
        appId: rewardConfig.appId ?? appId,
      };
      const storage = rewardOptions.storage ?? createLocalStorageRewardGameStorage<Op>(
        rewardOptions.storagePrefix ?? `${storagePrefix}gamefi/${config.appId}/ops/`,
        localStorageAvailable(),
      );
      const legacyChain = rewardChain();
      const platformGame = deps.platformGameHash ? deps.platformGame?.() : undefined;
      if (deps.platformGameHash && !platformGame?.available) {
        throw new RewardGameError(
          "BAD_PLATFORM_GAME_CONFIG",
          "The configured shared PlatformGame backend is unavailable",
        );
      }
      const chainAdapter = platformGame?.available
        ? createPlatformGameRewardChain({
            appId: config.appId,
            engineHash: deps.platformGameHash!,
            config,
            chain: legacyChain,
            platformGame,
          })
        : legacyChain;
      const rewardSurface: FrameworkRewardGameSurface<Op> = {
        config,
        storage,
        mode(difficulty: number | string) {
          return rewardGameModeOf(config, difficulty);
        },
        balances(playerHash?: string) {
          return refreshRewardGameBalances(config, chainAdapter, playerHash);
        },
        progression(difficulty: number | string, playerHash?: string) {
          const hash = playerHash ?? toScriptHash(chain.address.get());
          if (!hash) return Promise.resolve(rewardGameProgressionOf(config, [], difficulty));
          return readRewardGameProgression(config, chainAdapter, hash, difficulty);
        },
        start(difficulty: number) {
          assertNotGuest();
          // S11 pre-gate (same "invoke:primary" as the adapter's invoke
          // lanes): deny BEFORE the SDK's ensureWallet fires a wallet
          // prompt; the adapter gate backstops the broadcast itself.
          requireInvokePrimary();
          return startRewardGame(config, chainAdapter, difficulty, storage);
        },
        openSession(gameId: string, difficulty: number) {
          assertNotGuest();
          // S11 gate on the TEE fetcher lanes (openSession / recordOp /
          // replayOps): these are DIRECT enclave round-trips to the Morpheus
          // oracle session host (/api/morpheus/session/*) that bypass
          // app.oracle — without this gate only the guest guard covered
          // them. TEE sessions are oracle traffic, so they carry the SAME
          // "oracle:request" permission as the app.oracle request/dispatch
          // lanes (no new manifest vocabulary; a re-enabled gamefi TEE game
          // grants it alongside "invoke:primary"). Denial fires BEFORE the
          // identity build and the enclave request — zero TEE traffic — and
          // throws synchronously like the sibling reward guards (the P0-2
          // documented sync-throw exemption). Standard ordering: guest
          // guard, then permission, then the call.
          requireOracleRequest();
          return openRewardGameSession(config, chainAdapter, gameId, difficulty, rewardOptions.fetcher);
        },
        recordOp(session: RewardGameSession, op: Op) {
          assertNotGuest();
          // S11 "oracle:request" gate — TEE step lane; see openSession.
          requireOracleRequest();
          return recordRewardGameOp(session, storage, op, rewardOptions.fetcher);
        },
        replayOps(
          session: RewardGameSession,
          ops: readonly Op[],
          onStep?: (step: TeeStepResult, op: Op, index: number) => void | Promise<void>,
        ) {
          // Replays drive the same TEE step lane as recordOp — a guest has
          // no session to replay and must never reach the oracle host.
          assertNotGuest();
          // S11 "oracle:request" gate — TEE step lane; see openSession.
          requireOracleRequest();
          return replayRewardGameOps(session, ops, onStep, rewardOptions.fetcher);
        },
        finalize(
          session: RewardGameSession,
          finalizeOptions?: FrameworkRewardGameFinalizeOptions,
        ) {
          assertNotGuest();
          // S11 pre-gate: deny before the TEE seal round-trip — the sealed
          // op-log is useless when the finalize broadcast would be denied.
          // Deliberately NOT "oracle:request": finalize's only fetcher use
          // is the oracle public-key READ (the same endpoint the ungated
          // app.oracle.seal.publicKey client hits) + local encryption — it
          // opens no TEE session; the broadcast is the gated side effect.
          requireInvokePrimary();
          return finalizeRewardGame(config, chainAdapter, session, storage, {
            ...finalizeOptions,
            fetcher: finalizeOptions?.fetcher ?? rewardOptions.fetcher,
          });
        },
        recoverActive() {
          return recoverActiveRewardGame(config, chainAdapter);
        },
        expire(gameId: string) {
          assertNotGuest();
          // S11 pre-gate — see start(); expire broadcasts expireGame.
          requireInvokePrimary();
          return expireRewardGame(config, chainAdapter, gameId, storage);
        },
        withdrawCredit(creditFixed8?: bigint | number | string) {
          assertNotGuest();
          // S11 pre-gate: deny BEFORE the SDK's ensureWallet wallet prompt.
          requireInvokePrimary();
          return withdrawRewardCredit(config, chainAdapter, creditFixed8);
        },
        snapshot(gameId: string) {
          return readRewardGameSnapshot(config, chainAdapter, gameId);
        },
        observeSettlement(
          gameId: string,
          solvedEvent?: unknown | null,
          settlementOptions?: FrameworkRewardGameSettlementOptions,
        ) {
          return observeRewardGameSettlement(config, chainAdapter, gameId, solvedEvent, settlementOptions);
        },
        /**
         * Reward-game lifecycle runner (RFC P0-7): composes the primitives
         * above into the standard start/resume/record/finalize/refresh
         * state machine, with the wallet-change session reset wired in via
         * app.wallet.onAccountChanged. See {@link FrameworkRewardRunner}.
         */
        runner<View>(
          hooks: FrameworkRewardRunnerHooks<Op, View>,
        ): FrameworkRewardRunner<Op, View> {
          return createRewardRunner<Op, View>(
            {
              config,
              handle: {
                mode: (difficulty) => rewardSurface.mode(difficulty),
                start: (difficulty) => rewardSurface.start(difficulty),
                openSession: (gameId, difficulty) => rewardSurface.openSession(gameId, difficulty),
                recordOp: (session, op) => rewardSurface.recordOp(session, op),
                replayOps: (session, ops) => rewardSurface.replayOps(session, ops),
                finalize: (session) => rewardSurface.finalize(session),
                recoverActive: () => rewardSurface.recoverActive(),
                expire: (gameId) => rewardSurface.expire(gameId),
                withdrawCredit: () => rewardSurface.withdrawCredit(),
                snapshot: (gameId) => rewardSurface.snapshot(gameId),
                balances: () => rewardSurface.balances(),
                storage,
              },
              loadStats: async () => {
                if (!platformGame?.available) return game.stats.load();
                const stats = await platformGame.statsOf();
                return {
                  solves: stats.solved,
                  totalWon: Number(stats.totalWonFixed8) / 100_000_000,
                };
              },
              loadLeaderboard: async () => {
                const events = await chainAdapter.listEvents?.(
                  rewardGameEvents(config).solved,
                  { limit: 200 },
                ) ?? [];
                const { ranked } = buildLeaderboard(
                  events,
                  toScriptHash(chain.address.get()),
                  platformGame?.available
                    ? { solvedPayout: 5, totalWon: 6, undos: 7 }
                    : {},
                );
                return ranked.map((entry) => ({
                  user: entry.address,
                  score: String(entry.totalWon),
                }));
              },
              onAccountChanged: (handler) => deps.onAccountChanged(handler),
            },
            hooks,
          );
        },
      };
      return rewardSurface;
    },

    // ── player helpers ────────────────────────────────────────────────────
    /**
     * High-level helpers for the connected player.
     * Used by game main.tsx files instead of re-implementing the
     * addressToScriptHash + address.get() pattern inline.
     */
    player: {
      /**
       * Return the script-hash of the currently connected wallet.
       * Returns "" when no wallet is connected (safe to pass to balances/stats
       * calls which guard on empty hash).
       */
      scriptHash(): string {
        return toScriptHash(chain.address.get());
      },
      /**
       * Wait for wallet connection and return the script-hash.
       * Throws if the wallet prompt is cancelled.
       */
      async ensureScriptHash(): Promise<string> {
        const address = await chain.ensureWallet();
        return toScriptHash(address);
      },
    },

    // ── stats helpers ─────────────────────────────────────────────────────
    /**
     * High-level player stats helpers.
     * Replaces the `refreshStats()` pattern that every game re-implements.
     */
    stats: {
      /**
       * Fetch statsOf(playerHash) from the contract and return
       * `{ solves, totalWon }`.  Returns zeros on any error.
       */
      async load(playerHash?: string): Promise<{ solves: number; totalWon: number }> {
        const hash = playerHash ?? toScriptHash(chain.address.get());
        if (!hash) return { solves: 0, totalWon: 0 };
        try {
          const platformGame = deps.platformGameHash ? deps.platformGame?.() : undefined;
          if (platformGame?.available) {
            const stats = await platformGame.statsOf(hash);
            return {
              solves: stats.solved,
              totalWon: Number(stats.totalWonFixed8) / 100_000_000,
            };
          }
          const raw = await chain.read("statsOf", [{ type: "Hash160", value: hash }]);
          return parsePlayerStats(raw);
        } catch {
          return { solves: 0, totalWon: 0 };
        }
      },
    },

    // ── leaderboard helpers ───────────────────────────────────────────────
    /**
     * High-level leaderboard helpers built on the unified buildLeaderboard()
     * utility.  Replaces the `loadLeaderboard()` function that every game
     * re-implements with slight variations.
     */
    leaderboard: {
      /**
       * Fetch `limit` solved events from the chain, build a ranked leaderboard,
       * and extract the connected player's own history rows.
       *
       * @param eventName  On-chain event name (usually "Solved").
       * @param slots      Optional override of event-state slot indices.
       * @param limit      Number of events to scan (default 200).
       */
      async load<TRow extends SolveRow = SolveRow>(
        eventName = "Solved",
        slots?: SolvedEventSlots,
        limit = 200,
        extraRowFields?: (ev: unknown) => Partial<TRow>,
      ): Promise<{ ranked: LeaderEntry[]; mine: TRow[] }> {
        const playerHash = toScriptHash(chain.address.get());
        try {
          let events = await chain.listEvents?.(eventName, { limit }) ?? [];
          const platformGame = deps.platformGameHash ? deps.platformGame?.() : undefined;
          if (platformGame?.available) {
            events = platformGameEventsForApp(events, appId);
          }
          return buildLeaderboard<TRow>(events, playerHash, slots, extraRowFields);
        } catch {
          return { ranked: [], mine: [] };
        }
      },
    },

    // ── session observables factory ────────────────────────────────────────
    /**
     * Session observable factory — creates the standard set of observables
     * every reward game needs without boilerplate.
     */
    session: {
      /**
       * Create and return all standard game session observables.
       * Pass the result directly as the `state` return value in setup().
       *
       * @example
       * ```ts
       * const obs = app.game.session.observables(ctx.t);
       * // ... register actions using obs.gameStatus, obs.credit, etc.
       * return { state: obs };
       * ```
       */
      observables<THistory extends SolveRow = SolveRow>(
        t?: (key: string) => string,
      ): GameSessionObservables<THistory> {
        return createGameSessionObservables<THistory>({ t });
      },

      /**
       * Apply a getGame() on-chain snapshot to a set of session observables.
       * Centralises the "read game + set status/difficulty/commitment/dealtAt/
       * deadline/undos" pattern.
       */
      applySnapshot(
        obs: Parameters<typeof applyGameSnapshot>[0],
        game: unknown,
        statusOf: (raw: number) => GameSessionStatus,
      ): void {
        applyGameSnapshot(obs, game, statusOf);
      },
    },
  };

  return game;
}

import { createObservable, type Observable } from "./reactive";
import { createAmountSurface } from "./amounts-surface";
import { createChainSurface } from "./chain-surface";
import { createErrorsSurface } from "./errors-surface";
import { createFundsSurface } from "./funds";
import { createGameFacade } from "./game-facade";
import { AA_WRITE, guardedWrite } from "./internal/guards";
import { createOracleSurface } from "./oracle-surface";
import { createModeModule } from "./mode";
import { createActionsSurface, createOperationsSurface } from "./actions-surface";
import { createStateSurface } from "./app-state";
import { createStatsSurface } from "./stats-surface";
import { createNotifyModule } from "./notify-surface";
import { createPlatformSurface } from "./platform-surface";
import { createStorageSurface } from "./storage-surface";
import type {
  FrameworkAppMode,
  FrameworkAssetSymbol,
  FrameworkContractArg,
  FrameworkGuestLeaderboard,
  FrameworkInvokeOptions,
  FrameworkModeSurface,
  FrameworkNotifyPolicy,
  MiniAppFramework,
  MiniAppFrameworkContext,
  MiniAppFrameworkOptions,
} from "./types";
import { createAaSurface } from "./aa";
import type { FrameworkAaService } from "./aa";
import { createClipboardSurface, createShareSurface } from "./clipboard";
import { createCreditsSurface } from "./credits";
import type { FrameworkCreditsConfig } from "./credits";
import { createRegistrySurface } from "./registry-surface";
import { createPlatformGameSurface } from "./platform-game-surface";
import { createChainPendingSurface } from "./chain-pending";
import { createBusSurface, createEventsSurface } from "./events";
import type { FrameworkBusChannel } from "./events";
import { createLifecycleSurface } from "./lifecycle";
import type { LifecycleSurfaceService } from "./lifecycle";
import { createOracleExtensions } from "./oracle-ext";
import { createPermissionsSurface } from "./permissions";
import type { FrameworkPermissionsInput } from "./permissions";
import { createResourcesSurface } from "./resources";
import type { FrameworkTokenArtUrls } from "./resources";
import { createWalletSurface } from "./wallet";
import type { WalletSurfaceBalanceService } from "./wallet";

// ───────────────────────────────────────────────────────────────────────────
// App-facing types + the explicit MiniAppFramework interface live in ./types
// (RFC P0-1) and are re-exported here so every existing import path keeps
// resolving — zero import breaks fleet-wide.
// ───────────────────────────────────────────────────────────────────────────
export * from "./types";

export function createMiniAppFramework(
  ctx: MiniAppFrameworkContext,
  options: MiniAppFrameworkOptions = {},
): MiniAppFramework {
  const appId =
    options.appId ||
    ctx.launchContext?.appId ||
    "miniapp";
  const os = ctx.os ?? ctx.services.os ?? {};
  const chain = ctx.services.chain;
  // Stable contract-address observable so subscribers keep a single source even
  // when the host has no deployed contract accessor.
  const contractAddressAccessor: Observable<string | null> =
    chain.contractAddress ?? createObservable<string | null>(null);
  const notify = ctx.services.notify ?? {};
  const storagePrefix = options.storagePrefix ?? `neo:${appId}:`;

  // app.storage — extracted module (RFC P0-1 §2 step 5). `local` is also
  // consumed by state.persisted.
  const storageSurface = createStorageSurface({
    prefix: storagePrefix,
    osStorage: () => os.storage,
  });
  const { local } = storageSurface;

  // app.state — extracted module (RFC P0-1 residual split): atoms
  // registered on the ctx state record.
  const stateSurface = createStateSurface({ local, stateHost: ctx });

  // app.notify + the S1/S2 toast wrappers — extracted module (RFC P0-1 §2
  // step 3). setStatus/t thread as live accessors so late ctx mutation keeps
  // working exactly as before.
  const { appNotify, toastSuccess, runWithNotify } = createNotifyModule({
    notify,
    t: (key, params) => ctx.t(key, params),
    setStatus: (message, type) => ctx.setStatus?.(message, type),
  });

  // ── Wave-1 standalone modules (S4/S5/S8/S9/S10/S11/S12/S13) ──────────────
  // Style contract (plan §2): each surface is a lazy module — constructed on
  // first access and cached — so hosts that never touch one pay nothing, and
  // graceful degradation for absent injected services lives inside the module
  // factories themselves.
  const lazyModule = <T>(factory: () => T): (() => T) => {
    let instance: T | undefined;
    return () => (instance ??= factory());
  };

  /**
   * app.permissions (S11) — manifest permission gating sourced from the
   * launch context. Central enforcement: EVERY primary-contract invoke lane —
   * `app.chain.invoke` / `write` / `invokeWithPayment` / `invokeMultiple`,
   * the mutating `app.funds.*` lanes (payAndCall / prepayAndCall / receiptPay /
   * withdrawCredit), which are payment-carrying invokes of the same primary
   * contract, and the `app.game.reward` broadcast lanes (start / finalize /
   * expire / withdrawCredit through the reward-chain adapter) — requires
   * "invoke:primary", and the oracle request/dispatch lane PLUS the
   * `app.game.reward` TEE session lanes (openSession / recordOp / replayOps —
   * direct enclave round-trips on the oracle session host) require
   * "oracle:request", so gating happens once here rather than per app. Read
   * lanes (chain.read/readRaw/readArray/events, funds.creditOf) stay ungated.
   *
   * Default-allow semantics: when the host delivers NO manifest permission
   * declaration (`ctx.launchContext.permissions` undefined/null — every
   * current launch lane, and every existing test that builds the framework
   * from bare mock services), `require()` is a no-op so ungated hosts keep
   * working. A PRESENT declaration — even an empty one — is enforced
   * verbatim: missing grants throw {@link FrameworkPermissionError}.
   */
  const getPermissions = lazyModule(() =>
    createPermissionsSurface({
      permissions: () => ctx.launchContext?.permissions,
      t: (key: string) => ctx.t(key),
      // "aa" is a DEFAULT-ALLOW permission (RFC P0-2): the app.aa write lanes
      // carried no S11 gate historically, so the gate must not break apps
      // whose pinned declarations predate it. A manifest can still opt out
      // explicitly with `{ aa: false }`.
      defaultAllow: ["aa"],
    }),
  );
  const getEvents = lazyModule(() => createEventsSurface({ chain, appId }));
  const getLifecycle = lazyModule(() =>
    createLifecycleSurface({ lifecycle: ctx.services.lifecycle }),
  );
  const getBus = lazyModule(() =>
    createBusSurface({
      bus: ctx.services.events,
      // app.lifecycle is the unmount authority for bus subscriptions (and
      // pollers) in both the service-backed and standalone lanes.
      lifecycle: { onUnmount: (fn) => getLifecycle().onUnmount(fn) },
    }),
  );
  const getWallet = lazyModule(() => {
    const wallet = createWalletSurface({
      chain,
      balance: ctx.services.balance,
      events: ctx.services.events,
    });
    return {
      ...wallet,
      // observeBalance handles hold live event subscriptions — register the
      // cleanup with app.lifecycle so unmount releases them automatically.
      observeBalance(asset: string) {
        const handle = wallet.observeBalance(asset);
        getLifecycle().cleanup(() => handle.cleanup());
        return handle;
      },
    };
  });
  // app.notify is the toast lane for clipboard/share so copy feedback gets
  // the same chain-error mapping + setStatus fallback as every other surface.
  const getClipboard = lazyModule(() =>
    createClipboardSurface({ notify: appNotify, address: () => chain.address.get() }),
  );
  const getShare = lazyModule(() =>
    createShareSurface({
      notify: appNotify,
      address: () => chain.address.get(),
      clipboard: getClipboard(),
    }),
  );
  const getAa = lazyModule(() => {
    const aa = createAaSurface({ aa: ctx.services.aa });
    // Guest guard (defense in depth, same contract as chain.invoke/write):
    // relay submission broadcasts a transaction, sponsorship.request moves
    // sponsor GAS, and sessionKey.create provisions an on-chain-scoped key —
    // all three are write lanes and must throw in guest mode. Reads
    // (`available`, sponsorship.check) stay allowed. The write lanes carry
    // the DEFAULT-ALLOW "aa" S11 permission (see AA_WRITE) so manifests can
    // opt out with `{ aa: false }` without any default behavior change.
    const guarded: typeof aa = {
      get available() {
        return aa.available;
      },
      sponsorship: {
        check: (scope) => aa.sponsorship.check(scope),
        request: guardedWrite(
          guardDeps,
          AA_WRITE,
          (...args: Parameters<typeof aa.sponsorship.request>) => aa.sponsorship.request(...args),
        ),
      },
      relay: guardedWrite(guardDeps, AA_WRITE, (...args: Parameters<typeof aa.relay>) =>
        aa.relay(...args),
      ),
      sessionKey: {
        create: guardedWrite(
          guardDeps,
          AA_WRITE,
          (...args: Parameters<typeof aa.sessionKey.create>) => aa.sessionKey.create(...args),
        ),
      },
    };
    return guarded;
  });
  const getResources = lazyModule(() =>
    createResourcesSurface({
      host: () => framework.platform.host,
      baseUrl: options.resources?.baseUrl,
      tokenArt: options.resources?.tokenArt,
    }),
  );
  const getOracleExt = lazyModule(() =>
    createOracleExtensions({
      appId,
      dataFeed: options.oracle?.dataFeed,
      seal: options.oracle?.seal,
    }),
  );
  /**
   * app.credits (Credits v2) — the one uniform platform-credit surface. Buys
   * are on-chain GAS transfers to the MiniAppCredits contract (guest-guarded
   * + S11 "payments" gate); spends are instant feeless DB debits against the
   * credits-ledger endpoint (guest-guarded, NO payments gate — off-chain);
   * balance reads prefer the ledger and fall back to the settled on-chain
   * checkpoint flagged `stale`. Config comes from `options.credits`
   * (platform config pattern); absent ⇒ typed FrameworkCapabilityError.
   */
  const getCredits = lazyModule(() =>
    createCreditsSurface({
      appId,
      chain: {
        address: chain.address,
        ensureWallet: () => chain.ensureWallet(),
        detectNetwork: async () =>
          (await chain.detectNetwork?.()) ?? String(ctx.launchContext?.network ?? "testnet"),
        read: (operation, args, readOptions) =>
          chain.read(operation, args as FrameworkContractArg[] | undefined, readOptions),
        invoke: (operation, args, invokeOptions) =>
          chain.invoke(operation, args as FrameworkContractArg[], invokeOptions),
        ...(chain.waitForEvent
          ? {
              waitForEvent: (txid: string, eventName: string, timeoutMs?: number) =>
                chain.waitForEvent!(txid, eventName, timeoutMs),
            }
          : {}),
      },
      assertNotGuest: () => assertNotGuest(),
      requireBuyPermission: () => getPermissions().require("payments"),
      config: options.credits,
    }),
  );
  /**
   * app.registry (Platform Contract Library v2 phase 2) — typed reads of the
   * PlatformRegistry directory (getApp / appAccountOf / appIdOfAccount /
   * engineOf / pause state) plus the advisory AppAccount hash derivation.
   * Reads only; config comes from `options.registry` (platform config
   * pattern); absent ⇒ typed FrameworkCapabilityError. Ungated like every
   * other read lane — no guest guard, no S11 permission.
   */
  const getRegistry = lazyModule(() =>
    createRegistrySurface({
      appId,
      chain: {
        read: (operation, args, readOptions) =>
          chain.read(operation, args as FrameworkContractArg[] | undefined, readOptions),
      },
      config: options.registry,
    }),
  );
  /**
   * app.platformGame (Platform Contract Library v2 phase 2) — the shared
   * PlatformGame RewardGame engine lane. The surface auto-threads the host
   * appId into every call and auto-targets `options.platformGame.gameHash`
   * (platform config pattern); writes run the RFC P0-2 guarded-write stanza
   * (guest guard + S11 "invoke:primary" — the same named policy as
   * app.chain.invoke), reads stay ungated. Absent config ⇒ typed
   * FrameworkCapabilityError.
   */
  const getPlatformGame = lazyModule(() =>
    createPlatformGameSurface({
      appId,
      chain: {
        address: chain.address,
        ensureWallet: () => chain.ensureWallet(),
        read: (operation, args, readOptions) =>
          chain.read(operation, args as FrameworkContractArg[] | undefined, readOptions),
        invoke: (operation, args, invokeOptions) =>
          chain.invoke(operation, args as FrameworkContractArg[], invokeOptions),
      },
      guards: guardDeps,
      config: options.platformGame,
    }),
  );

  // app.amount — extracted module (RFC P0-1 §2 step 9).
  const amount = createAmountSurface();

  // ── app.mode: two-mode game surface + guest guard ──────────────────────────
  // Extracted module (RFC P0-1 §2 step 4): GUEST mode disables every
  // on-chain/oracle/reward WRITE lane (defense in depth); read-only lanes
  // stay allowed so a guest can still read the reward pool for an upsell.
  const { mode: modeSurface, assertNotGuest, isGuestBoardRow } = createModeModule({
    appId,
    leaderboard: () => os.leaderboard,
  });
  // The two guard dependencies every write lane threads (RFC P0-2). NOTE:
  // this is declared before the framework literal because guardedWrite(...)
  // is invoked eagerly while the literal is constructed.
  const guardDeps = {
    assertNotGuest: () => assertNotGuest(),
    requirePermission: (name: string) => getPermissions().require(name),
  };

  /**
   * RFC P1-4 chain.pending + chain.readTxOutcome — lazy: binds the storage
   * lane + lifecycle cleanup hook only on first use. `rpcUrl` is injected by
   * the integration layer (options.rpcUrl); absent ⇒ readTxOutcome resolves
   * "pending" for every tx (track/restore unaffected).
   */
  const getChainPending = lazyModule(() =>
    createChainPendingSurface({
      storage: storageSurface.local,
      rpcUrl: (network) => options.rpcUrl?.(network) ?? "",
      network: async () =>
        (await chain.detectNetwork?.()) ?? String(ctx.launchContext?.network ?? "testnet"),
      registerCleanup: (fn) => getLifecycle().cleanup(fn),
    }),
  );

  // app.chain — extracted module (RFC P0-1 §2 step 6): args/reads/writes/
  // events/signing, write lanes guarded per RFC P0-2.
  const chainSurface = createChainSurface({
    chain,
    contractAddress: contractAddressAccessor,
    guards: guardDeps,
    runWithNotify,
    fallbackNetwork: () => String(ctx.launchContext?.network ?? "testnet"),
    pending: getChainPending,
  });

  // app.funds — extracted module (RFC P0-1 §2 step 7): payment-carrying
  // invoke lanes; withdrawCredit delegates to the app.chain.write lane.
  const fundsSurface = createFundsSurface({
    chain,
    contractAddress: contractAddressAccessor,
    guards: guardDeps,
    runWithNotify,
    write: (spec) => chainSurface.write(spec),
  });

  // app.platform — extracted module (RFC P0-1 residual split): host detection,
  // launch params, network info + Dora explorer links.
  const platformSurface = createPlatformSurface({
    appId,
    launchContext: () => ctx.launchContext,
  });

  // app.actions + app.operations — extracted module (RFC P0-1 residual
  // split): drop-mode single-flight action runner + keyed operation cells.
  const actionsSurface = createActionsSurface({
    isGuest: () => modeSurface.isGuest(),
    notify: appNotify,
    runWithNotify,
    ensureWallet: () => chain.ensureWallet(),
    registerAction: (key, handler) => ctx.registerAction?.(key, handler),
  });
  const operationsSurface = createOperationsSurface({ toastSuccess, notify });

  // app.stats — extracted module (RFC P0-1 residual split): OS-board
  // leaderboard glue (guest-namespaced).
  const statsSurface = createStatsSurface({
    leaderboard: () => os.leaderboard,
    mode: modeSurface,
    isGuestBoardRow,
  });

  const framework: MiniAppFramework = {
    amount,

    /** app.mode — two-mode (guest|gamefi) surface + guest guard + leaderboard. */
    mode: modeSurface,

    notify: appNotify,

    /**
     * app.errors (RFC P0-4) — one-liner error→message extraction routed
     * through the same chain-error mapping app.notify.error uses, so the
     * setStatus and toast lanes show identical copy.
     */
    errors: createErrorsSurface({ t: ctx.t }),

    /** app.platform — extracted module (RFC P0-1 residual split). */
    platform: platformSurface,

    /** app.state — extracted module (RFC P0-1 residual split). */
    state: stateSurface,

    storage: storageSurface,

    /** app.actions — extracted module (RFC P0-1 residual split). */
    actions: actionsSurface,

    /** app.chain — extracted module (RFC P0-1 §2 step 6). */
    chain: chainSurface,

    /** app.operations — extracted module (RFC P0-1 residual split). */
    operations: operationsSurface,

    /** app.funds — extracted module (RFC P0-1 §2 step 7). */
    funds: fundsSurface,

    // ── Wave-1 module surfaces (lazy; see the factories above) ──────────────
    /** app.events (S4) — chain event queries + canonical slot decode. */
    get events() {
      return getEvents();
    },
    /** app.bus (S4) — pub/sub with lifecycle-scoped auto-unsubscribe. */
    get bus() {
      return getBus();
    },
    /** app.wallet (S5) — identity, balances, address/balance observables. */
    get wallet() {
      return getWallet();
    },
    /** app.lifecycle (S8) — mount/unmount, data loaders, visibility-aware poll. */
    get lifecycle() {
      return getLifecycle();
    },
    /** app.clipboard (S9) — copy with toast feedback via app.notify. */
    get clipboard() {
      return getClipboard();
    },
    /** app.share (S9) — native share sheet with clipboard fallback. */
    get share() {
      return getShare();
    },
    /** app.permissions (S11) — manifest gating; default-allow when undeclared. */
    get permissions() {
      return getPermissions();
    },
    /** app.resources (S12) — host-base asset resolution + token artwork. */
    get resources() {
      return getResources();
    },
    /** app.aa (S10) — sponsorship/relay/session keys; typed capability errors. */
    get aa() {
      return getAa();
    },
    /**
     * app.credits (Credits v2) — platform credits: on-chain GAS buys,
     * instant DB-first spends, stale-flagged chain-checkpoint fallback reads.
     */
    get credits() {
      return getCredits();
    },
    /**
     * app.registry (Platform v2 phase 2) — typed PlatformRegistry directory
     * reads + advisory AppAccount hash derivation. Reads only.
     */
    get registry() {
      return getRegistry();
    },
    /**
     * app.platformGame (Platform v2 phase 2) — shared PlatformGame engine
     * lane (appId auto-threaded; guarded writes, ungated typed reads).
     */
    get platformGame() {
      return getPlatformGame();
    },

    /** app.oracle — extracted module (RFC P0-1 §2 step 8). */
    oracle: createOracleSurface({
      appId,
      guards: guardDeps,
      oracleExt: () => getOracleExt(),
      write: (spec) => chainSurface.write(spec),
    }),

    /** app.stats — extracted module (RFC P0-1 residual split). */
    stats: statsSurface,

    /** app.game — extracted module (RFC P0-1 §2 step 10). */
    game: createGameFacade({
      appId,
      storagePrefix,
      chain,
      guards: guardDeps,
      fallbackNetwork: () => String(ctx.launchContext?.network ?? "testnet"),
      onAccountChanged: (handler) => framework.wallet.onAccountChanged(handler),
    }),
  };

  return framework;
}

// NOTE: `MiniAppFramework` is now the EXPLICIT interface in ./types (RFC
// P0-1), re-exported above via `export * from "./types"` — same name, same
// shape, now with per-member JSDoc.

// ───────────────────────────────────────────────────────────────────────────
// Wave-1 standalone module surface (plan §2) — factories, types and
// identity-stable error classes re-exported from the framework entry so apps
// (and the apps/shared compatibility shims) resolve a single copy of each.
// ───────────────────────────────────────────────────────────────────────────

// RFC P1-2 game.rules factory
export { createGameRules, DEFAULT_SETTLEMENT_GRACE_MS } from "./game-rules";

// RFC P0-1 extracted surface factories (index.ts decomposition)
export { createModeModule } from "./mode";
export type { ModeModule, ModeModuleDeps } from "./mode";
export { createNotifyModule } from "./notify-surface";
export type { NotifyModule, NotifySurfaceDeps, RunWithNotifyOptions } from "./notify-surface";
export { createStorageSurface } from "./storage-surface";
export type { StorageSurfaceDeps } from "./storage-surface";
export { createAmountSurface, gasFixed8Amount, neoWholeAmount } from "./amounts-surface";
export {
  accountToHash160,
  compactInvokeOptions,
  createChainSurface,
  frameworkArg,
} from "./chain-surface";
export type { ChainSurfaceDeps } from "./chain-surface";
export { createFundsSurface, FrameworkPrepaidActionError, revertKeyOf } from "./funds";
export type { FundsSurfaceDeps } from "./funds";
export { createOracleSurface } from "./oracle-surface";
export type { OracleSurfaceDeps } from "./oracle-surface";
export { createGameFacade } from "./game-facade";
export type { GameFacadeDeps } from "./game-facade";

// RFC P0-1 residual split — the small inline members extracted from index.ts
export { createPlatformSurface } from "./platform-surface";
export type { PlatformSurfaceDeps } from "./platform-surface";
export { createStateSurface } from "./app-state";
export type { StateSurfaceDeps } from "./app-state";
export { createActionsSurface, createOperationsSurface } from "./actions-surface";
export type { ActionsSurfaceDeps, OperationsSurfaceDeps } from "./actions-surface";
export { createStatsSurface } from "./stats-surface";
export type { StatsSurfaceDeps } from "./stats-surface";

// The fleet-standard mm:ss clock. The `app.fmt` accessor this module used to
// carry (RFC P0-3) was removed as unreachable — see fmt-surface's module doc.
export { formatClock } from "./fmt-surface";

// RFC P0-4 app.errors (+ the translator-free one-liner from utils/errors)
export { createErrorsSurface } from "./errors-surface";
export type { ErrorsSurfaceDeps, FrameworkErrorsSurface } from "./errors-surface";
export { errorMessage } from "./utils/errors";

// RFC P0-6 chain.query
export { createQueryResult } from "./chain-query";
export type { FrameworkQueryResult, FrameworkReadOptions } from "./chain-query";

// RFC P0-2 singleFlight (guardedWrite stays framework-internal by design)
export { singleFlight } from "./utils/async-utils";
export type { SingleFlightDropOptions, SingleFlightJoinOptions } from "./utils/async-utils";

// RFC P0-7 reward-game lifecycle runner
export { createRewardRunner } from "./gamefi";
export type {
  FrameworkRewardLeaderboardEntry,
  FrameworkRewardPhase,
  FrameworkRewardRunner,
  FrameworkRewardRunnerHooks,
  FrameworkRewardStartOptions,
  RewardRunnerActionsSurface,
} from "./gamefi";

// S4 app.events + app.bus
export { createBusSurface, createEventsSurface } from "./events";
export type {
  FrameworkBusChannel,
  FrameworkBusDeps,
  FrameworkBusHandler,
  FrameworkBusLifecycle,
  FrameworkBusSurface,
  FrameworkEventsChain,
  FrameworkEventsDeps,
  FrameworkEventsSurface,
} from "./events";

// S5 app.wallet (+ RFC P0-5 onAccountChanged)
export { createWalletSurface } from "./wallet";
export type {
  FrameworkAccountChange,
  FrameworkWalletBalanceHandle,
  FrameworkWalletSurface,
  WalletContractArg,
  WalletSurfaceBalanceService,
  WalletSurfaceChain,
  WalletSurfaceDeps,
  WalletSurfaceEvents,
} from "./wallet";

// S8 app.lifecycle
export { createLifecycleSurface } from "./lifecycle";
export type {
  FrameworkLifecycleSurface,
  FrameworkPollOptions,
  LifecycleSurfaceDeps,
  LifecycleSurfaceService,
} from "./lifecycle";

// S9 app.clipboard + app.share
export { createClipboardSurface, createShareSurface } from "./clipboard";
export type {
  ClipboardSurfaceDeps,
  FrameworkClipboardCopyOptions,
  FrameworkClipboardSurface,
  FrameworkNotifyLike,
  FrameworkShareOutcome,
  FrameworkShareSurface,
  FrameworkShareUrlOptions,
  ShareSurfaceDeps,
} from "./clipboard";

// S11 app.permissions
export { createPermissionsSurface, FrameworkPermissionError } from "./permissions";
export type {
  FrameworkPermissionsInput,
  FrameworkPermissionsSurface,
  PermissionsSurfaceDeps,
} from "./permissions";

// S12 app.resources
export { createResourcesSurface } from "./resources";
export type {
  FrameworkResourcesSurface,
  FrameworkTokenArtUrls,
  ResourcesSurfaceDeps,
} from "./resources";

// S10 app.aa
export { createAaSurface, FrameworkCapabilityError } from "./aa";
export type {
  FrameworkAaRelayPayload,
  FrameworkAaRelayResult,
  FrameworkAaService,
  FrameworkAaSponsorScope,
  FrameworkAaSponsorshipResult,
  FrameworkAaSponsorshipStatus,
  FrameworkAaSurface,
  FrameworkAaSurfaceDeps,
} from "./aa";

// Credits v2 app.credits
export {
  createCreditsSurface,
  creditsForGas,
  gasForCredits,
  FrameworkCreditsError,
  FrameworkInsufficientCreditsError,
  CREDITS_PER_GAS,
  GAS_BASE_UNITS_PER_CREDIT,
  CREDITS_BUY_MEMO,
  GAS_TOKEN_HASH,
} from "./credits";
export type {
  CreditsSurfaceChain,
  CreditsSurfaceDeps,
  FrameworkCreditsBalance,
  FrameworkCreditsBuyResult,
  FrameworkCreditsConfig,
  FrameworkCreditsEvent,
  FrameworkCreditsEventType,
  FrameworkCreditsNetwork,
  FrameworkCreditsSpendMeta,
  FrameworkCreditsSpendResult,
  FrameworkCreditsSurface,
} from "./credits";

// Platform v2 app.registry
export { createRegistrySurface, deriveAppAccountHash } from "./registry-surface";
export type {
  AppAccountHashInput,
  FrameworkRegistryApp,
  FrameworkRegistryConfig,
  FrameworkRegistryGlobalPause,
  FrameworkRegistrySurface,
  RegistrySurfaceChain,
  RegistrySurfaceDeps,
} from "./registry-surface";

// Platform v2 app.platformGame
export { createPlatformGameSurface } from "./platform-game-surface";
export type {
  FrameworkPlatformGameConfig,
  FrameworkPlatformGameFinalizeResult,
  FrameworkPlatformGameSnapshot,
  FrameworkPlatformGameStartResult,
  FrameworkPlatformGameStats,
  FrameworkPlatformGameSurface,
  FrameworkPlatformGameTx,
  FrameworkPlatformGameWithdrawResult,
  PlatformGameSurfaceChain,
  PlatformGameSurfaceDeps,
} from "./platform-game-surface";

// RFC P1-4 pending-tx durability lane + canonical tx-outcome reader
export { createChainPendingSurface } from "./chain-pending";
export type {
  FrameworkChainPendingDeps,
  FrameworkChainPendingSurface,
  FrameworkPendingHandlers,
  FrameworkPendingPollOptions,
  FrameworkPendingTx,
  FrameworkTxNotification,
  FrameworkTxOutcome,
  FrameworkTxOutcomeOptions,
  FrameworkTxOutcomeState,
} from "./chain-pending";

// S13 app.oracle extensions
export {
  createOracleExtensions,
  dataFeedFreshness,
  FrameworkSealError,
  MORPHEUS_ENCRYPTION_ALGORITHM,
} from "./oracle-ext";
export type {
  FrameworkDataFeedDeps,
  FrameworkDataFeedFreshness,
  FrameworkDataFeedQuote,
  FrameworkOracleExtensions,
  FrameworkOracleExtensionsDeps,
  FrameworkSealDeps,
  FrameworkSealPhase,
  FrameworkSealPublicKey,
  FrameworkSealStoreInput,
  FrameworkSealStoreResult,
} from "./oracle-ext";

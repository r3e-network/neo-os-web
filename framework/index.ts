import { createObservable, type Observable } from "./reactive";
import { singleFlight } from "./utils/async-utils";
import { extractTxid } from "./utils/transaction";
import { createAmountSurface } from "./amounts-surface";
import { createChainSurface } from "./chain-surface";
import { createErrorsSurface } from "./errors-surface";
import { createFundsSurface } from "./funds";
import { createFmtSurface } from "./fmt-surface";
import { createGameFacade } from "./game-facade";
import { AA_WRITE, guardedWrite } from "./internal/guards";
import { createOracleSurface } from "./oracle-surface";
import { createModeModule } from "./mode";
import { createNotifyModule } from "./notify-surface";
import { createStorageSurface } from "./storage-surface";
import type {
  AchievementDefinition,
  FrameworkActionOptions,
  FrameworkAppMode,
  FrameworkAssetSymbol,
  FrameworkContractArg,
  FrameworkGuestLeaderboard,
  FrameworkHost,
  FrameworkInvokeOptions,
  FrameworkModeSurface,
  FrameworkNotifyPolicy,
  FrameworkOperationRunOptions,
  FrameworkOperationState,
  FrameworkSuccessParams,
  MiniAppFramework,
  MiniAppFrameworkContext,
  MiniAppFrameworkOptions,
} from "./types";
import { createAaSurface } from "./aa";
import type { FrameworkAaService } from "./aa";
import { createClipboardSurface, createShareSurface } from "./clipboard";
import { createCreditsSurface } from "./credits";
import type { FrameworkCreditsConfig } from "./credits";
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


function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown, fallback = "error"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

/**
 * Dev-only console warning (RFC P0-2): silent in production builds so the
 * drop-mode DX warnings never reach end users.
 */
function devWarn(message: string): void {
  const env = (import.meta as unknown as { env?: { PROD?: boolean } }).env;
  if (env?.PROD) return;
  console.warn(message);
}

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
  const actionHandlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  // Drop-mode single-flight for actions.run (RFC P0-2): a re-entrant run of
  // the same key resolves `undefined` without running — exactly the previous
  // in-flight Set semantics — now with a dev-visible warning on the drop.
  const runActionFlight = singleFlight<
    [key: string, handler: (...args: unknown[]) => Promise<unknown>, args: readonly unknown[]],
    unknown
  >(
    (key) => key,
    async (_key, handler, args) => handler(...args),
    {
      mode: "drop",
      onDrop: (key) =>
        devWarn(`[framework] actions.run("${key}") dropped — this action is already running`),
    },
  );

  // app.storage — extracted module (RFC P0-1 §2 step 5). `local`/`hybrid`
  // are also consumed by state.persisted / achievements / db.collection.
  const storageSurface = createStorageSurface({
    prefix: storagePrefix,
    osStorage: () => os.storage,
  });
  const { local, hybrid } = storageSurface;

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

  // app.amount — extracted module (RFC P0-1 §2 step 9).
  const amount = createAmountSurface();

  const operationState = <TResult>(key: string): FrameworkOperationState<TResult> => ({
    key,
    status: "idle",
    txid: "",
    error: "",
    value: null,
    startedAt: 0,
    finishedAt: 0,
    runId: 0,
  });

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

  // app.chain — extracted module (RFC P0-1 §2 step 6): args/reads/writes/
  // events/signing, write lanes guarded per RFC P0-2.
  const chainSurface = createChainSurface({
    chain,
    contractAddress: contractAddressAccessor,
    guards: guardDeps,
    runWithNotify,
    fallbackNetwork: () => String(ctx.launchContext?.network ?? "testnet"),
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

  const framework: MiniAppFramework = {
    amount,

    /** app.mode — two-mode (guest|gamefi) surface + guest guard + leaderboard. */
    mode: modeSurface,

    notify: appNotify,

    /** app.fmt (RFC P0-3) — blessed display formatters (delegates to utils/format). */
    fmt: createFmtSurface(),

    /**
     * app.errors (RFC P0-4) — one-liner error→message extraction routed
     * through the same chain-error mapping app.notify.error uses, so the
     * setStatus and toast lanes show identical copy.
     */
    errors: createErrorsSurface({ t: ctx.t }),

    platform: {
      appId,
      launch: ctx.launchContext ?? {},
      get host(): FrameworkHost {
        const source = String(ctx.launchContext?.source ?? "").trim().toLowerCase();
        if (source === "onegate") return "onegate";
        if (typeof window !== "undefined" && window.parent !== window) return "miniapp-platform";
        return "standalone";
      },
      get isOneGate() {
        return this.host === "onegate";
      },
      get isMiniAppPlatform() {
        return this.host === "miniapp-platform";
      },
      param(key: string, fallback = ""): string {
        return ctx.launchContext?.params?.[key] ?? fallback;
      },
      /**
       * Typed launch-param decode (RFC P1-7): field-name → coercer, invoked
       * with the RAW param string (or undefined when absent).
       */
      params<T>(schema: { [K in keyof T]: (raw: string | undefined) => T[K] }): T {
        const out = {} as T;
        for (const key of Object.keys(schema) as Array<keyof T & string>) {
          out[key] = schema[key](ctx.launchContext?.params?.[key]);
        }
        return out;
      },
      /**
       * Sync network info from the launch context (default testnet). For the
       * wallet-verified network use the async `chain.detectNetwork()`.
       */
      network(): { name: string; isMainnet: boolean } {
        const name = String(ctx.launchContext?.network ?? "testnet").trim().toLowerCase() || "testnet";
        return { name, isMainnet: name.includes("mainnet") };
      },
      /**
       * Canonical Dora explorer links (RFC P1-7) — the platform host-app's
       * URL scheme (`https://dora.coz.io/<kind>/neo3/<network>/<value>`),
       * previously copy-pasted per app in utils/explorer.ts.
       */
      explorer: {
        tx(txid: string): string {
          const id = String(txid ?? "").trim();
          if (!id) return "";
          const segment = framework.platform.network().isMainnet ? "mainnet" : "testnet";
          return `https://dora.coz.io/transaction/neo3/${segment}/${encodeURIComponent(id)}`;
        },
        address(address: string): string {
          const value = String(address ?? "").trim();
          if (!value) return "";
          const segment = framework.platform.network().isMainnet ? "mainnet" : "testnet";
          return `https://dora.coz.io/address/neo3/${segment}/${encodeURIComponent(value)}`;
        },
        contract(scriptHash: string): string {
          const value = String(scriptHash ?? "").trim();
          if (!value) return "";
          const segment = framework.platform.network().isMainnet ? "mainnet" : "testnet";
          return `https://dora.coz.io/contract/neo3/${segment}/${encodeURIComponent(value)}`;
        },
      },
    },

    state: {
      atom<T>(key: string, initial: T): Observable<T> {
        const value = createObservable(initial);
        (ctx as { state?: Record<string, Observable> }).state ??= {};
        (ctx as { state?: Record<string, Observable> }).state![key] = value;
        return value;
      },
      persisted<T>(key: string, initial: T): Observable<T> {
        const storageKey = `state/${key}`;
        const value = createObservable(local.get<T>(storageKey, initial) as T);
        value.subscribe(() => local.set(storageKey, value.get()));
        (ctx as { state?: Record<string, Observable> }).state ??= {};
        (ctx as { state?: Record<string, Observable> }).state![key] = value;
        return value;
      },
      snapshot(values: Record<string, Observable>): Record<string, unknown> {
        return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.get()]));
      },
    },

    storage: storageSurface,

    db: {
      collection<T extends Record<string, unknown>>(name: string) {
        const prefix = `db/${name}/`;
        return {
          async get(id: string): Promise<T | null> {
            return hybrid.get<T>(`${prefix}${id}`, null);
          },
          async set(id: string, value: T): Promise<void> {
            await hybrid.set(`${prefix}${id}`, value);
          },
          async delete(id: string): Promise<void> {
            await hybrid.delete(`${prefix}${id}`);
          },
          async list(limit = 100): Promise<T[]> {
            const values = await hybrid.list(prefix, limit);
            return Object.values(values).filter(isRecord) as T[];
          },
        };
      },
    },

    actions: {
      register<TArgs extends unknown[], TResult>(
        key: string,
        handler: (...args: TArgs) => TResult | Promise<TResult>,
        actionOptions: FrameworkActionOptions<TResult> = {},
      ): void {
        const wrapped = async (...args: unknown[]) =>
          framework.actions.run(key, ...(args as TArgs));
        actionHandlers.set(key, async (...args: unknown[]) => {
          // RFC P1-3 guestBlocked: the standard early-return guard — show the
          // status copy and resolve undefined (never throw), exactly the
          // hand-written `if (app.mode.isGuest()) { …; return; }` semantics.
          if (actionOptions.guestBlocked && modeSurface.isGuest()) {
            const statusKey =
              typeof actionOptions.guestBlocked === "object"
                ? actionOptions.guestBlocked.statusKey
                : "guestModeBlocked";
            appNotify.warn(statusKey);
            return undefined;
          }
          try {
            return await runWithNotify(
              async () => handler(...(args as TArgs)),
              actionOptions,
            );
          } catch (error) {
            if (actionOptions.rethrow) throw error;
            return undefined;
          }
        });
        ctx.registerAction?.(key, wrapped);
      },
      /**
       * The standard connectWallet body (RFC P1-3): ensureWallet → refresh
       * fan-out (each loader error-isolated) → optional success toast.
       * Re-entry collapses via the run lane's drop-mode single-flight.
       */
      registerConnectWallet(connectOptions: {
        refresh?: Array<() => Promise<void>>;
        successKey?: string;
      } = {}): void {
        framework.actions.register(
          "connectWallet",
          async () => {
            const address = await chain.ensureWallet();
            await Promise.all(
              (connectOptions.refresh ?? []).map((load) =>
                load().catch(() => undefined),
              ),
            );
            return address;
          },
          connectOptions.successKey ? { successKey: connectOptions.successKey } : {},
        );
      },
      /**
       * Run a registered action. DROP-mode single-flight per key (RFC P0-2):
       * a re-entrant run resolves `undefined` without running, and an unknown
       * key resolves `undefined` — both now emit a DEV-ONLY console warning
       * (production behavior unchanged) so the silent-undefined DX trap is
       * visible while developing.
       */
      async run<TResult = unknown>(key: string, ...args: unknown[]): Promise<TResult | undefined> {
        const handler = actionHandlers.get(key);
        if (!handler) {
          devWarn(`[framework] actions.run("${key}") — no action registered under this key`);
          return undefined;
        }
        return await runActionFlight(key, handler, args) as TResult | undefined;
      },
    },

    /** app.chain — extracted module (RFC P0-1 §2 step 6). */
    chain: chainSurface,

    operations: {
      create<TResult = unknown>(key: string) {
        const state = createObservable<FrameworkOperationState<TResult>>(operationState<TResult>(key));
        let runId = 0;
        return {
          state,
          reset(): void {
            state.set(operationState<TResult>(key));
          },
          async run<TValue extends TResult = TResult>(
            work: () => Promise<TValue>,
            runOptions: FrameworkOperationRunOptions<TValue> = {},
          ): Promise<TValue | undefined> {
            const nextRunId = runId + 1;
            runId = nextRunId;
            state.set({
              ...state.get(),
              status: "running",
              txid: "",
              error: "",
              startedAt: Date.now(),
              finishedAt: 0,
              runId: nextRunId,
            });
            try {
              const value = await work();
              if (runId !== nextRunId) return value;
              const txid = extractTxid(value);
              state.set({
                ...state.get(),
                status: "succeeded",
                txid,
                error: "",
                value,
                finishedAt: Date.now(),
              });
              toastSuccess(runOptions.successKey, runOptions.successParams, value);
              return value;
            } catch (error) {
              if (runId !== nextRunId) {
                if (runOptions.rethrow) throw error;
                return undefined;
              }
              state.set({
                ...state.get(),
                status: "failed",
                error: errorMessage(error, runOptions.errorKey),
                finishedAt: Date.now(),
              });
              notify.error?.(error, runOptions.errorKey);
              if (runOptions.rethrow) throw error;
              return undefined;
            }
          },
        };
      },
    },

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

    /** app.oracle — extracted module (RFC P0-1 §2 step 8). */
    oracle: createOracleSurface({
      appId,
      guards: guardDeps,
      oracleExt: () => getOracleExt(),
      write: (spec) => chainSurface.write(spec),
    }),

    stats: {
      async increment(key: string, by = 1, scope: "global" | "user" = "global"): Promise<number> {
        const id = scope === "user" ? `${chain.address.get() || await chain.ensureWallet()}:${key}` : key;
        const stats = framework.db.collection<{ value: number }>("stats");
        const current = await stats.get(id);
        const next = Number(current?.value ?? 0) + by;
        await stats.set(id, { value: next });
        return next;
      },
      leaderboard: {
        /**
         * Submit a score to the shared OS board.
         *
         * GUEST-MODE DESIGN (aligned with app.mode semantics): the OS board
         * is an off-chain lane guests ARE allowed to use — that is exactly
         * why app.mode.guestLeaderboard exists — so a guest submit is NOT a
         * guarded write like chain/oracle lanes. Instead it is routed through
         * the guest namespace (`<appId>:guest:<score>`, the same encoding as
         * mode.guestLeaderboard.submit) so a guest run can never place an
         * unprefixed score on the shared gamefi board. Cross-mode isolation
         * is two-sided: `top()` below filters the guest namespace out, and
         * mode.guestLeaderboard.get() is the guest read lane.
         */
        async submit(score: number | string): Promise<void> {
          if (modeSurface.isGuest()) {
            await modeSurface.guestLeaderboard.submit(score);
            return;
          }
          await os.leaderboard?.submitScore(String(score));
        },
        async top(limit = 100): Promise<Array<{ user: string; score: string }>> {
          const rows = (await os.leaderboard?.get(limit)) ?? [];
          // Guest rows are namespaced (`<appId>:guest:<score>`) on the same
          // OS board — never leak them into the non-guest board view
          // (cross-mode isolation of app.mode.guestLeaderboard).
          return rows.filter((row) => !isGuestBoardRow(row));
        },
      },
    },

    achievements: {
      async awardOnce(definition: AchievementDefinition, user?: string): Promise<{ awarded: boolean }> {
        const recipient = user || chain.address.get() || await chain.ensureWallet();
        const marker = `achievements/awarded/${recipient}/${definition.id}`;
        if (local.get<boolean>(marker, false)) return { awarded: false };
        await os.badge?.define(definition.id, definition.name, definition.criteria);
        await os.badge?.award(definition.id, recipient);
        local.set(marker, true);
        return { awarded: true };
      },
      async list(user?: string): Promise<unknown[]> {
        return os.badge?.list(user) ?? [];
      },
    },

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

// RFC P0-3 app.fmt
export { createFmtSurface, formatClock } from "./fmt-surface";
export type {
  FrameworkFmt,
  FrameworkFmtDecimalsOptions,
  FrameworkFmtTruncateOptions,
} from "./fmt-surface";

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

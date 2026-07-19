/**
 * framework/types — the app-facing framework contract (RFC P0-1).
 *
 * All exported types formerly declared inline in `framework/index.ts`, plus
 * the explicit {@link MiniAppFramework} interface (previously
 * `ReturnType<typeof createMiniAppFramework>`) so the API surface is a
 * diffable, per-member-documented contract. Everything here is re-exported
 * from `framework/index.ts` — existing import paths keep resolving.
 */

import type { Observable } from "./reactive";
import type { FrameworkAaService, FrameworkAaSurface } from "./aa";
import type { FrameworkCreditsConfig, FrameworkCreditsSurface } from "./credits";
import type { FrameworkRegistryConfig, FrameworkRegistrySurface } from "./registry-surface";
import type {
  FrameworkPlatformGameConfig,
  FrameworkPlatformGameSurface,
} from "./platform-game-surface";
import type {
  FrameworkBusChannel,
  FrameworkBusSurface,
  FrameworkEventsSurface,
} from "./events";
import type { FrameworkLifecycleSurface, LifecycleSurfaceService } from "./lifecycle";
import type {
  FrameworkDataFeedDeps,
  FrameworkOracleExtensions,
  FrameworkSealDeps,
} from "./oracle-ext";
import type { FrameworkPermissionsInput, FrameworkPermissionsSurface } from "./permissions";
import type { FrameworkResourcesSurface, FrameworkTokenArtUrls } from "./resources";
import type { FrameworkClipboardSurface, FrameworkShareSurface } from "./clipboard";
import type { FrameworkWalletSurface, WalletSurfaceBalanceService } from "./wallet";
import type { FrameworkErrorsSurface } from "./errors-surface";
import type { FrameworkQueryResult, FrameworkReadOptions } from "./chain-query";
import type {
  FrameworkChainPendingSurface,
  FrameworkTxOutcome,
  FrameworkTxOutcomeOptions,
} from "./chain-pending";
import type {
  FrameworkRewardRunner,
  FrameworkRewardRunnerHooks,
  NormalizedRewardGameMode,
  RewardGameBalances,
  RewardGameConfig,
  RewardGameFinalizeResult,
  RewardGameProgressionState,
  RewardGameRecoverResult,
  RewardGameSession,
  RewardGameSettlement,
  RewardGameSnapshot,
  RewardGameStartResult,
  RewardGameStatus,
  RewardGameStepResult,
  RewardGameStorage,
  RewardGameTxResult,
} from "./gamefi";
import type { TeeSessionOp, TeeStepResult } from "./logic/tee-session";
import type {
  GameSessionObservables,
  GameSessionStatus,
  LeaderEntry,
  SolveRow,
  SolvedEventSlots,
} from "./game";
import type { applyGameSnapshot } from "./game";

export type FrameworkHost = "onegate" | "miniapp-platform" | "standalone";

export interface FrameworkContractArg {
  type: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "PublicKey" | "ByteArray" | "Array";
  value: string | number | boolean | FrameworkContractArg[];
}

export interface FrameworkTxResult {
  txid: string;
  event?: unknown;
  success?: boolean;
  verified?: boolean;
}

/**
 * Toast policy for the framework write wrappers (S2).
 * - `'all'` (default): success toast when a `successKey` is given + error toast
 *   — the exact pre-policy behavior.
 * - `'errors'`: error toast only; success toasts suppressed.
 * - `'silent'`: no toasts at all — errors still throw (typed) so composables
 *   that own their own multi-step messaging can branch on them.
 */
export type FrameworkNotifyPolicy = "all" | "errors" | "silent";

/**
 * Params interpolated into a success toast's `t(key, params)` call — either a
 * literal params record or a builder invoked with the operation result, so
 * post-write values ("withdrew {amount}", "vault {id} created") can drive the
 * toast copy.
 */
export type FrameworkSuccessParams<TResult = unknown> =
  | Record<string, unknown>
  | ((result: TResult) => Record<string, unknown>);

export interface FrameworkInvokeOptions {
  scriptHash?: string;
  signers?: unknown[];
  waitForEvent?: string;
  waitTimeoutMs?: number;
  onPaymentSent?: (txid: string) => void;
  onTransactionSent?: (txid: string) => void;
  /**
   * Toast policy consumed by the framework wrappers (write / payAndCall /
   * prepayAndCall / receiptPay / invokeMultiple); never forwarded to the
   * host. The raw invoke passthroughs never toast regardless of this flag.
   */
  notify?: FrameworkNotifyPolicy;
}

/** One call of a multi-invoke batch (single transaction, multiple scripts). */
export interface FrameworkInvokeCall {
  scriptHash?: string;
  operation: string;
  args: FrameworkContractArg[];
}

/** Result of a multi-invoke; `state`/`exception` carry the VM outcome. */
export interface FrameworkMultiInvokeResult extends FrameworkTxResult {
  state?: string;
  exception?: string;
}

export interface FrameworkMultiInvokeOptions {
  signers?: unknown[];
  onTransactionSent?: (txid: string) => void;
  notify?: FrameworkNotifyPolicy;
}

/** Normalized wallet message-signature envelope (see chain.signMessage). */
export interface FrameworkSignedMessage {
  signature: string;
  publicKey?: string;
  data?: string;
  /** Wallet-reported signing account/address when the provider exposes it. */
  account?: string;
}

export interface FrameworkWaitForStateOptions {
  /** Read attempts before giving up (default 4). */
  attempts?: number;
  /** Delay before the FIRST read (default 4000ms). */
  firstDelayMs?: number;
  /** Delay before every subsequent read (default 5000ms). */
  delayMs?: number;
}

export interface MiniAppFrameworkChain {
  address: Observable<string | null>;
  contractAddress?: Observable<string | null>;
  ensureWallet(): Promise<string>;
  detectNetwork?(): Promise<string>;
  read(operation: string, args?: FrameworkContractArg[], options?: unknown): Promise<unknown>;
  readArray?(operation: string, args?: FrameworkContractArg[], options?: unknown): Promise<unknown[]>;
  invoke(
    operation: string,
    args: FrameworkContractArg[],
    options?: FrameworkInvokeOptions,
  ): Promise<FrameworkTxResult>;
  invokeWithPayment(
    amount: string,
    memo: string,
    operation: string,
    args: FrameworkContractArg[],
    options?: FrameworkInvokeOptions,
  ): Promise<FrameworkTxResult>;
  listEvents?(eventName: string, options?: { limit?: number; offset?: number }): Promise<unknown[]>;
  /** Every matching event across all pages (ChainService.listAllEvents). */
  listAllEvents?(eventName: string): Promise<unknown[]>;
  /** Decode + null-filter events in one call (ChainService.listEventsParsed). */
  listEventsParsed?<T>(eventName: string, transform: (evt: unknown) => T | null): Promise<T[]>;
  /** Event confirming `txid`, or null on timeout (ChainService.waitForEvent). */
  waitForEvent?(txid: string, eventName: string, timeoutMs?: number): Promise<unknown>;
  /** Wallet message signing; result shape is wallet-specific (normalized by the framework). */
  signMessage?(message: string): Promise<unknown>;
  /** Two-step prepay lane: deposit confirmed in a block, then the consuming call. */
  prepayAndInvoke?(
    gasAmount: string,
    memo: string,
    operation: string,
    args: FrameworkContractArg[],
    options?: FrameworkInvokeOptions,
  ): Promise<FrameworkTxResult>;
  /** Multi-script single-transaction invoke (custom signer scopes allowed). */
  invokeMultiple?(
    calls: FrameworkInvokeCall[],
    options?: FrameworkMultiInvokeOptions,
  ): Promise<FrameworkMultiInvokeResult>;
}

export interface MiniAppFrameworkNotify {
  success?(messageKey: string, params?: Record<string, string | number>): void;
  error?(error: unknown, fallbackKey?: string): void;
  info?(messageKey: string, params?: Record<string, string | number>): void;
  warn?(messageKey: string, params?: Record<string, string | number>): void;
  guardResult?<T>(
    fn: () => Promise<T>,
    successKey?: string,
    errorKey?: string,
  ): Promise<{ ok: true; value: T } | { ok: false; error: unknown }>;
}

export interface MiniAppFrameworkOS {
  storage?: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<unknown>;
    delete(key: string): Promise<unknown>;
    list(prefix: string, limit?: number): Promise<Record<string, unknown>>;
  };
  badge?: {
    define(badgeId: string, name: string, criteria: string): Promise<void>;
    award(badgeId: string, user: string): Promise<void>;
    list(user?: string): Promise<unknown[]>;
    updateStat?(user: string, statKey: string, value: string): Promise<void>;
    getStat?(user: string, statKey: string): Promise<string>;
  };
  leaderboard?: {
    submitScore(score: string): Promise<void>;
    get(limit?: number): Promise<Array<{ user: string; score: string }>>;
  };
}

export interface FrameworkLaunchContext {
  appId?: string;
  source?: string | null;
  operation?: string | null;
  tab?: string | null;
  network?: string | null;
  params?: Record<string, string>;
  keys?: string[];
  hasParams?: boolean;
  signature?: string;
  /**
   * Manifest permission declarations (S11) — a string list or the manifest's
   * `PlatformPermissions` boolean-flag record. When the host delivers NO
   * declaration (undefined/null — every current launch lane), gated surfaces
   * default-allow; a present declaration is enforced verbatim.
   */
  permissions?: FrameworkPermissionsInput;
}

export interface MiniAppFrameworkContext {
  services: {
    chain: MiniAppFrameworkChain;
    notify?: MiniAppFrameworkNotify;
    os?: MiniAppFrameworkOS;
    /** Platform EventBus backing app.bus (+ balance auto-refresh); optional. */
    events?: FrameworkBusChannel;
    /** Platform LifecycleService backing app.lifecycle; optional. */
    lifecycle?: LifecycleSurfaceService;
    /** Platform BalanceService backing app.wallet balances; optional. */
    balance?: WalletSurfaceBalanceService;
    /** Platform AAService backing app.aa; optional. */
    aa?: FrameworkAaService;
  };
  os?: MiniAppFrameworkOS;
  t: (key: string, params?: Record<string, string | number>) => string;
  state?: Record<string, Observable>;
  setStatus?: (message: string, type: "success" | "error" | "warning" | "info") => void;
  clearStatus?: () => void;
  /**
   * Sugar for `ctx.setStatus(app.errors.messageOf(error, t(fallbackKey)),
   * "error")` (RFC P0-4). OPTIONAL and host-wired: the defineMiniApp
   * integration layer (apps/shared) provides it; the framework only publishes
   * the contract here. Apps must feature-check (`ctx.setError?.(…)`) until
   * their host ships the wiring.
   */
  setError?: (error: unknown, fallbackKey?: string) => void;
  launchContext?: Partial<FrameworkLaunchContext>;
  registerAction?: (key: string, handler: (...args: unknown[]) => Promise<unknown>) => void;
}

export interface MiniAppFrameworkOptions {
  appId?: string;
  /**
   * Override for the `app.storage.local` key prefix (default `neo:<appId>:`).
   * Migration lane: apps whose pre-framework localStorage keys lived in a
   * different namespace pass their legacy prefix so existing user data is not
   * orphaned (storage keys must stay byte-identical across the migration).
   */
  storagePrefix?: string;
  /**
   * app.oracle extension config (S13). `dataFeed` needs the deployed
   * MorpheusDataFeed contract + RPC endpoint (network-specific, so the app
   * layer injects it); absent ⇒ dataFeed reads throw a typed
   * FrameworkCapabilityError. `seal` overrides the Morpheus seal endpoints
   * (defaults target the platform edge routes).
   */
  oracle?: {
    dataFeed?: FrameworkDataFeedDeps;
    seal?: FrameworkSealDeps;
  };
  /**
   * app.resources overrides (S12): explicit base URL and bundler-resolved
   * token-art URLs (kept byte-identical to apps/shared/art/token-assets when
   * injected by the integration layer).
   */
  resources?: {
    baseUrl?: string;
    tokenArt?: Partial<FrameworkTokenArtUrls>;
  };
  /**
   * app.credits config (Credits v2): the credits-ledger endpoint URL plus the
   * network's deployed MiniAppCredits contract hash (network-specific, so the
   * app layer injects it — same pattern as `oracle.dataFeed`). Absent ⇒ every
   * app.credits method throws a typed FrameworkCapabilityError.
   */
  credits?: FrameworkCreditsConfig;
  /**
   * app.registry config (Platform Contract Library v2 phase 2): the network's
   * deployed PlatformRegistry contract hash (network-specific, so the app
   * layer injects it — same pattern as `credits`). Absent ⇒ every
   * app.registry read throws a typed FrameworkCapabilityError; the advisory
   * `deriveAccountHash` helper stays available (pure offline math).
   */
  registry?: FrameworkRegistryConfig;
  /**
   * app.platformGame config (Platform Contract Library v2 phase 2): the
   * network's deployed PlatformGame (RewardGame engine) contract hash
   * (network-specific, so the app layer injects it — same pattern as
   * `credits` / `registry`). Absent ⇒ every app.platformGame method throws a
   * typed FrameworkCapabilityError.
   */
  platformGame?: FrameworkPlatformGameConfig;
  /**
   * RFC P1-4 chain.pending / chain.readTxOutcome: resolve the JSON-RPC
   * endpoint for a network label (network-specific, so the app layer injects
   * it — same pattern as `credits` / `registry`). Absent ⇒ readTxOutcome
   * resolves "pending" for every tx; track/restore/list/clear unaffected.
   */
  rpcUrl?: (network: string) => string;
}

export interface FrameworkActionOptions<TResult = unknown> {
  successKey?: string;
  /**
   * Params for the success toast (S1) — a record or a `(result) => params`
   * builder receiving the handler's resolved value.
   */
  successParams?: FrameworkSuccessParams<TResult>;
  errorKey?: string;
  rethrow?: boolean;
  /**
   * Block this action in guest mode with the standard status copy (RFC P1-3
   * — replaces the hand-written `if (app.mode.isGuest()) { …; return; }`
   * early-return guards). `true` uses the `"guestModeBlocked"` i18n key;
   * pass `{ statusKey }` for app-specific copy. The blocked run resolves
   * `undefined` (early-return semantics — it does NOT throw).
   *
   * @example
   * ```ts
   * app.actions.register("withdraw", withdraw, { guestBlocked: true });
   * ```
   */
  guestBlocked?: boolean | { statusKey: string };
}

export interface FrameworkWriteSpec {
  operation: string;
  args: FrameworkContractArg[];
  successKey?: string;
  /** Params for the success toast — a record or a `(tx) => params` builder. */
  successParams?: FrameworkSuccessParams<FrameworkTxResult>;
  errorKey?: string;
  /** Toast policy (S2); default `'all'` — the exact pre-policy behavior. */
  notify?: FrameworkNotifyPolicy;
  reload?: () => Promise<void>;
}

export interface FrameworkPaySpec extends FrameworkWriteSpec {
  amountFixed8?: bigint | number | string;
  amountGas?: number | string;
  memo: string;
}

/** Outcome of a deposit-confirmation wait (mirrors the host indexer poll). */
export type FrameworkDepositSettlement = "confirmed" | "timeout" | "unreachable";

/**
 * Asset-parameterized deposit lane for {@link FrameworkPrepaySpec} (S3):
 * used when the prepaid deposit is a NEP-17 transfer on a caller-chosen
 * TOKEN contract (milestone-escrow's NEO|GAS escrows) instead of the host's
 * GAS-only prepay lane. The framework then owns the transfer → confirmation
 * wait → consuming call sequence itself.
 */
export interface FrameworkPrepayDepositLane {
  /**
   * NEP-17 token contract carrying the deposit transfer (e.g. the NEO or GAS
   * token hash). The transfer recipient is always the app contract, whose
   * OnNEP17Payment credits the sender for the memo; `amountFixed8` carries
   * the token's BASE UNITS unchanged (GAS fixed8, NEO whole units).
   */
  scriptHash: string;
  /**
   * Deposit-confirmation wait for the transfer txid, resolving once the
   * deposit is proven in a block ("confirmed"), gave up ("timeout"), or the
   * indexer could not be queried ("unreachable" — falls back to a fixed
   * settle delay). Injectable so apps keep their exact confirmation source
   * (e.g. the asset token's indexed Transfer event) and tests stay instant.
   * When absent the lane always applies the fixed settle delay.
   */
  confirm?: (txid: string) => Promise<FrameworkDepositSettlement>;
}

export interface FrameworkPrepaySpec extends FrameworkPaySpec {
  /**
   * Wait for the deposit to be confirmed in a block before the consuming
   * call (default true — the host's prepay lane). When explicitly false the
   * deposit and call are bundled atomically via invokeWithPayment instead.
   */
  waitForCredit?: boolean;
  /**
   * Custom asset-token deposit lane (see {@link FrameworkPrepayDepositLane}).
   * When present, the deposit transfer and consuming call are issued by the
   * framework and `waitForCredit` is ignored (the lane always settles the
   * deposit before the consuming call).
   */
  deposit?: FrameworkPrepayDepositLane;
}

export interface FrameworkReceiptPaySpec extends FrameworkWriteSpec {
  /**
   * Receipt id of the already-settled deposit transfer (positive integer).
   * Appended as the trailing Integer argument of the consuming call — the
   * mainnet lane where the host wallet cannot bundle a prepaid transfer
   * (flashloan deposit, memorial-shrine tribute).
   */
  receiptId: string | number;
}

export type FrameworkAssetSymbol = "GAS" | "NEO";

/**
 * Two-mode game surface. GUEST is a purely local game with NO chain/oracle/
 * reward access (write/oracle/reward entry points throw when current is
 * "guest"); GAMEFI is the chain + oracle + reward-pool flow. Defaults to
 * "gamefi" for back-compat.
 */
export type FrameworkAppMode = "guest" | "gamefi";

/**
 * Off-chain guest leaderboard. Delegates to the OS leaderboard (os.leaderboard)
 * but under a guest namespace so guest scores never mix with on-chain results.
 */
export interface FrameworkGuestLeaderboard {
  submit(score: number | string): Promise<void>;
  /** Decoded guest rows, ranked by numeric score descending. */
  get(limit?: number): Promise<Array<{ user: string; score: string }>>;
}

/**
 * app.mode — launcher-selected play mode, guest guard, and guest leaderboard.
 * The launcher sets {@link FrameworkModeSurface.set} before the play area
 * mounts; game main.tsx branches its actions on {@link isGuest}.
 */
export interface FrameworkModeSurface {
  /** Current play mode (default "gamefi"). */
  current: Observable<FrameworkAppMode>;
  set(mode: FrameworkAppMode): void;
  get(): FrameworkAppMode;
  isGuest(): boolean;
  isGameFi(): boolean;
  /** Subscribe to mode changes; returns an unsubscribe. */
  onChange(callback: (mode: FrameworkAppMode) => void): () => void;
  /** Off-chain, guest-namespaced leaderboard for guest scores. */
  guestLeaderboard: FrameworkGuestLeaderboard;
}

export type FrameworkOperationStatus = "idle" | "running" | "succeeded" | "failed";

export interface FrameworkOperationState<TResult = unknown> {
  key: string;
  status: FrameworkOperationStatus;
  txid: string;
  error: string;
  value: TResult | null;
  startedAt: number;
  finishedAt: number;
  runId: number;
}

export interface FrameworkOperationRunOptions<TResult = unknown>
  extends FrameworkActionOptions<TResult> {
  successKey?: string;
  errorKey?: string;
}

export type FrameworkRewardGameConfig = Omit<RewardGameConfig, "appId"> & {
  appId?: string;
};

export interface FrameworkRewardGameOptions<Op extends TeeSessionOp = TeeSessionOp> {
  storage?: RewardGameStorage<Op>;
  storagePrefix?: string;
  fetcher?: typeof fetch;
}

export interface FrameworkRewardGameFinalizeOptions {
  pollAttempts?: number;
  pollDelayMs?: number;
  delay?: (ms: number) => Promise<void>;
  fetcher?: typeof fetch;
}

export interface FrameworkRewardGameSettlementOptions {
  pollAttempts?: number;
  pollDelayMs?: number;
  delay?: (ms: number) => Promise<void>;
}

export interface OracleEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  kind: string;
  digest: string;
  payload: TPayload & {
    kind: string;
    appId: string;
    digest: string;
  };
}

export interface HttpOracleRequest {
  url: string;
  method?: "GET" | "POST";
  path?: string;
  body?: unknown;
}

export interface VrfOracleRequest {
  consumer: string;
  salt: string;
  rounds?: number;
  proofMode?: "single" | "batch";
}

export interface ComputeOracleRequest {
  workflow: string;
  input: unknown;
  sealed?: boolean;
}

export interface SealOracleRequest {
  purpose: string;
  recipient?: string;
  payload: unknown;
}

// ───────────────────────────────────────────────────────────────────────────
// Explicit MiniAppFramework surface interfaces (RFC P0-1)
// ───────────────────────────────────────────────────────────────────────────

/** Contract-argument builders (`app.chain.arg`). */
export interface FrameworkArgBuilder {
  string(value: unknown): FrameworkContractArg;
  integer(value: bigint | number | string): FrameworkContractArg;
  boolean(value: unknown): FrameworkContractArg;
  /** NEO address or 0x/40-hex account → Hash160 argument (converted). */
  hash160(value: string): FrameworkContractArg;
  /**
   * Hash160 argument that passes the value through UNCONVERTED.
   *
   * Deployed-ABI quirk lane (memorial-shrine, neo-ns): some live contracts
   * were deployed with Hash160 parameters that actually expect the RAW
   * base58 address literal, and the wallet/RPC layer must receive it
   * verbatim. Routing those through {@link hash160} would convert the
   * address to a script hash and silently change on-chain behavior — for
   * these parameters this builder MUST be used and `arg.hash160` must NOT.
   */
  hash160Raw(value: string): FrameworkContractArg;
  /** 33-byte compressed secp256r1 public key (bare hex; 0x prefix stripped). */
  publicKey(value: string): FrameworkContractArg;
  hash256(value: string): FrameworkContractArg;
  byteArray(value: string): FrameworkContractArg;
  array(value: FrameworkContractArg[]): FrameworkContractArg;
}

/** Amount scalers (`app.amount`) — protocol math, bigint base units. */
export interface FrameworkAmountSurface {
  /** Human GAS → fixed8 base units. THROWS on invalid input (see parseGasToFixed8). */
  gasToFixed8(value: bigint | number | string, options?: { allowZero?: boolean }): bigint;
  /** Fixed8 base units → decimal GAS string. */
  fixed8ToGas(value: bigint | number | string, maxDecimals?: number): string;
  /** Whole NEO → integer units. THROWS on invalid input. */
  neoToUnits(value: bigint | number | string, options?: { allowZero?: boolean }): bigint;
  /** GAS ×1e8 / NEO whole units by asset symbol. THROWS on invalid input. */
  assetToUnits(
    asset: FrameworkAssetSymbol,
    value: bigint | number | string,
    options?: { allowZero?: boolean },
  ): bigint;
  /**
   * Null-on-invalid GAS scaler (S6): returns the fixed8 base-unit integer
   * string, or `null` for ANY invalid input — NEVER throws, so app-side
   * localized `t()` rejection paths keep working. `gasToFixed8` (above)
   * intentionally keeps its THROW semantics — do not unify.
   */
  parseGasToFixed8(
    value: bigint | number | string,
    options?: { allowZero?: boolean },
  ): string | null;
  /** Null-on-invalid NEO parser — NEO is indivisible, fractions reject to null. */
  parseNeoToUnits(
    value: bigint | number | string,
    options?: { allowZero?: boolean },
  ): string | null;
  /** Null-on-invalid asset scaler: GAS ×1e8, NEO whole units — never throws. */
  parseAssetToUnits(
    asset: FrameworkAssetSymbol,
    value: bigint | number | string,
    options?: { allowZero?: boolean },
  ): string | null;
}

/**
 * app.notify (S1) — the single toast surface for miniapps. Delegates to the
 * injected notify service; standalone hosts without one fall back to
 * `ctx.setStatus` with the same localized copy (chain errors mapped through
 * utils/chain-errors so wallet/VM/RPC strings never reach a toast verbatim).
 */
export interface FrameworkNotifySurface {
  /** Success toast — t-key + params interpolation ("withdrew {amount}"). */
  success(key: string, params?: Record<string, unknown>): void;
  info(key: string, params?: Record<string, unknown>): void;
  warn(key: string, params?: Record<string, unknown>): void;
  /** Error toast — chain/RPC failures map to localized family copy. */
  error(error: unknown, fallbackKey?: string): void;
  /**
   * Wrap an async operation with automatic toasts, returning an explicit
   * `{ok}` discriminator so callers can gate post-success steps without
   * re-implementing try/catch.
   */
  guardResult<T>(
    fn: () => Promise<T>,
    guardOptions?: FrameworkActionOptions<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; error: unknown }>;
  /**
   * Like {@link guardResult} but resolves with the value or `undefined`
   * (or rethrows with `rethrow: true`) — the per-action toast wrapper.
   */
  guard<T>(
    fn: () => Promise<T>,
    guardOptions?: FrameworkActionOptions<T>,
  ): Promise<T | undefined>;
}

/** Sync network info derived from the launch context (RFC P1-7). */
export interface FrameworkNetworkInfo {
  /** Normalized network label ("mainnet" | "testnet" | host-specific). */
  name: string;
  isMainnet: boolean;
}

/** Canonical block-explorer links for the active network (RFC P1-7). */
export interface FrameworkExplorerLinks {
  /** Dora transaction URL; "" for empty input. */
  tx(txid: string): string;
  /** Dora address URL; "" for empty input. */
  address(address: string): string;
  /** Dora contract URL; "" for empty input. */
  contract(scriptHash: string): string;
}

/** app.platform — host detection + launch params. */
export interface FrameworkPlatformSurface {
  appId: string;
  launch: Partial<FrameworkLaunchContext>;
  /** Detected host shell ("onegate" | "miniapp-platform" | "standalone"). */
  readonly host: FrameworkHost;
  readonly isOneGate: boolean;
  readonly isMiniAppPlatform: boolean;
  /** One launch param with a fallback (`""` by default). */
  param(key: string, fallback?: string): string;
  /**
   * Typed launch-param decode (RFC P1-7 — replaces the per-app launch.ts
   * schema wrappers): field-name → coercer, invoked with the RAW param
   * string (or `undefined` when absent) so the coercer's own default applies.
   *
   * @example
   * ```ts
   * const { tab, round } = app.platform.params({
   *   tab: (raw) => raw ?? "overview",
   *   round: (raw) => Number(raw ?? 0),
   * });
   * ```
   */
  params<T>(schema: { [K in keyof T]: (raw: string | undefined) => T[K] }): T;
  /**
   * Sync network info from the launch context (defaults to testnet when the
   * host delivers none). For the wallet-verified network use the async
   * `chain.detectNetwork()`.
   */
  network(): FrameworkNetworkInfo;
  /** Canonical Dora explorer links for the active network. */
  readonly explorer: FrameworkExplorerLinks;
}

/** app.state — observable atoms registered on the ctx state record. */
export interface FrameworkStateSurface {
  atom<T>(key: string, initial: T): Observable<T>;
  /** Atom persisted to app.storage.local under `state/<key>`. */
  persisted<T>(key: string, initial: T): Observable<T>;
  snapshot(values: Record<string, Observable>): Record<string, unknown>;
}

/** Synchronous namespaced localStorage lane (`app.storage.local`). */
export interface FrameworkLocalStorageSurface {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  list(prefix: string): Record<string, unknown>;
}

/** Async OS-storage lane (`app.storage.remote`); no-ops without an OS host. */
export interface FrameworkRemoteStorageSurface {
  get<T>(key: string, fallback?: T | null): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string, limit?: number): Promise<Record<string, unknown>>;
}

export interface FrameworkStorageSurface {
  local: FrameworkLocalStorageSurface;
  remote: FrameworkRemoteStorageSurface;
}

/** app.actions — registered action handlers with toast wrapping. */
export interface FrameworkActionsSurface {
  /**
   * Register an action handler. The handler is wrapped with the S1 toast
   * policy (successKey/errorKey) and swallows errors unless `rethrow: true`.
   */
  register<TArgs extends unknown[], TResult>(
    key: string,
    handler: (...args: TArgs) => TResult | Promise<TResult>,
    actionOptions?: FrameworkActionOptions<TResult>,
  ): void;
  /**
   * Run a registered action. DROP-mode single-flight per key: a call while
   * the same key is in flight resolves `undefined` without running (double
   * clicks collapse); unknown keys also resolve `undefined`. Both cases emit
   * a dev-only console warning (never in production builds).
   */
  run<TResult = unknown>(key: string, ...args: unknown[]): Promise<TResult | undefined>;
  /**
   * Register the standard `connectWallet` action body (RFC P1-3 — replaces
   * the ~26 hand-registered copies): ensureWallet → `onAddress(addr)` mirror
   * hook → refresh fan-out (each loader error-isolated) → optional success
   * toast. Re-entry is collapsed by the run lane's drop-mode single-flight.
   *
   * @example
   * ```ts
   * app.actions.registerConnectWallet({
   *   onAddress: (addr) => store.setAddress(addr),
   *   refresh: [reloadBalances, reloadHistory],
   *   successKey: "walletConnected",
   * });
   * ```
   */
  registerConnectWallet(options?: {
    /** Data loaders fanned out after connection (errors isolated per loader). */
    refresh?: Array<() => Promise<void>>;
    /** Success-toast key (silent when omitted). */
    successKey?: string;
    /**
     * Local address-mirror hook — called with the resolved address BEFORE the
     * refresh fan-out so `refresh` loaders read a seeded mirror. Not
     * error-isolated: a throw surfaces through the action error-toast lane.
     */
    onAddress?: (addr: string) => void;
  }): void;
}

/** Handle returned by `app.operations.create(key)`. */
export interface FrameworkOperationHandle<TResult = unknown> {
  state: Observable<FrameworkOperationState<TResult>>;
  reset(): void;
  run<TValue extends TResult = TResult>(
    work: () => Promise<TValue>,
    runOptions?: FrameworkOperationRunOptions<TValue>,
  ): Promise<TValue | undefined>;
}

/** app.operations — keyed operation state machines (busy/txid/error cells). */
export interface FrameworkOperationsSurface {
  create<TResult = unknown>(key: string): FrameworkOperationHandle<TResult>;
}

/** app.chain — reads, writes, args, events, signing. */
export interface FrameworkChainSurface {
  arg: FrameworkArgBuilder;
  /** Underlying wallet-address accessor (observable in the platform host). */
  readonly address: Observable<string | null>;
  /** Deployed contract-address observable; a null-observable when unset. */
  readonly contractAddress: Observable<string | null>;
  /**
   * True once the app's contract address is configured for the network —
   * NOT whether a wallet is connected (S7). Read-only derived observable.
   */
  readonly contractReady: Observable<boolean>;
  ensureWallet(): Promise<string>;
  /** Current network label (e.g. "testnet"/"mainnet") if the host exposes it. */
  detectNetwork(): Promise<string>;
  /**
   * Raw contract read by operation + args, for app-specific parse/guard
   * flows. Prefer {@link query} for typed decodes (`readRaw` ≡ `query(...).raw()`).
   */
  readRaw(
    operation: string,
    args?: FrameworkContractArg[],
    options?: FrameworkReadOptions,
  ): Promise<unknown>;
  /** Raw ARRAY read — for contract methods returning a list stack item. */
  readArray(
    operation: string,
    args?: FrameworkContractArg[],
    options?: FrameworkReadOptions,
  ): Promise<unknown[]>;
  /**
   * Chainable typed read (RFC P0-6): one RPC read, decoded via `asInt` /
   * `asBigInt` / `asString` / `asBool` / `asAddress` / `asArray` / `asMap` /
   * `as(parse)` — see {@link FrameworkQueryResult} for the coercion contract.
   *
   * @example
   * ```ts
   * const total = await app.chain.query("totalGames").asInt();
   * const paused = await app.chain.query("isPaused").asBool(false);
   * ```
   */
  query(
    operation: string,
    args?: FrameworkContractArg[],
    options?: FrameworkReadOptions,
  ): FrameworkQueryResult;
  /**
   * Raw invoke with NO notify/reload wrapping — for composables that own
   * their own multi-step control flow and error reporting. Use
   * {@link write} instead for simple fire-and-notify writes.
   * Guest-guarded; S11 "invoke:primary" gate.
   */
  invoke(
    operation: string,
    args: FrameworkContractArg[],
    options?: FrameworkInvokeOptions,
  ): Promise<FrameworkTxResult>;
  /** Raw pay-and-call with NO notify/reload wrapping (see {@link invoke}). */
  invokeWithPayment(
    amount: string,
    memo: string,
    operation: string,
    args: FrameworkContractArg[],
    options?: FrameworkInvokeOptions,
  ): Promise<FrameworkTxResult>;
  /**
   * The fire-and-notify write lane: guest guard → S11 gate → invoke →
   * `reload()` on success, toasts per the S2 notify policy. Prefer this over
   * hand-wrapping `invoke` in try/catch + setStatus.
   */
  write(spec: FrameworkWriteSpec & FrameworkInvokeOptions): Promise<FrameworkTxResult>;
  /**
   * Raw event page.
   * @deprecated Alias of `app.events.list` — one concept, one home (S4).
   */
  events(eventName: string, options?: { limit?: number; offset?: number }): Promise<unknown[]>;
  /** Canonical positional event-state slot decode (utils/chain-events). */
  eventValue(ev: unknown, index: number): unknown;
  /**
   * Sign an arbitrary message with the connected wallet, normalizing the
   * wallet-specific result shapes into one typed envelope (S7).
   */
  signMessage(message: string): Promise<FrameworkSignedMessage>;
  /**
   * Multi-script single-transaction invoke with custom signer scopes (S7).
   * FAULT-state results throw with the VM exception SANITIZED.
   */
  invokeMultiple(
    calls: FrameworkInvokeCall[],
    multiOptions?: FrameworkMultiInvokeOptions,
  ): Promise<FrameworkMultiInvokeResult>;
  /**
   * Post-broadcast confirmation poll (S7): re-read state until the predicate
   * passes (4 attempts, delay before each read; per-attempt errors
   * swallowed). Resolves the first matching value, or `null` on exhaustion.
   */
  waitForState<T>(
    read: () => Promise<T>,
    until: (value: T) => boolean,
    waitOptions?: FrameworkWaitForStateOptions,
  ): Promise<T | null>;
  /**
   * RFC P1-4 pending-tx durability lane: persist a broadcast tx under a
   * named lane (survives reload via app.storage.local), poll an app-supplied
   * `isSettled` predicate with a bounded budget + visibility pausing, and
   * re-arm the lane after a reload with `restore`. Replaces the per-app
   * PENDING_STORAGE_KEY persist→poll→restore blocks.
   */
  readonly pending: FrameworkChainPendingSurface;
  /**
   * Canonical getapplicationlog verdict (RFC P1-4) — see chain-pending.ts.
   * NEVER rejects: malformed txids, RPC errors and node lag all resolve to
   * the poll-safe `"pending"` state.
   */
  readTxOutcome(txid: string, options?: FrameworkTxOutcomeOptions): Promise<FrameworkTxOutcome>;
}

/** app.funds — payment-carrying invoke lanes (S3). */
export interface FrameworkFundsSurface {
  /**
   * Pay-and-call in one step. When the host settles the payment as a
   * separate confirmed deposit and the consuming call then fails, the error
   * surfaces as FrameworkPrepaidActionError — the credit is withdrawable,
   * not lost.
   */
  payAndCall(spec: FrameworkPaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult>;
  /**
   * Deposit-then-act (S3): transfer GAS to the contract with a memo, wait
   * for the credit to confirm, then run the consuming operation. Failures
   * after the deposit surface as FrameworkPrepaidActionError.
   */
  prepayAndCall(spec: FrameworkPrepaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult>;
  /** Receipt-id deposit lane (S3, mainnet): consuming call carries the receipt id. */
  receiptPay(spec: FrameworkReceiptPaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult>;
  /** Withdrawable prepaid credit of `playerHash` (or the connected wallet). */
  creditOf(playerHash?: string, operation?: string): Promise<bigint>;
  /** Withdraw the caller's prepaid credit (waits for CreditWithdrawn). */
  withdrawCredit(operation?: string, successKey?: string): Promise<FrameworkTxResult>;
}

/** Envelope payload of `app.oracle.http` requests. */
export interface FrameworkOracleHttpPayload extends Record<string, unknown> {
  url: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}

/** Envelope payload of `app.oracle.vrf` requests. */
export interface FrameworkOracleVrfPayload extends Record<string, unknown> {
  consumer: string;
  salt: string;
  rounds: number;
  proofMode: "single" | "batch";
}

/** Envelope payload of `app.oracle.compute` requests. */
export interface FrameworkOracleComputePayload extends Record<string, unknown> {
  workflow: string;
  sealed: boolean;
  inputDigest: string;
  input?: unknown;
}

/** Envelope payload of `app.oracle.seal(request)` envelopes. */
export interface FrameworkOracleSealPayload extends Record<string, unknown> {
  purpose: string;
  recipient: string;
  payloadDigest: string;
}

/**
 * app.oracle.seal — callable envelope builder extended with the S13 seal
 * client (publicKey/encrypt/store).
 */
export type FrameworkOracleSealSurface = ((
  request: SealOracleRequest,
) => Promise<OracleEnvelope<FrameworkOracleSealPayload>>) & {
  /** Oracle X25519 public key (TTL cache + stale fallback). */
  publicKey: FrameworkOracleExtensions["seal"]["publicKey"];
  /** Encrypt a payload under the pinned envelope algorithm. */
  encrypt: FrameworkOracleExtensions["seal"]["encrypt"];
  /**
   * Submit a sealed envelope to the confidential store. WRITES to the
   * oracle's confidential store, so it is guest-guarded like every other
   * oracle write entry point (deliberately NO "oracle:request" gate).
   */
  store: FrameworkOracleExtensions["seal"]["store"];
};

/**
 * app.oracle — envelope builders + dispatch, extended with the S13 dataFeed
 * reader and seal client. Request/dispatch lanes are guest-guarded and gated
 * on the "oracle:request" manifest permission (S11, default-allow when no
 * manifest permissions are declared).
 */
export interface FrameworkOracleSurface {
  http(request: HttpOracleRequest): Promise<OracleEnvelope<FrameworkOracleHttpPayload>>;
  vrf(request: VrfOracleRequest): Promise<OracleEnvelope<FrameworkOracleVrfPayload>>;
  compute(request: ComputeOracleRequest): Promise<OracleEnvelope<FrameworkOracleComputePayload>>;
  seal: FrameworkOracleSealSurface;
  /** DataFeed reader (S13): wallet-free price reads + freshness math. */
  readonly dataFeed: FrameworkOracleExtensions["dataFeed"];
  /** Append the envelope payload as the trailing String arg of a write. */
  dispatch(
    envelope: OracleEnvelope,
    spec: Omit<FrameworkWriteSpec & FrameworkInvokeOptions, "args"> & {
      args?: FrameworkContractArg[];
    },
  ): Promise<FrameworkTxResult>;
}

/** app.stats — OS-board stats + shared leaderboard (guest-namespaced). */
export interface FrameworkStatsSurface {
  leaderboard: {
    /**
     * Submit a score to the shared OS board. Guest submissions route to the
     * guest namespace (never the shared gamefi board).
     */
    submit(score: number | string): Promise<void>;
    /** Top rows of the shared board, guest-namespaced rows filtered out. */
    top(limit?: number): Promise<Array<{ user: string; score: string }>>;
  };
}

/** Handle returned by `app.game.reward(config)` — the reward-game SDK bound to the app chain. */
export interface FrameworkRewardGameSurface<Op extends TeeSessionOp = TeeSessionOp> {
  config: RewardGameConfig;
  storage: RewardGameStorage<Op>;
  /** Normalized mode row for a difficulty id. */
  mode(difficulty: number | string): NormalizedRewardGameMode;
  /** freePool + creditOf reads (zeros on read errors). */
  balances(playerHash?: string): Promise<RewardGameBalances>;
  /** Difficulty-progression state derived from the Solved history. */
  progression(
    difficulty: number | string,
    playerHash?: string,
  ): Promise<RewardGameProgressionState>;
  /** Pay/credit the entry and start a game (guest-guarded, S11 pre-gated). */
  start(difficulty: number): Promise<RewardGameStartResult>;
  /** Open the TEE session for a started game (guest-guarded; requires "oracle:request" under a present declaration). */
  openSession(gameId: string, difficulty: number): Promise<RewardGameSession>;
  /** Record one op on the TEE session (per-session serialized; guest-guarded, "oracle:request"-gated). */
  recordOp(session: RewardGameSession, op: Op): Promise<RewardGameStepResult<Op>>;
  /** Replay a persisted op-log against the TEE (recovery lane; guest-guarded, "oracle:request"-gated). */
  replayOps(
    session: RewardGameSession,
    ops: readonly Op[],
    onStep?: (step: TeeStepResult, op: Op, index: number) => void | Promise<void>,
  ): Promise<TeeStepResult[]>;
  /** Seal the op-log + broadcast finalizeGame + observe settlement. */
  finalize(
    session: RewardGameSession,
    finalizeOptions?: FrameworkRewardGameFinalizeOptions,
  ): Promise<RewardGameFinalizeResult>;
  /** The player's active game (id + snapshot), if any. */
  recoverActive(): Promise<RewardGameRecoverResult>;
  /** Broadcast expireGame for a stuck game. */
  expire(gameId: string): Promise<RewardGameTxResult>;
  /** Withdraw reward credit (skips when no credit). */
  withdrawCredit(
    creditFixed8?: bigint | number | string,
  ): Promise<{ skipped: true; reason: "no-credit" } | { skipped: false; tx: RewardGameTxResult }>;
  /** getGame snapshot decode. */
  snapshot(gameId: string): Promise<RewardGameSnapshot>;
  /** Settlement from the Solved event or a getGame poll. */
  observeSettlement(
    gameId: string,
    solvedEvent?: unknown | null,
    settlementOptions?: FrameworkRewardGameSettlementOptions,
  ): Promise<RewardGameSettlement>;
  /**
   * Compose the SDK primitives into the standard reward-game lifecycle state
   * machine (RFC P0-7) — see {@link FrameworkRewardRunner}. The game supplies
   * only its deterministic `createView`/`applyOp` logic.
   *
   * @example
   * ```ts
   * const runner = app.game.reward(config).runner({
   *   createView: (session) => freshBoard(session.view),
   *   applyOp: (board, op) => stepBoard(board, op),
   * });
   * runner.registerStandardActions(app.actions);
   * await runner.resume();
   * ```
   */
  runner<View>(hooks: FrameworkRewardRunnerHooks<Op, View>): FrameworkRewardRunner<Op, View>;
}

/** app.game.player — connected-player script-hash helpers. */
export interface FrameworkGamePlayerSurface {
  /** Script-hash of the connected wallet ("" when disconnected). */
  scriptHash(): string;
  /** Wait for wallet connection and return the script-hash. */
  ensureScriptHash(): Promise<string>;
}

/** app.game.stats — statsOf(playerHash) reader (zeros on any error). */
export interface FrameworkGameStatsSurface {
  load(playerHash?: string): Promise<{ solves: number; totalWon: number }>;
}

/** app.game.leaderboard — Solved-event leaderboard builder. */
export interface FrameworkGameLeaderboardSurface {
  load<TRow extends SolveRow = SolveRow>(
    eventName?: string,
    slots?: SolvedEventSlots,
    limit?: number,
    extraRowFields?: (ev: unknown) => Partial<TRow>,
  ): Promise<{ ranked: LeaderEntry[]; mine: TRow[] }>;
}

/** app.game.session — standard session observables + snapshot apply. */
export interface FrameworkGameSessionSurface {
  observables<THistory extends SolveRow = SolveRow>(
    t?: (key: string) => string,
  ): GameSessionObservables<THistory>;
  applySnapshot(
    obs: Parameters<typeof applyGameSnapshot>[0],
    game: unknown,
    statusOf: (raw: number) => GameSessionStatus,
  ): void;
}

/** One difficulty row of a {@link FrameworkGameRuleConfig}. */
export interface FrameworkGameRuleDifficulty {
  stakeFixed8: bigint;
  label?: string;
  meta?: Record<string, unknown>;
}

/** Config for the `game.rules` factory (RFC P1-2). */
export interface FrameworkGameRuleConfig {
  /** Per-difficulty stakes keyed by the game's difficulty key. */
  difficulties: Record<string, FrameworkGameRuleDifficulty>;
  /** Payout policy: base percentage + optional undo penalty. */
  payout: { basePct: number; undoPenaltyPct?: number; maxUndos?: number };
  /** Settlement grace before an expired game can be released (default 600000ms). */
  settlementGraceMs?: number;
}

/**
 * The standard game-rules helpers (RFC P1-2) — the shared scaffold of the 13
 * near-identical per-game `logic/game-rules.ts` files. Per-game CONSTANTS
 * stay in the app (they are the actual diff); the helper bodies live here.
 */
export interface FrameworkGameRules {
  /** Rule row for a difficulty key; throws UNKNOWN_DIFFICULTY otherwise. */
  ruleOf(difficulty: string): {
    stakeFixed8: bigint;
    label: string;
    meta: Record<string, unknown>;
  };
  /** Contract status decode — delegates to rewardGameStatusOf. */
  statusOf(raw: unknown): RewardGameStatus;
  /** Fixed8 → display string — delegates to utils/format.formatGas (2 decimals). */
  gasDisplay(fixed8: bigint | string): string;
  /** Elapsed clock — delegates to the fleet-standard mm:ss formatClock. */
  formatClock(ms: number): string;
  /** basePct minus the undo penalty (undos clamped to maxUndos, floor 0). */
  rewardPctAfterUndos(undos: number): number;
  /** stake × pct / 100, floored in bigint space. */
  payoutFixed8(stakeFixed8: bigint, pct: number): bigint;
  /** True once the settlement grace has elapsed after `finishedAt` (ms). */
  canReleaseExpiredGame(state: { finishedAt: number }, nowMs: number): boolean;
  readonly settlementGraceMs: number;
}

/** app.game — reward-game SDK facade + player/stats/leaderboard helpers. */
export interface FrameworkGameSurface {
  reward<Op extends TeeSessionOp = TeeSessionOp>(
    rewardConfig: FrameworkRewardGameConfig,
    rewardOptions?: FrameworkRewardGameOptions<Op>,
  ): FrameworkRewardGameSurface<Op>;
  /**
   * Build the standard game-rules helpers from the game's constants
   * (RFC P1-2). Apps re-export the result from their `logic/game-rules.ts`.
   *
   * @example
   * ```ts
   * export const rules = app.game.rules({
   *   difficulties: { easy: { stakeFixed8: 2_000_000n }, hard: { stakeFixed8: 20_000_000n } },
   *   payout: { basePct: 100, undoPenaltyPct: 30, maxUndos: 3 },
   * });
   * ```
   */
  rules(config: FrameworkGameRuleConfig): FrameworkGameRules;
  player: FrameworkGamePlayerSurface;
  stats: FrameworkGameStatsSurface;
  leaderboard: FrameworkGameLeaderboardSurface;
  session: FrameworkGameSessionSurface;
}

/**
 * The `ctx.framework` / `app` object every miniapp receives (RFC P0-1) —
 * the explicit, diffable contract of `createMiniAppFramework`.
 *
 * Structural note: the lazily-constructed surfaces (`events`, `bus`,
 * `wallet`, `lifecycle`, `clipboard`, `share`, `permissions`, `resources`,
 * `aa`, `credits`, `registry`, `platformGame`) are getters at runtime —
 * constructed on first access and cached, so hosts that never touch one pay
 * nothing.
 */
export interface MiniAppFramework {
  /** Amount scalers — protocol math on bigint base units. */
  amount: FrameworkAmountSurface;
  /** app.mode — two-mode (guest|gamefi) surface + guest guard + leaderboard. */
  mode: FrameworkModeSurface;
  /** app.notify (S1) — the single toast surface. */
  notify: FrameworkNotifySurface;
  /** app.errors (RFC P0-4) — error→message extraction + typed code checks. */
  errors: FrameworkErrorsSurface;
  /** app.platform — host detection + launch params. */
  platform: FrameworkPlatformSurface;
  /** app.state — observable atoms (optionally persisted). */
  state: FrameworkStateSurface;
  /** app.storage — local / remote keyed storage. */
  storage: FrameworkStorageSurface;
  /** app.actions — registered actions with toast wrapping + drop-mode single-flight. */
  actions: FrameworkActionsSurface;
  /** app.chain — reads, writes, args, events, signing. */
  chain: FrameworkChainSurface;
  /** app.operations — keyed operation state machines. */
  operations: FrameworkOperationsSurface;
  /** app.funds — payment-carrying invoke lanes (S3). */
  funds: FrameworkFundsSurface;
  /** app.events (S4) — chain event queries + canonical slot decode. */
  readonly events: FrameworkEventsSurface;
  /** app.bus (S4) — pub/sub with lifecycle-scoped auto-unsubscribe. */
  readonly bus: FrameworkBusSurface;
  /** app.wallet (S5) — identity, balances, address/balance observables. */
  readonly wallet: FrameworkWalletSurface;
  /** app.lifecycle (S8) — mount/unmount, data loaders, visibility-aware poll. */
  readonly lifecycle: FrameworkLifecycleSurface;
  /** app.clipboard (S9) — copy with toast feedback via app.notify. */
  readonly clipboard: FrameworkClipboardSurface;
  /** app.share (S9) — native share sheet with clipboard fallback. */
  readonly share: FrameworkShareSurface;
  /** app.permissions (S11) — manifest gating; default-allow when undeclared. */
  readonly permissions: FrameworkPermissionsSurface;
  /** app.resources (S12) — host-base asset resolution + token artwork. */
  readonly resources: FrameworkResourcesSurface;
  /** app.aa (S10) — sponsorship/relay/session keys; typed capability errors. */
  readonly aa: FrameworkAaSurface;
  /**
   * app.credits (Credits v2) — platform credits: on-chain GAS buys,
   * instant DB-first spends, stale-flagged chain-checkpoint fallback reads.
   */
  readonly credits: FrameworkCreditsSurface;
  /**
   * app.registry (Platform Contract Library v2 phase 2) — typed reads of the
   * PlatformRegistry directory (getApp / appAccountOf / appIdOfAccount /
   * engineOf / pause state) plus the advisory `deriveAccountHash` AppAccount
   * prediction. Reads only; unconfigured ⇒ typed FrameworkCapabilityError.
   */
  readonly registry: FrameworkRegistrySurface;
  /**
   * app.platformGame (Platform Contract Library v2 phase 2) — the shared
   * PlatformGame RewardGame engine with the host appId auto-threaded into
   * every call: startGame / finalizeGame / expireGame / withdraw (guest guard
   * + S11 "invoke:primary") plus typed reads (freePool / poolBalance /
   * reservedPool / heldForApp / creditOf / activeGameOf / statsOf / getGame,
   * ungated). Unconfigured ⇒ typed FrameworkCapabilityError.
   */
  readonly platformGame: FrameworkPlatformGameSurface;
  /** app.oracle — envelope builders + dispatch + S13 dataFeed/seal client. */
  oracle: FrameworkOracleSurface;
  /** app.stats — OS-board stats + shared leaderboard. */
  stats: FrameworkStatsSurface;
  /** app.game — reward-game SDK facade + helpers. */
  game: FrameworkGameSurface;
}

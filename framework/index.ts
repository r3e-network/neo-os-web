import { createObservable, type Observable } from "./reactive";
import { mapChainError } from "./utils/chain-errors";
import { eventStateValue } from "./utils/chain-events";
import { MiniAppError } from "./utils/errors";
import { sha256Hex0x } from "./utils/hash";
import { addressToScriptHash } from "./utils/neo";
import { localStorageAvailable } from "./utils/safe-storage";
import { extractTxid } from "./utils/transaction";
import { createAaSurface } from "./aa";
import type { FrameworkAaService } from "./aa";
import { createClipboardSurface, createShareSurface } from "./clipboard";
import { createBusSurface, createEventsSurface } from "./events";
import type { FrameworkBusChannel } from "./events";
import { createLifecycleSurface } from "./lifecycle";
import type { LifecycleSurfaceService } from "./lifecycle";
import { createOracleExtensions } from "./oracle-ext";
import type {
  FrameworkDataFeedDeps,
  FrameworkSealDeps,
  FrameworkSealStoreInput,
} from "./oracle-ext";
import { createPermissionsSurface } from "./permissions";
import type { FrameworkPermissionsInput } from "./permissions";
import { createResourcesSurface } from "./resources";
import type { FrameworkTokenArtUrls } from "./resources";
import { createWalletSurface } from "./wallet";
import type { WalletSurfaceBalanceService } from "./wallet";
import {
  createLocalStorageRewardGameStorage,
  expireRewardGame,
  finalizeRewardGame,
  fixed8ToGasString,
  observeRewardGameSettlement,
  openRewardGameSession,
  readRewardGameSnapshot,
  readRewardGameProgression,
  recoverActiveRewardGame,
  recordRewardGameOp,
  refreshRewardGameBalances,
  replayRewardGameOps,
  rewardGameModeOf,
  rewardGameProgressionOf,
  startRewardGame,
  withdrawRewardCredit,
} from "./gamefi";
import type { RewardGameConfig, RewardGameSession, RewardGameStorage } from "./gamefi";
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

/** Count-then-page enumeration spec (see chain.enumerate). */
export interface FrameworkEnumerateSpec<T> {
  /** Contract read returning the total item count; ids are assumed 1..count. */
  countOp?: string;
  countArgs?: FrameworkContractArg[];
  /** Explicit id list — takes precedence over `countOp`. */
  ids?: ReadonlyArray<number | string>;
  /** Per-id detail read operation. */
  detailOp: string;
  /** Args for the detail read; defaults to a single Integer id argument. */
  detailArgs?: (id: number | string) => FrameworkContractArg[];
  /** Decode one detail read; return `null` to skip the row. */
  decode: (raw: unknown, id: number | string) => T | null;
  /** Defensive cap on ids fetched (default 500) — the newest ids win. */
  cap?: number;
  /** Result ordering by numeric id (default 'newest' = descending). */
  order?: "newest" | "oldest";
  scriptHash?: string;
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
}

export interface FrameworkReadSpec<T = unknown> {
  operation: string;
  args?: FrameworkContractArg[];
  scriptHash?: string;
  cache?: boolean;
  cacheTtlMs?: number;
  parse?: (raw: unknown) => T;
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

export interface AchievementDefinition {
  id: string;
  name: string;
  criteria: string;
}

/**
 * Deposit-then-act failure envelope (S3): the prepaid GAS deposit transfer
 * was BROADCAST on-chain but the consuming call failed — the funds are NOT
 * lost, they sit as withdrawable credit on the contract. Apps branch on this
 * class (gasbox / dev-tipping / self-loan / gov-merc / time-capsule) to show
 * localized recovery copy, so the class identity must stay stable: it is
 * exported here and re-exported by apps/shared so `instanceof` resolves to a
 * single class everywhere.
 */
export class FrameworkPrepaidActionError extends MiniAppError {
  /** Txid of the BROADCAST deposit transfer (recovery affordances link it). */
  readonly txid: string;
  /** The consuming operation that failed after the deposit went out. */
  readonly operation: string;
  /** The underlying error thrown by the consuming call. */
  readonly actionError: unknown;
  /** How far the deposit was proven when the consuming call failed. */
  readonly settlement: FrameworkDepositSettlement;
  /**
   * Discriminant: `settlement === "confirmed"` — the deposit is PROVEN in a
   * block. On "timeout"/"unreachable" the deposit is merely unproven by the
   * indexer, not absent; the stranded-credit recovery copy applies either
   * way, which is why apps branch on `instanceof`, not on this flag.
   */
  readonly depositConfirmed: boolean;

  constructor(
    operation: string,
    txid: string,
    actionError: unknown,
    settlement: FrameworkDepositSettlement = "confirmed",
  ) {
    const reason =
      actionError instanceof Error ? actionError.message : String(actionError);
    const depositState =
      settlement === "confirmed" ? "confirmed" : `broadcast (settlement ${settlement})`;
    super(
      `Deposit ${depositState} but "${operation}" failed — the prepaid credit remains on the contract and is withdrawable (deposit tx ${txid}): ${reason}`,
      "PREPAID_ACTION_FAILED",
      undefined,
      { operation, txid, settlement },
    );
    this.name = "FrameworkPrepaidActionError";
    this.txid = txid;
    this.operation = operation;
    this.actionError = actionError;
    this.settlement = settlement;
    this.depositConfirmed = settlement === "confirmed";
  }
}

/**
 * Recognize the host chain-service's deposit-confirmed failure shape
 * (apps/shared DepositConfirmedActionFailedError) structurally — the
 * framework cannot import it (package boundary), and hosts may ship their
 * own equivalent.
 */
function isDepositConfirmedFailure(error: unknown): error is Error & {
  operation?: unknown;
  depositTxid: string;
  actionError: unknown;
  settlement?: unknown;
} {
  return (
    error instanceof Error &&
    typeof (error as { depositTxid?: unknown }).depositTxid === "string" &&
    "actionError" in error
  );
}

/**
 * Read the host error's settlement field, defaulting to "confirmed" for host
 * shapes that predate the field (their wrap used to be confirmed-only).
 */
function settlementOf(error: { settlement?: unknown }): FrameworkDepositSettlement {
  return error.settlement === "timeout" || error.settlement === "unreachable"
    ? error.settlement
    : "confirmed";
}

/** Translate host deposit-confirmed failures into the stable framework class. */
function toPrepaidActionError(error: unknown): unknown {
  if (error instanceof FrameworkPrepaidActionError) return error;
  if (isDepositConfirmedFailure(error)) {
    return new FrameworkPrepaidActionError(
      String(error.operation ?? ""),
      error.depositTxid,
      error.actionError,
      settlementOf(error),
    );
  }
  return error;
}

/**
 * Map a contract revert onto an app i18n key (gov-merc's `windowRevertKey`
 * pattern, generalized — S3). Patterns are tried in map insertion order;
 * string patterns match as case-insensitive substrings, RegExps with their
 * own flags. A {@link FrameworkPrepaidActionError} message embeds the
 * consuming call's revert reason, so it matches here too. Returns the first
 * matching key, or `null` so callers keep their own fallback handling.
 */
export function revertKeyOf<K extends string>(
  error: unknown,
  map: Record<K, RegExp | string | ReadonlyArray<RegExp | string>>,
): K | null {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return null;
  const haystack = message.toLowerCase();
  for (const key of Object.keys(map) as K[]) {
    const patterns = map[key];
    const list: ReadonlyArray<RegExp | string> = Array.isArray(patterns)
      ? patterns
      : [patterns as RegExp | string];
    for (const pattern of list) {
      const matched =
        typeof pattern === "string"
          ? haystack.includes(pattern.toLowerCase())
          : pattern.test(message);
      if (matched) return key;
    }
  }
  return null;
}

/** Resolve a success-params record or `(result) => params` builder. */
function resolveSuccessParams<T>(
  params: FrameworkSuccessParams<T> | undefined,
  result: T,
): Record<string, unknown> | undefined {
  return typeof params === "function" ? params(result) : params;
}

/** Run `work` over `items` in fixed-size parallel chunks, preserving order. */
async function runChunked<TIn, TOut>(
  items: readonly TIn[],
  chunkSize: number,
  work: (item: TIn) => Promise<TOut>,
): Promise<TOut[]> {
  const results: TOut[] = [];
  for (let start = 0; start < items.length; start += chunkSize) {
    const chunk = items.slice(start, start + chunkSize);
    results.push(...(await Promise.all(chunk.map((item) => work(item)))));
  }
  return results;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function compactInvokeOptions(spec: FrameworkWriteSpec | FrameworkPaySpec): FrameworkInvokeOptions {
  const source = spec as FrameworkWriteSpec & FrameworkInvokeOptions;
  const options: FrameworkInvokeOptions = {};
  if (source.scriptHash) options.scriptHash = source.scriptHash;
  if (source.signers) options.signers = source.signers;
  if (source.waitForEvent) options.waitForEvent = source.waitForEvent;
  if (source.waitTimeoutMs) options.waitTimeoutMs = source.waitTimeoutMs;
  if (source.onPaymentSent) options.onPaymentSent = source.onPaymentSent;
  if (source.onTransactionSent) {
    options.onTransactionSent = source.onTransactionSent;
  }
  return options;
}

function fixed8Amount(spec: FrameworkPaySpec): string {
  if (spec.amountFixed8 !== undefined) return String(spec.amountFixed8);
  return gasFixed8Amount(spec.amountGas ?? "");
}

/**
 * Fixed settle delay applied by the custom deposit lane when no
 * deposit-confirmation source exists or the indexer is unreachable — the
 * same 4s fallback the host prepay lane (and the app flows this lane
 * retires) use before the consuming call.
 */
const DEPOSIT_SETTLE_FALLBACK_MS = 4_000;

function accountToHash160(value: string): string {
  const raw = String(value ?? "").trim();
  if (/^(0x)?[0-9a-fA-F]{40}$/.test(raw)) {
    return raw.startsWith("0x") ? raw.toLowerCase() : `0x${raw.toLowerCase()}`;
  }
  const converted = addressToScriptHash(raw);
  if (/^0x[0-9a-fA-F]{40}$/.test(converted)) return converted.toLowerCase();
  throw new Error("Account must be a valid Neo N3 address or Hash160");
}

function gasFixed8Amount(value: bigint | number | string, allowZero = false): string {
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error("GAS amount cannot be negative");
    if (!allowZero && value === 0n) throw new Error("GAS amount must be positive");
    return value.toString();
  }
  const raw = typeof value === "number"
    ? Number.isFinite(value)
      ? value.toFixed(8).replace(/\.?0+$/, "")
      : ""
    : String(value ?? "").trim();
  if (raw.startsWith("-")) throw new Error("GAS amount cannot be negative");
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    throw new Error("GAS amount must be a positive decimal amount");
  }
  const [whole = "0", fraction = ""] = raw.split(".");
  if (fraction.length > 8) throw new Error("GAS amount cannot have more than 8 decimals");
  const fixed8 = BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, "0") || "0");
  if (!allowZero && fixed8 <= 0n) throw new Error("GAS amount must be positive");
  return fixed8.toString();
}

function neoWholeAmount(value: bigint | number | string, allowZero = false): string {
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error("NEO amount cannot be negative");
    if (!allowZero && value === 0n) throw new Error("NEO amount must be positive");
    return value.toString();
  }
  const raw = String(value ?? "").trim();
  if (raw.startsWith("-")) throw new Error("NEO amount cannot be negative");
  if (!/^\d+$/.test(raw)) {
    throw new Error("NEO amount must be a whole number");
  }
  const units = BigInt(raw);
  if (units < 0n) throw new Error("NEO amount cannot be negative");
  if (!allowZero && units === 0n) throw new Error("NEO amount must be positive");
  return units.toString();
}

function errorMessage(error: unknown, fallback = "error"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

export function createMiniAppFramework(
  ctx: MiniAppFrameworkContext,
  options: MiniAppFrameworkOptions = {},
) {
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
  // Derived read-only readiness flag (S7): true once the deployed contract
  // address is known — the gate milestone-escrow derives from the raw service
  // today. `set` is a no-op (derived value), subscriptions ride the source.
  const contractReadyObservable: Observable<boolean> = {
    get: () => Boolean(contractAddressAccessor.get()),
    set: () => {},
    subscribe: (listener) => contractAddressAccessor.subscribe(listener),
  };
  const notify = ctx.services.notify ?? {};
  const storagePrefix = options.storagePrefix ?? `neo:${appId}:`;
  const inFlight = new Set<string>();
  const actionHandlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

  const localKey = (key: string) => `${storagePrefix}${key}`;
  const local = {
    get<T>(key: string, fallback: T | null = null): T | null {
      return parseJson<T | null>(localStorageAvailable()?.getItem(localKey(key)) ?? null, fallback);
    },
    set(key: string, value: unknown): void {
      localStorageAvailable()?.setItem(localKey(key), JSON.stringify(value));
    },
    delete(key: string): void {
      localStorageAvailable()?.removeItem(localKey(key));
    },
    list(prefix: string): Record<string, unknown> {
      const store = localStorageAvailable();
      const out: Record<string, unknown> = {};
      if (!store) return out;
      const fullPrefix = localKey(prefix);
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index);
        if (!key?.startsWith(fullPrefix)) continue;
        out[key.slice(storagePrefix.length)] = parseJson(store.getItem(key), null);
      }
      return out;
    },
  };

  const remote = {
    async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
      if (!os.storage) return fallback;
      const value = await os.storage.get(key);
      return value === undefined || value === null ? fallback : value as T;
    },
    async set(key: string, value: unknown): Promise<void> {
      if (!os.storage) return;
      await os.storage.set(key, value);
    },
    async delete(key: string): Promise<void> {
      if (!os.storage) return;
      await os.storage.delete(key);
    },
    async list(prefix: string, limit = 100): Promise<Record<string, unknown>> {
      if (!os.storage) return {};
      return os.storage.list(prefix, limit);
    },
  };

  const hybrid = {
    async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
      try {
        const value = await remote.get<T>(key, null);
        if (value !== null) return value;
      } catch {
        /* OneGate/standalone embeds may not expose OS storage; local survives. */
      }
      return local.get<T>(key, fallback);
    },
    async set(key: string, value: unknown): Promise<void> {
      local.set(key, value);
      try {
        await remote.set(key, value);
      } catch {
        /* Keep the local copy; remote sync can be retried by the app later. */
      }
    },
    async delete(key: string): Promise<void> {
      local.delete(key);
      try {
        await remote.delete(key);
      } catch {
        /* local delete already completed */
      }
    },
    async list(prefix: string, limit = 100): Promise<Record<string, unknown>> {
      const localValues = local.list(prefix);
      try {
        return { ...localValues, ...(await remote.list(prefix, limit)) };
      } catch {
        return localValues;
      }
    },
  };

  /** Success toast on the injected notify service, threading params (S1). */
  const toastSuccess = <T>(
    successKey: string | undefined,
    successParams: FrameworkSuccessParams<T> | undefined,
    result: T,
  ): void => {
    if (!successKey) return;
    const params = resolveSuccessParams(successParams, result);
    if (params === undefined) notify.success?.(successKey);
    else notify.success?.(successKey, params as Record<string, string | number>);
  };

  const runWithNotify = async <T>(
    work: () => Promise<T>,
    runOptions: {
      successKey?: string;
      successParams?: FrameworkSuccessParams<T>;
      errorKey?: string;
      notify?: FrameworkNotifyPolicy;
    } = {},
  ): Promise<T> => {
    const policy = runOptions.notify ?? "all";
    // 'silent' bypasses the notify service entirely — errors still throw
    // (typed) so multi-step composables own their own messaging (S2).
    if (policy === "silent") return work();
    const successKey = policy === "all" ? runOptions.successKey : undefined;
    const successParams = policy === "all" ? runOptions.successParams : undefined;
    if (notify.guardResult) {
      // The host guardResult cannot thread toast params — when params are
      // present, suppress its success toast and emit our own with them.
      const result = await notify.guardResult(
        work,
        successParams === undefined ? successKey : undefined,
        runOptions.errorKey,
      );
      if (result.ok) {
        if (successParams !== undefined) toastSuccess(successKey, successParams, result.value);
        return result.value;
      }
      throw result.error;
    }
    try {
      const value = await work();
      toastSuccess(successKey, successParams, value);
      return value;
    } catch (error) {
      notify.error?.(error, runOptions.errorKey);
      throw error;
    }
  };

  /**
   * app.notify (S1) — the single toast surface for miniapps. Delegates to the
   * injected notify service; standalone hosts without one fall back to
   * `ctx.setStatus` with the same localized copy (chain errors mapped through
   * utils/chain-errors so wallet/VM/RPC strings never reach a toast verbatim).
   */
  const appNotify = {
    /** Success toast — t-key + params interpolation ("withdrew {amount}"). */
    success(key: string, params?: Record<string, unknown>): void {
      const coerced = params as Record<string, string | number> | undefined;
      if (notify.success) notify.success(key, coerced);
      else ctx.setStatus?.(ctx.t(key, coerced), "success");
    },
    info(key: string, params?: Record<string, unknown>): void {
      const coerced = params as Record<string, string | number> | undefined;
      if (notify.info) notify.info(key, coerced);
      else ctx.setStatus?.(ctx.t(key, coerced), "info");
    },
    warn(key: string, params?: Record<string, unknown>): void {
      const coerced = params as Record<string, string | number> | undefined;
      if (notify.warn) notify.warn(key, coerced);
      else ctx.setStatus?.(ctx.t(key, coerced), "warning");
    },
    /** Error toast — chain/RPC failures map to localized family copy. */
    error(error: unknown, fallbackKey?: string): void {
      if (notify.error) {
        notify.error(error, fallbackKey);
        return;
      }
      const message =
        mapChainError(error, ctx.t) ??
        (error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : ctx.t(fallbackKey ?? "error"));
      ctx.setStatus?.(message, "error");
    },
    /**
     * Wrap an async operation with automatic toasts, returning an explicit
     * `{ok}` discriminator so callers can gate post-success steps without
     * re-implementing try/catch. `successParams` may be a `(result) => params`
     * builder so post-write values drive the toast copy.
     */
    async guardResult<T>(
      fn: () => Promise<T>,
      guardOptions: FrameworkActionOptions<T> = {},
    ): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
      try {
        const value = await fn();
        if (guardOptions.successKey) {
          const params = resolveSuccessParams(guardOptions.successParams, value);
          if (params === undefined) appNotify.success(guardOptions.successKey);
          else appNotify.success(guardOptions.successKey, params);
        }
        return { ok: true, value };
      } catch (error) {
        appNotify.error(error, guardOptions.errorKey);
        return { ok: false, error };
      }
    },
    /**
     * Like {@link guardResult} but resolves with the value or `undefined`
     * (or rethrows with `rethrow: true`) — the per-action toast wrapper
     * ~40 apps hand-roll around every registered action.
     */
    async guard<T>(
      fn: () => Promise<T>,
      guardOptions: FrameworkActionOptions<T> = {},
    ): Promise<T | undefined> {
      const result = await appNotify.guardResult(fn, guardOptions);
      if (result.ok) return result.value;
      if (guardOptions.rethrow) throw result.error;
      return undefined;
    },
  };

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
   * `app.chain.invoke` / `write` / `invokeWithPayment` / `invokeMultiple` and
   * the mutating `app.funds.*` lanes (payAndCall / prepayAndCall / receiptPay /
   * withdrawCredit), which are payment-carrying invokes of the same primary
   * contract — requires "invoke:primary", and the oracle request/dispatch
   * lane requires "oracle:request", so gating happens once here rather than
   * per app. Read lanes (chain.read/readRaw/readArray/events, funds.creditOf)
   * stay ungated.
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
    // (`available`, sponsorship.check) stay allowed.
    const guarded: typeof aa = {
      get available() {
        return aa.available;
      },
      sponsorship: {
        check: (scope) => aa.sponsorship.check(scope),
        request: async (amount, scope) => {
          assertNotGuest();
          return aa.sponsorship.request(amount, scope);
        },
      },
      relay: async (payload) => {
        assertNotGuest();
        return aa.relay(payload);
      },
      sessionKey: {
        create: async (permissions, expiresAt) => {
          assertNotGuest();
          return aa.sessionKey.create(permissions, expiresAt);
        },
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

  const createEnvelope = async <TPayload extends Record<string, unknown>>(
    kind: string,
    payload: TPayload,
  ): Promise<OracleEnvelope<TPayload>> => {
    const unsigned = { kind, appId, ...payload };
    const digest = await sha256Hex0x(stableJson(unsigned));
    return {
      kind,
      digest,
      payload: {
        ...unsigned,
        digest,
      } as OracleEnvelope<TPayload>["payload"],
    };
  };

  const arg = {
    string(value: unknown): FrameworkContractArg {
      return { type: "String", value: String(value ?? "") };
    },
    integer(value: bigint | number | string): FrameworkContractArg {
      return { type: "Integer", value: String(value) };
    },
    boolean(value: unknown): FrameworkContractArg {
      return { type: "Boolean", value: Boolean(value) };
    },
    hash160(value: string): FrameworkContractArg {
      return { type: "Hash160", value: accountToHash160(value) };
    },
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
    hash160Raw(value: string): FrameworkContractArg {
      return { type: "Hash160", value: String(value ?? "") };
    },
    /** 33-byte compressed secp256r1 public key (bare hex; 0x prefix stripped). */
    publicKey(value: string): FrameworkContractArg {
      const raw = String(value ?? "").trim().replace(/^0x/i, "");
      if (!/^(02|03)[0-9a-fA-F]{64}$/.test(raw)) {
        throw new Error("PublicKey must be a 33-byte compressed key in hex");
      }
      return { type: "PublicKey", value: raw };
    },
    hash256(value: string): FrameworkContractArg {
      const raw = String(value ?? "").trim().toLowerCase();
      const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
      if (!/^0x[0-9a-f]{64}$/.test(normalized)) {
        throw new Error("Hash256 must be 32 bytes of hex");
      }
      return { type: "Hash256", value: normalized };
    },
    byteArray(value: string): FrameworkContractArg {
      return { type: "ByteArray", value };
    },
    array(value: FrameworkContractArg[]): FrameworkContractArg {
      return { type: "Array", value };
    },
  };

  const amount = {
    gasToFixed8(value: bigint | number | string, options?: { allowZero?: boolean }): bigint {
      return BigInt(gasFixed8Amount(value, options?.allowZero === true));
    },
    fixed8ToGas(value: bigint | number | string, maxDecimals = 8): string {
      return fixed8ToGasString(value, maxDecimals);
    },
    neoToUnits(value: bigint | number | string, options?: { allowZero?: boolean }): bigint {
      return BigInt(neoWholeAmount(value, options?.allowZero === true));
    },
    assetToUnits(
      asset: FrameworkAssetSymbol,
      value: bigint | number | string,
      options?: { allowZero?: boolean },
    ): bigint {
      return asset === "NEO"
        ? BigInt(neoWholeAmount(value, options?.allowZero === true))
        : BigInt(gasFixed8Amount(value, options?.allowZero === true));
    },
    /**
     * Null-on-invalid GAS scaler (S6): returns the fixed8 base-unit integer
     * string, or `null` for ANY invalid input — NEVER throws, so app-side
     * localized `t()` rejection paths keep working. `gasToFixed8` (above)
     * intentionally keeps its THROW semantics — do not unify (gotcha #2).
     */
    parseGasToFixed8(
      value: bigint | number | string,
      options?: { allowZero?: boolean },
    ): string | null {
      try {
        return gasFixed8Amount(value, options?.allowZero === true);
      } catch {
        return null;
      }
    },
    /** Null-on-invalid NEO parser — NEO is indivisible, fractions reject to null. */
    parseNeoToUnits(
      value: bigint | number | string,
      options?: { allowZero?: boolean },
    ): string | null {
      try {
        return neoWholeAmount(value, options?.allowZero === true);
      } catch {
        return null;
      }
    },
    /** Null-on-invalid asset scaler: GAS ×1e8, NEO whole units — never throws. */
    parseAssetToUnits(
      asset: FrameworkAssetSymbol,
      value: bigint | number | string,
      options?: { allowZero?: boolean },
    ): string | null {
      try {
        return asset === "NEO"
          ? neoWholeAmount(value, options?.allowZero === true)
          : gasFixed8Amount(value, options?.allowZero === true);
      } catch {
        return null;
      }
    },
  };

  /**
   * Asset-parameterized deposit-then-act lane (S3 — milestone-escrow's
   * NEO|GAS escrows): the prepaid deposit is a NEP-17 transfer on the ASSET
   * token contract rather than the host's GAS-only prepay lane, so the
   * framework owns the transfer → confirmation wait → consuming call here.
   *
   * Once the deposit transfer has been accepted (txid), ANY consuming-call
   * failure is wrapped in {@link FrameworkPrepaidActionError}: the credit
   * sits on the contract under (asset, sender) and is recoverable by
   * retrying or withdrawing, so apps surface their localized stranded-credit
   * copy instead of a generic payment error — including on "timeout"
   * settlements, mirroring the app flows this lane retires (the deposit is
   * broadcast either way; only its indexing is unproven).
   */
  const prepayViaDepositLane = async (
    spec: FrameworkPrepaySpec & FrameworkInvokeOptions,
    lane: FrameworkPrepayDepositLane,
  ): Promise<FrameworkTxResult> => {
    const from = chain.address.get() || (await chain.ensureWallet());
    const to = contractAddressAccessor.get();
    if (!to) {
      throw new MiniAppError("Contract address is not configured", "CONTRACT_MISSING");
    }
    // Step 1: DEPOSIT — the transfer targets the TOKEN contract
    // (lane.scriptHash); the recipient is the app contract, whose
    // OnNEP17Payment credits the sender's prepaid balance for the memo.
    const transfer = await chain.invoke(
      "transfer",
      [
        arg.hash160(from),
        arg.hash160(to),
        arg.integer(fixed8Amount(spec)),
        arg.string(spec.memo),
      ],
      { scriptHash: lane.scriptHash },
    );
    // Step 2: wait for the deposit to land in a block before the consuming
    // call — intra-block ordering is fee/hash-based, so an unconfirmed
    // deposit lets the consuming call execute first and fault on missing
    // credit. Without a confirmation source, or when the indexer is
    // unreachable, fall back to the fixed settle delay.
    const settlement = lane.confirm ? await lane.confirm(transfer.txid) : "unreachable";
    if (settlement === "unreachable") {
      await new Promise((resolve) => setTimeout(resolve, DEPOSIT_SETTLE_FALLBACK_MS));
    }
    // Step 3: the consuming call. Failures after the deposit are the
    // stranded-credit branch (see the doc comment above) — the wrap carries
    // the OBSERVED settlement so "timeout"/"unreachable" deposits are not
    // reported as proven ("confirmed") in the recovery copy.
    try {
      const tx = await chain.invoke(spec.operation, spec.args, compactInvokeOptions(spec));
      if (tx.success !== false) await spec.reload?.();
      return tx;
    } catch (error) {
      throw new FrameworkPrepaidActionError(spec.operation, transfer.txid, error, settlement);
    }
  };

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

  const rewardChain = () => ({
    address: chain.address,
    contractAddress: chain.contractAddress ?? { get: () => "" },
    ensureWallet: () => chain.ensureWallet(),
    detectNetwork: async () => chain.detectNetwork?.() ?? String(ctx.launchContext?.network ?? "testnet"),
    read: (operation: string, args?: FrameworkContractArg[]) => chain.read(operation, args),
    invoke: (
      operation: string,
      args: FrameworkContractArg[],
      invokeOptions?: FrameworkInvokeOptions,
    ) => chain.invoke(operation, args, invokeOptions),
    invokeWithPayment: (
      paymentAmount: string,
      memo: string,
      operation: string,
      args: FrameworkContractArg[],
      invokeOptions?: FrameworkInvokeOptions,
    ) => chain.invokeWithPayment(paymentAmount, memo, operation, args, invokeOptions),
    ...(chain.listEvents
      ? {
          listEvents: (eventName: string, options?: { limit?: number; offset?: number }) =>
            chain.listEvents?.(eventName, options) ?? Promise.resolve([]),
        }
      : {}),
  });

  // ── app.mode: two-mode game surface + guest guard ──────────────────────────
  // GUEST mode disables every on-chain/oracle/reward WRITE lane (defense in
  // depth). Read-only lanes (chain.read/readRaw/readArray/events) stay allowed
  // so a guest can still read the reward pool for an upsell.
  const GUEST_BLOCKED_MESSAGE =
    "guest-mode: on-chain/oracle operations are disabled";
  const modeObservable = createObservable<FrameworkAppMode>("gamefi");
  const assertNotGuest = (): void => {
    if (modeObservable.get() === "guest") {
      throw new MiniAppError(GUEST_BLOCKED_MESSAGE, "GUEST_MODE_BLOCKED");
    }
  };
  // Guest scores go to the off-chain OS leaderboard under an app+":guest"
  // namespace prefix so they never mix with any on-chain / gamefi result.
  const GUEST_BOARD_PREFIX = `${appId}:guest:`;
  /**
   * Rows scanned from the OS board per guest read. The board can mix guest
   * and non-guest rows (stats.leaderboard shares it), so a `limit`-sized
   * window could miss every guest row; scan a defensive window instead
   * (same 500 cap chain.enumerate / events.listAll use) before filtering.
   */
  const GUEST_BOARD_SCAN_LIMIT = 500;
  const isGuestBoardRow = (row: { score?: unknown }): boolean =>
    String(row?.score ?? "").startsWith(GUEST_BOARD_PREFIX);
  /** Numeric rank for a decoded guest score; non-numeric rows sink last. */
  const guestScoreRank = (score: string): number => {
    const value = Number(score);
    return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
  };
  const guestLeaderboard: FrameworkGuestLeaderboard = {
    async submit(score: number | string): Promise<void> {
      await os.leaderboard?.submitScore(`${GUEST_BOARD_PREFIX}${score}`);
    },
    async get(limit = 100): Promise<Array<{ user: string; score: string }>> {
      const rows =
        (await os.leaderboard?.get(Math.max(limit, GUEST_BOARD_SCAN_LIMIT))) ?? [];
      // Re-rank numerically after decoding: the host board orders the RAW
      // prefixed strings ("app:guest:9" sorts above "app:guest:100"), so its
      // ordering is meaningless for guest rows.
      return rows
        .filter(isGuestBoardRow)
        .map((row) => ({
          user: row.user,
          score: String(row.score).slice(GUEST_BOARD_PREFIX.length),
        }))
        .sort((left, right) => guestScoreRank(right.score) - guestScoreRank(left.score))
        .slice(0, limit);
    },
  };
  const modeSurface: FrameworkModeSurface = {
    current: modeObservable,
    set(mode: FrameworkAppMode): void {
      modeObservable.set(mode === "guest" ? "guest" : "gamefi");
    },
    get(): FrameworkAppMode {
      return modeObservable.get();
    },
    isGuest(): boolean {
      return modeObservable.get() === "guest";
    },
    isGameFi(): boolean {
      return modeObservable.get() !== "guest";
    },
    onChange(callback: (mode: FrameworkAppMode) => void): () => void {
      return modeObservable.subscribe(() => callback(modeObservable.get()));
    },
    guestLeaderboard,
  };

  const framework = {
    amount,

    /** app.mode — two-mode (guest|gamefi) surface + guest guard + leaderboard. */
    mode: modeSurface,

    notify: appNotify,

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

    storage: {
      local,
      remote,
      hybrid,
    },

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
      async run<TResult = unknown>(key: string, ...args: unknown[]): Promise<TResult | undefined> {
        if (inFlight.has(key)) return undefined;
        const handler = actionHandlers.get(key);
        if (!handler) return undefined;
        inFlight.add(key);
        try {
          return await handler(...args) as TResult;
        } finally {
          inFlight.delete(key);
        }
      },
    },

    chain: {
      arg,
      /** Underlying wallet-address accessor (observable in the platform host). */
      get address() {
        return chain.address;
      },
      /** Deployed contract-address observable; a null-observable when unset. */
      get contractAddress() {
        return contractAddressAccessor;
      },
      /**
       * True once the app's contract address is configured for the network —
       * NOT whether a wallet is connected (S7; the deployment-pending gate
       * milestone-escrow hand-derives today). Read-only derived observable.
       */
      get contractReady(): Observable<boolean> {
        return contractReadyObservable;
      },
      async ensureWallet() {
        return chain.ensureWallet();
      },
      /** Current network label (e.g. "testnet"/"mainnet") if the host exposes it. */
      async detectNetwork(): Promise<string> {
        return (await chain.detectNetwork?.()) ?? String(ctx.launchContext?.network ?? "testnet");
      },
      async read<T = unknown>(spec: FrameworkReadSpec<T>): Promise<T> {
        const raw = await chain.read(spec.operation, spec.args, {
          scriptHash: spec.scriptHash,
          cache: spec.cache,
          cacheTtlMs: spec.cacheTtlMs,
        });
        return spec.parse ? spec.parse(raw) : raw as T;
      },
      /**
       * Raw contract read by operation + args, for app-specific parse/guard
       * flows that don't want the {@link FrameworkReadSpec} envelope.
       */
      async readRaw(operation: string, args?: FrameworkContractArg[], options?: unknown): Promise<unknown> {
        return chain.read(operation, args, options);
      },
      /** Raw ARRAY read — for contract methods returning a list stack item. */
      async readArray(operation: string, args?: FrameworkContractArg[], options?: unknown): Promise<unknown[]> {
        return (await chain.readArray?.(operation, args, options)) ?? [];
      },
      /**
       * Raw invoke with NO notify/reload wrapping — for composables that own
       * their own multi-step control flow and error reporting. Use
       * {@link write} instead for simple fire-and-notify writes.
       *
       * S11 central gate: requires the "invoke:primary" manifest permission.
       * Hosts that deliver no manifest permission declaration at all
       * default-allow (see the app.permissions wiring above), so existing
       * standalone/test contexts are unaffected; `async` so a denial rejects
       * instead of throwing synchronously.
       */
      async invoke(
        operation: string,
        args: FrameworkContractArg[],
        options?: FrameworkInvokeOptions,
      ): Promise<FrameworkTxResult> {
        assertNotGuest();
        getPermissions().require("invoke:primary");
        return chain.invoke(operation, args, options);
      },
      /**
       * Raw pay-and-call with NO notify/reload wrapping (see {@link invoke}).
       * S11: a payment-carrying invoke of the primary contract — same
       * "invoke:primary" gate as {@link invoke}; `async` so a denial rejects.
       */
      async invokeWithPayment(
        amount: string,
        memo: string,
        operation: string,
        args: FrameworkContractArg[],
        options?: FrameworkInvokeOptions,
      ): Promise<FrameworkTxResult> {
        assertNotGuest();
        getPermissions().require("invoke:primary");
        return chain.invokeWithPayment(amount, memo, operation, args, options);
      },
      async write(spec: FrameworkWriteSpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> {
        assertNotGuest();
        // S11: write is the fire-and-notify wrapper over chain.invoke — the
        // same "invoke:primary" gate, checked before any notify wrapping so a
        // denial rejects exactly like the raw invoke lane.
        getPermissions().require("invoke:primary");
        return runWithNotify(async () => {
          const tx = await chain.invoke(spec.operation, spec.args, compactInvokeOptions(spec));
          if (tx.success !== false) await spec.reload?.();
          return tx;
        }, spec);
      },
      async events(eventName: string, options?: { limit?: number; offset?: number }): Promise<unknown[]> {
        return chain.listEvents?.(eventName, options) ?? [];
      },
      /** Canonical positional event-state slot decode (utils/chain-events). */
      eventValue: eventStateValue,
      /**
       * Sign an arbitrary message with the connected wallet, normalizing the
       * wallet-specific result shapes (bare signature string vs
       * `{ signature | data, publicKey }` records) into one typed envelope
       * (S7 — neo-sign-anything, neodid-passport).
       */
      async signMessage(message: string): Promise<FrameworkSignedMessage> {
        if (!chain.signMessage) {
          throw new MiniAppError(
            "Wallet does not support message signing",
            "SIGN_UNSUPPORTED",
          );
        }
        const result = await chain.signMessage(message);
        if (typeof result === "string" && result) return { signature: result };
        if (isRecord(result)) {
          const signatureSource = result.signature ?? result.data;
          const signature =
            signatureSource === undefined || signatureSource === null || signatureSource === ""
              ? JSON.stringify(result)
              : String(signatureSource);
          const publicKey = result.publicKey ?? result.publicKeyHash ?? result.pubkey;
          const data = typeof result.data === "string" && result.data ? result.data : undefined;
          const account = result.account ?? result.address;
          return {
            signature,
            ...(publicKey ? { publicKey: String(publicKey) } : {}),
            ...(data ? { data } : {}),
            ...(account ? { account: String(account) } : {}),
          };
        }
        throw new MiniAppError("Wallet returned no signature", "SIGN_EMPTY_RESULT");
      },
      /**
       * Multi-script single-transaction invoke with custom signer scopes
       * (S7 — aa-market-hub's transfer-then-settle with scopes-16
       * allowedContracts). FAULT-state results throw with the VM exception
       * SANITIZED: short assert strings pass through, anything else becomes
       * a generic message so raw VM dumps never reach a toast.
       */
      async invokeMultiple(
        calls: FrameworkInvokeCall[],
        multiOptions: FrameworkMultiInvokeOptions = {},
      ): Promise<FrameworkMultiInvokeResult> {
        assertNotGuest();
        // S11: multi-call transactions broadcast invokes like the single-call
        // lanes — uniform "invoke:primary" gate.
        getPermissions().require("invoke:primary");
        return runWithNotify(async () => {
          if (!chain.invokeMultiple) {
            throw new MiniAppError(
              "Host chain service does not support invokeMultiple",
              "INVOKE_MULTIPLE_UNSUPPORTED",
            );
          }
          const result = await chain.invokeMultiple(
            calls,
            {
              ...(multiOptions.signers ? { signers: multiOptions.signers } : {}),
              ...(multiOptions.onTransactionSent
                ? { onTransactionSent: multiOptions.onTransactionSent }
                : {}),
            },
          );
          if (String(result?.state ?? "").toUpperCase().includes("FAULT")) {
            const exception = result?.exception;
            const sanitized =
              typeof exception === "string" && exception.length < 100
                ? exception
                : "Contract operation failed";
            throw new Error(sanitized);
          }
          return result;
        }, { notify: multiOptions.notify });
      },
      /**
       * Post-broadcast confirmation poll (S7): RPC nodes lag behind a fresh
       * tx, so re-read state until the predicate passes. Verbatim
       * aa-account-lab/aa-session-key-lab semantics: 4 attempts, delay BEFORE
       * each read (4s first, then 5s), per-attempt read errors swallowed.
       * Resolves with the first matching value, or `null` once the attempt
       * budget is exhausted.
       */
      async waitForState<T>(
        read: () => Promise<T>,
        until: (value: T) => boolean,
        waitOptions: FrameworkWaitForStateOptions = {},
      ): Promise<T | null> {
        const attempts = waitOptions.attempts ?? 4;
        const firstDelayMs = waitOptions.firstDelayMs ?? 4000;
        const delayMs = waitOptions.delayMs ?? 5000;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          await new Promise((resolveDelay) =>
            setTimeout(resolveDelay, attempt === 0 ? firstDelayMs : delayMs),
          );
          try {
            const value = await read();
            if (until(value)) return value;
          } catch {
            /* RPC hiccup or node lag — keep retrying within the budget. */
          }
        }
        return null;
      },
      /**
       * Count-then-page enumeration (S7): read the item count (ids assumed
       * 1..count) or take an explicit id list, fetch details under a
       * defensive cap (newest ids win), swallow per-id read/decode failures,
       * and return decoded rows sorted by numeric id — newest first by
       * default. The fan-out ~12 apps hand-roll.
       */
      async enumerate<T>(spec: FrameworkEnumerateSpec<T>): Promise<T[]> {
        const cap = Math.max(1, Math.trunc(spec.cap ?? 500));
        let ids: Array<number | string>;
        if (spec.ids) {
          ids = spec.ids.length > cap
            ? [...spec.ids].slice(spec.ids.length - cap)
            : [...spec.ids];
        } else if (spec.countOp) {
          const rawCount = await chain.read(spec.countOp, spec.countArgs, {
            scriptHash: spec.scriptHash,
          });
          const count = Math.trunc(Number(String(rawCount ?? "0")));
          if (!Number.isFinite(count) || count <= 0) return [];
          const fetchCount = Math.min(count, cap);
          const startId = count - fetchCount + 1;
          ids = Array.from({ length: fetchCount }, (_, index) => startId + index);
        } else {
          return [];
        }
        const rows = await runChunked(ids, 10, async (id) => {
          try {
            const raw = await chain.read(
              spec.detailOp,
              spec.detailArgs ? spec.detailArgs(id) : [arg.integer(id)],
              { scriptHash: spec.scriptHash },
            );
            const item = spec.decode(raw, id);
            return item === null ? null : { id, item };
          } catch {
            return null; // per-id swallow: one bad row never sinks the page
          }
        });
        const decoded: Array<{ id: number | string; item: T }> = [];
        for (const row of rows) {
          if (row !== null) decoded.push({ id: row.id, item: row.item as T });
        }
        const direction = (spec.order ?? "newest") === "newest" ? -1 : 1;
        return decoded
          .sort((left, right) => direction * (Number(left.id) - Number(right.id)))
          .map((row) => row.item);
      },
    },

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

    funds: {
      /**
       * Pay-and-call in one step. When the host settles the payment as a
       * separate confirmed deposit and the consuming call then fails, the
       * error surfaces as {@link FrameworkPrepaidActionError} — the credit is
       * withdrawable, not lost.
       */
      async payAndCall(spec: FrameworkPaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> {
        assertNotGuest();
        // S11: every mutating funds lane is a payment-carrying invoke of the
        // primary contract — uniform "invoke:primary" gate (see app.permissions).
        getPermissions().require("invoke:primary");
        return runWithNotify(async () => {
          let tx: FrameworkTxResult;
          try {
            tx = await chain.invokeWithPayment(
              fixed8Amount(spec),
              spec.memo,
              spec.operation,
              spec.args,
              compactInvokeOptions(spec),
            );
          } catch (error) {
            throw toPrepaidActionError(error);
          }
          if (tx.success !== false) await spec.reload?.();
          return tx;
        }, spec);
      },
      /**
       * Deposit-then-act (S3): transfer GAS to the contract with a memo, wait
       * for the credit to confirm in a block, then run the consuming
       * operation — the lane gasbox reaches via chain.prepayAndInvoke and
       * custom-anchor via waitForDepositConfirmation. When the deposit landed
       * but the consuming call reverted, the error is a
       * {@link FrameworkPrepaidActionError} so apps can show localized
       * recovery copy (the credit is withdrawable). Hosts without a prepay
       * lane — and specs passing `waitForCredit: false` — fall back to the
       * atomic invokeWithPayment bundle. Specs carrying a custom `deposit`
       * lane (asset-token transfers — see {@link FrameworkPrepayDepositLane})
       * run the framework-owned two-step sequence instead.
       */
      async prepayAndCall(spec: FrameworkPrepaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> {
        assertNotGuest();
        // S11: uniform "invoke:primary" gate for mutating funds lanes.
        getPermissions().require("invoke:primary");
        return runWithNotify(async () => {
          if (spec.deposit) return prepayViaDepositLane(spec, spec.deposit);
          const amountFixed8 = fixed8Amount(spec);
          const invokeOptions = compactInvokeOptions(spec);
          let tx: FrameworkTxResult;
          try {
            tx = chain.prepayAndInvoke && spec.waitForCredit !== false
              ? await chain.prepayAndInvoke(
                  amountFixed8,
                  spec.memo,
                  spec.operation,
                  spec.args,
                  invokeOptions,
                )
              : await chain.invokeWithPayment(
                  amountFixed8,
                  spec.memo,
                  spec.operation,
                  spec.args,
                  invokeOptions,
                );
          } catch (error) {
            throw toPrepaidActionError(error);
          }
          if (tx.success !== false) await spec.reload?.();
          return tx;
        }, spec);
      },
      /**
       * Receipt-id deposit lane (S3, mainnet): the GAS was pre-transferred
       * with the deposit memo in a separate settled transaction; the
       * consuming call carries the resulting receipt id as its trailing
       * Integer argument (flashloan deposit, memorial-shrine tribute).
       */
      async receiptPay(spec: FrameworkReceiptPaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> {
        assertNotGuest();
        // S11: uniform "invoke:primary" gate for mutating funds lanes.
        getPermissions().require("invoke:primary");
        return runWithNotify(async () => {
          const receiptId = String(spec.receiptId ?? "").trim();
          if (!/^[1-9]\d*$/.test(receiptId)) {
            throw new MiniAppError(
              "Receipt id must be a positive integer",
              "RECEIPT_ID_INVALID",
            );
          }
          const tx = await chain.invoke(
            spec.operation,
            [...spec.args, arg.integer(receiptId)],
            compactInvokeOptions(spec),
          );
          if (tx.success !== false) await spec.reload?.();
          return tx;
        }, spec);
      },
      async creditOf(playerHash?: string, operation = "creditOf"): Promise<bigint> {
        const account = playerHash || chain.address.get() || await chain.ensureWallet();
        const hash = accountToHash160(account);
        const raw = await chain.read(operation, [{ type: "Hash160", value: hash }]);
        try {
          return BigInt(String(raw ?? "0"));
        } catch {
          return 0n;
        }
      },
      async withdrawCredit(operation = "withdraw", successKey?: string): Promise<FrameworkTxResult> {
        assertNotGuest();
        // S11: gate explicitly (chain.write below re-checks) so a denial
        // rejects BEFORE ensureWallet() can pop a wallet prompt.
        getPermissions().require("invoke:primary");
        const user = accountToHash160(await chain.ensureWallet());
        return framework.chain.write({
          operation,
          args: [{ type: "Hash160", value: user }],
          waitForEvent: "CreditWithdrawn",
          successKey,
        });
      },
    },

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
     * app.oracle — envelope builders + dispatch, extended with the S13
     * dataFeed reader and seal client. The request/dispatch lanes are gated
     * on the "oracle:request" manifest permission (S11, default-allow when
     * no manifest permissions are declared); the dataFeed reader and the
     * seal publicKey/encrypt/store client are wallet-free read/encrypt lanes
     * gated by their own capability config instead (absent deps throw typed
     * FrameworkCapabilityError / FrameworkSealError).
     */
    oracle: {
      async http(request: HttpOracleRequest) {
        assertNotGuest();
        getPermissions().require("oracle:request");
        const url = new URL(request.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          throw new Error("HTTP oracle request must use http(s) URL");
        }
        const method = request.method ?? "GET";
        return createEnvelope("oracle.http.request", {
          url: url.toString(),
          method,
          path: request.path ?? "$",
          ...(method === "POST" && request.body !== undefined ? { body: request.body } : {}),
        });
      },
      async vrf(request: VrfOracleRequest) {
        assertNotGuest();
        getPermissions().require("oracle:request");
        const rounds = Math.max(1, Math.min(64, Math.trunc(Number(request.rounds ?? 1) || 1)));
        return createEnvelope("oracle.vrf.request", {
          consumer: request.consumer,
          salt: request.salt,
          rounds,
          proofMode: request.proofMode ?? (rounds > 1 ? "batch" : "single"),
        });
      },
      async compute(request: ComputeOracleRequest) {
        assertNotGuest();
        getPermissions().require("oracle:request");
        const inputDigest = await sha256Hex0x(stableJson(request.input));
        return createEnvelope("oracle.compute.request", {
          workflow: request.workflow,
          sealed: request.sealed === true,
          inputDigest,
          ...(request.sealed ? {} : { input: request.input }),
        });
      },
      /**
       * Seal lane: the callable keeps the existing envelope-digest builder
       * behavior; the S13 client methods (publicKey/encrypt/store) are
       * attached so `app.oracle.seal.publicKey()` extends — without breaking —
       * `app.oracle.seal(request)`.
       */
      seal: Object.assign(
        async (request: SealOracleRequest) => {
          assertNotGuest();
          getPermissions().require("oracle:request");
          const payloadDigest = await sha256Hex0x(stableJson(request.payload));
          return createEnvelope("oracle.seal.envelope", {
            purpose: request.purpose,
            recipient: request.recipient ?? "",
            payloadDigest,
          });
        },
        {
          /** Oracle X25519 public key (TTL cache + stale fallback). */
          publicKey: (sealOptions?: { forceRefresh?: boolean }) =>
            getOracleExt().seal.publicKey(sealOptions),
          /** Encrypt a payload under the pinned envelope algorithm. */
          encrypt: (payload: unknown) => getOracleExt().seal.encrypt(payload),
          /**
           * Submit a sealed envelope to the confidential store. Unlike the
           * wallet-free publicKey/encrypt read/compute lanes, `store` WRITES
           * to the oracle's confidential store, so it is guest-guarded like
           * every other oracle write entry point.
           */
          store: async (input: FrameworkSealStoreInput) => {
            assertNotGuest();
            return getOracleExt().seal.store(input);
          },
        },
      ),
      /** DataFeed reader (S13): wallet-free price reads + freshness math. */
      get dataFeed() {
        return getOracleExt().dataFeed;
      },
      async dispatch(
        envelope: OracleEnvelope,
        spec: Omit<FrameworkWriteSpec & FrameworkInvokeOptions, "args"> & { args?: FrameworkContractArg[] },
      ) {
        assertNotGuest();
        getPermissions().require("oracle:request");
        return framework.chain.write({
          ...spec,
          args: [
            ...(spec.args ?? []),
            { type: "String", value: JSON.stringify(envelope.payload) },
          ],
        });
      },
    },

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
          if (modeObservable.get() === "guest") {
            await guestLeaderboard.submit(score);
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

    game: {
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
        const chainAdapter = rewardChain();
        return {
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
            return startRewardGame(config, chainAdapter, difficulty, storage);
          },
          openSession(gameId: string, difficulty: number) {
            assertNotGuest();
            return openRewardGameSession(config, chainAdapter, gameId, difficulty, rewardOptions.fetcher);
          },
          recordOp(session: RewardGameSession, op: Op) {
            assertNotGuest();
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
            return replayRewardGameOps(session, ops, onStep, rewardOptions.fetcher);
          },
          finalize(
            session: RewardGameSession,
            finalizeOptions?: FrameworkRewardGameFinalizeOptions,
          ) {
            assertNotGuest();
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
            return expireRewardGame(config, chainAdapter, gameId, storage);
          },
          withdrawCredit(creditFixed8?: bigint | number | string) {
            assertNotGuest();
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
        };
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
            const events = await chain.listEvents?.(eventName, { limit }) ?? [];
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
    },
  };

  return framework;
}

export type MiniAppFramework = ReturnType<typeof createMiniAppFramework>;

// ───────────────────────────────────────────────────────────────────────────
// Wave-1 standalone module surface (plan §2) — factories, types and
// identity-stable error classes re-exported from the framework entry so apps
// (and the apps/shared compatibility shims) resolve a single copy of each.
// ───────────────────────────────────────────────────────────────────────────

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

// S5 app.wallet
export { createWalletSurface } from "./wallet";
export type {
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

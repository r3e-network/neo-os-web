import { createObservable, type Observable } from "./reactive";
import { singleFlight } from "./utils/async-utils";
import { eventStateValue } from "./utils/chain-events";
import { MiniAppError } from "./utils/errors";
import { sha256Hex0x } from "./utils/hash";
import { addressToScriptHash } from "./utils/neo";
import { localStorageAvailable } from "./utils/safe-storage";
import { extractTxid } from "./utils/transaction";
import { createAmountSurface, gasFixed8Amount } from "./amounts-surface";
import { createQueryResult } from "./chain-query";
import type { FrameworkQueryResult, FrameworkReadOptions } from "./chain-query";
import { createErrorsSurface } from "./errors-surface";
import { createFmtSurface } from "./fmt-surface";
import { createGameRules } from "./game-rules";
import { guardedWrite } from "./internal/guards";
import type { FrameworkWritePolicy } from "./internal/guards";
import { createModeModule } from "./mode";
import { createNotifyModule } from "./notify-surface";
import { createStorageSurface } from "./storage-surface";
import type {
  AchievementDefinition,
  ComputeOracleRequest,
  FrameworkActionOptions,
  FrameworkAppMode,
  FrameworkAssetSymbol,
  FrameworkContractArg,
  FrameworkDepositSettlement,
  FrameworkEnumerateSpec,
  FrameworkGuestLeaderboard,
  FrameworkHost,
  FrameworkInvokeCall,
  FrameworkInvokeOptions,
  FrameworkModeSurface,
  FrameworkMultiInvokeOptions,
  FrameworkMultiInvokeResult,
  FrameworkNotifyPolicy,
  FrameworkOperationRunOptions,
  FrameworkOperationState,
  FrameworkPaySpec,
  FrameworkPrepayDepositLane,
  FrameworkPrepaySpec,
  FrameworkReadSpec,
  FrameworkReceiptPaySpec,
  FrameworkRewardGameConfig,
  FrameworkRewardGameFinalizeOptions,
  FrameworkRewardGameOptions,
  FrameworkRewardGameSettlementOptions,
  FrameworkRewardGameSurface,
  FrameworkSignedMessage,
  FrameworkSuccessParams,
  FrameworkTxResult,
  FrameworkWaitForStateOptions,
  FrameworkWriteSpec,
  HttpOracleRequest,
  MiniAppFramework,
  MiniAppFrameworkContext,
  MiniAppFrameworkOptions,
  OracleEnvelope,
  SealOracleRequest,
  VrfOracleRequest,
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
  createRewardRunner,
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
  rewardGameEvents,
  rewardGameModeOf,
  rewardGameProgressionOf,
  startRewardGame,
  withdrawRewardCredit,
} from "./gamefi";
import type {
  FrameworkRewardRunner,
  FrameworkRewardRunnerHooks,
  RewardGameConfig,
  RewardGameSession,
  RewardGameStorage,
} from "./gamefi";
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

// ───────────────────────────────────────────────────────────────────────────
// App-facing types + the explicit MiniAppFramework interface live in ./types
// (RFC P0-1) and are re-exported here so every existing import path keeps
// resolving — zero import breaks fleet-wide.
// ───────────────────────────────────────────────────────────────────────────
export * from "./types";

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

/** Named write-lane policies (RFC P0-2) — see internal/guards.ts. */
const WRITE_PRIMARY: FrameworkWritePolicy = { permission: "invoke:primary" };
const ORACLE_REQUEST: FrameworkWritePolicy = { permission: "oracle:request" };
/**
 * Documented exemption: guest-guarded write with deliberately NO S11 gate
 * (oracle.seal.store — the confidential-store write predates a permission).
 */
const GUEST_GUARD_ONLY: FrameworkWritePolicy = { permission: null };
/**
 * app.aa write lanes (relay / sponsorship.request / sessionKey.create): the
 * "aa" S11 permission, registered DEFAULT-ALLOW (see app.permissions wiring)
 * so no app behavior changes — the gate now exists and manifests can opt out
 * with `{ aa: false }`.
 */
const AA_WRITE: FrameworkWritePolicy = { permission: "aa" };

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
   * "invoke:primary", and the oracle request/dispatch lane requires
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

  // app.amount — extracted module (RFC P0-1 §2 step 9).
  const amount = createAmountSurface();

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
    detectNetwork: async () => chain.detectNetwork?.() ?? String(ctx.launchContext?.network ?? "testnet"),
    read: (operation: string, args?: FrameworkContractArg[]) => chain.read(operation, args),
    invoke: async (
      operation: string,
      args: FrameworkContractArg[],
      invokeOptions?: FrameworkInvokeOptions,
    ) => {
      assertNotGuest();
      getPermissions().require("invoke:primary");
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
      getPermissions().require("invoke:primary");
      return chain.invokeWithPayment(paymentAmount, memo, operation, args, invokeOptions);
    },
    ...(chain.listEvents
      ? {
          listEvents: (eventName: string, options?: { limit?: number; offset?: number }) =>
            chain.listEvents?.(eventName, options) ?? Promise.resolve([]),
        }
      : {}),
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
      /**
       * Typed read via a spec object.
       * @deprecated Use {@link query} — `chain.query(op, args).as(parse)` is
       * the chainable successor (the spec-object form found no adopters).
       */
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
       * Prefer {@link query} for typed decodes (`readRaw` ≡ `query(...).raw()`).
       */
      async readRaw(
        operation: string,
        args?: FrameworkContractArg[],
        options?: FrameworkReadOptions,
      ): Promise<unknown> {
        return chain.read(operation, args, options);
      },
      /** Raw ARRAY read — for contract methods returning a list stack item. */
      async readArray(
        operation: string,
        args?: FrameworkContractArg[],
        options?: FrameworkReadOptions,
      ): Promise<unknown[]> {
        return (await chain.readArray?.(operation, args, options)) ?? [];
      },
      /**
       * Chainable typed read (RFC P0-6): one RPC read, decoded via
       * `asInt`/`asBigInt`/`asString`/`asBool`/`asAddress`/`asArray`/`asMap`/
       * `as(parse)` — see {@link FrameworkQueryResult} for the coercion
       * contract. Read lane: NOT guest-guarded, NOT permission-gated.
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
      ): FrameworkQueryResult {
        return createQueryResult(() => chain.read(operation, args, options));
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
      invoke: guardedWrite(
        guardDeps,
        WRITE_PRIMARY,
        async (
          operation: string,
          args: FrameworkContractArg[],
          options?: FrameworkInvokeOptions,
        ): Promise<FrameworkTxResult> => chain.invoke(operation, args, options),
      ),
      /**
       * Raw pay-and-call with NO notify/reload wrapping (see {@link invoke}).
       * S11: a payment-carrying invoke of the primary contract — same
       * "invoke:primary" gate as {@link invoke}; denials reject.
       */
      invokeWithPayment: guardedWrite(
        guardDeps,
        WRITE_PRIMARY,
        async (
          amount: string,
          memo: string,
          operation: string,
          args: FrameworkContractArg[],
          options?: FrameworkInvokeOptions,
        ): Promise<FrameworkTxResult> =>
          chain.invokeWithPayment(amount, memo, operation, args, options),
      ),
      // S11: write is the fire-and-notify wrapper over chain.invoke — the
      // same "invoke:primary" gate, composed BEFORE the notify wrapping so a
      // denial rejects exactly like the raw invoke lane (RFC P0-2 ordering:
      // guest guard → permission gate → notify wrap → reload-on-success).
      write: guardedWrite(
        guardDeps,
        WRITE_PRIMARY,
        async (spec: FrameworkWriteSpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> =>
          runWithNotify(async () => {
            const tx = await chain.invoke(spec.operation, spec.args, compactInvokeOptions(spec));
            if (tx.success !== false) await spec.reload?.();
            return tx;
          }, spec),
      ),
      /**
       * Raw event page.
       * @deprecated Alias of `app.events.list` — one concept, one home (S4).
       */
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
      // S11: multi-call transactions broadcast invokes like the single-call
      // lanes — uniform "invoke:primary" gate (composed via guardedWrite).
      invokeMultiple: guardedWrite(
        guardDeps,
        WRITE_PRIMARY,
        async (
          calls: FrameworkInvokeCall[],
          multiOptions: FrameworkMultiInvokeOptions = {},
        ): Promise<FrameworkMultiInvokeResult> =>
          runWithNotify(async () => {
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
        }, { notify: multiOptions.notify }),
      ),
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
       * @deprecated 0 fleet consumers — use {@link query} with an explicit
       * loop (or `readArray`) instead; kept for back-compat.
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
      // S11: every mutating funds lane is a payment-carrying invoke of the
      // primary contract — uniform "invoke:primary" gate (see app.permissions).
      payAndCall: guardedWrite(
        guardDeps,
        WRITE_PRIMARY,
        async (spec: FrameworkPaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> =>
          runWithNotify(async () => {
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
        }, spec),
      ),
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
      // S11: uniform "invoke:primary" gate for mutating funds lanes.
      prepayAndCall: guardedWrite(
        guardDeps,
        WRITE_PRIMARY,
        async (spec: FrameworkPrepaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> =>
          runWithNotify(async () => {
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
        }, spec),
      ),
      /**
       * Receipt-id deposit lane (S3, mainnet): the GAS was pre-transferred
       * with the deposit memo in a separate settled transaction; the
       * consuming call carries the resulting receipt id as its trailing
       * Integer argument (flashloan deposit, memorial-shrine tribute).
       */
      // S11: uniform "invoke:primary" gate for mutating funds lanes.
      receiptPay: guardedWrite(
        guardDeps,
        WRITE_PRIMARY,
        async (spec: FrameworkReceiptPaySpec & FrameworkInvokeOptions): Promise<FrameworkTxResult> =>
          runWithNotify(async () => {
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
          }, spec),
      ),
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
      // S11: gate explicitly (chain.write inside re-checks) so a denial
      // rejects BEFORE ensureWallet() can pop a wallet prompt.
      withdrawCredit: guardedWrite(
        guardDeps,
        WRITE_PRIMARY,
        async (operation = "withdraw", successKey?: string): Promise<FrameworkTxResult> => {
          const user = accountToHash160(await chain.ensureWallet());
          return framework.chain.write({
            operation,
            args: [{ type: "Hash160", value: user }],
            waitForEvent: "CreditWithdrawn",
            successKey,
          });
        },
      ),
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
     * app.credits (Credits v2) — platform credits: on-chain GAS buys,
     * instant DB-first spends, stale-flagged chain-checkpoint fallback reads.
     */
    get credits() {
      return getCredits();
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
      http: guardedWrite(guardDeps, ORACLE_REQUEST, async (request: HttpOracleRequest) => {
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
      }),
      vrf: guardedWrite(guardDeps, ORACLE_REQUEST, async (request: VrfOracleRequest) => {
        const rounds = Math.max(1, Math.min(64, Math.trunc(Number(request.rounds ?? 1) || 1)));
        return createEnvelope("oracle.vrf.request", {
          consumer: request.consumer,
          salt: request.salt,
          rounds,
          proofMode: request.proofMode ?? (rounds > 1 ? "batch" : "single"),
        });
      }),
      compute: guardedWrite(guardDeps, ORACLE_REQUEST, async (request: ComputeOracleRequest) => {
        const inputDigest = await sha256Hex0x(stableJson(request.input));
        return createEnvelope("oracle.compute.request", {
          workflow: request.workflow,
          sealed: request.sealed === true,
          inputDigest,
          ...(request.sealed ? {} : { input: request.input }),
        });
      }),
      /**
       * Seal lane: the callable keeps the existing envelope-digest builder
       * behavior; the S13 client methods (publicKey/encrypt/store) are
       * attached so `app.oracle.seal.publicKey()` extends — without breaking —
       * `app.oracle.seal(request)`.
       */
      seal: Object.assign(
        guardedWrite(guardDeps, ORACLE_REQUEST, async (request: SealOracleRequest) => {
          const payloadDigest = await sha256Hex0x(stableJson(request.payload));
          return createEnvelope("oracle.seal.envelope", {
            purpose: request.purpose,
            recipient: request.recipient ?? "",
            payloadDigest,
          });
        }),
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
           * every other oracle write entry point — a DOCUMENTED exemption
           * from the "oracle:request" gate (named GUEST_GUARD_ONLY policy).
           */
          store: guardedWrite(guardDeps, GUEST_GUARD_ONLY, async (input: FrameworkSealStoreInput) =>
            getOracleExt().seal.store(input),
          ),
        },
      ),
      /** DataFeed reader (S13): wallet-free price reads + freshness math. */
      get dataFeed() {
        return getOracleExt().dataFeed;
      },
      dispatch: guardedWrite(
        guardDeps,
        ORACLE_REQUEST,
        async (
          envelope: OracleEnvelope,
          spec: Omit<FrameworkWriteSpec & FrameworkInvokeOptions, "args"> & {
            args?: FrameworkContractArg[];
          },
        ) =>
          framework.chain.write({
            ...spec,
            args: [
              ...(spec.args ?? []),
              { type: "String", value: JSON.stringify(envelope.payload) },
            ],
          }),
      ),
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

    game: {
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
        const chainAdapter = rewardChain();
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
            getPermissions().require("invoke:primary");
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
            // S11 pre-gate: deny before the TEE seal round-trip — the sealed
            // op-log is useless when the finalize broadcast would be denied.
            getPermissions().require("invoke:primary");
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
            getPermissions().require("invoke:primary");
            return expireRewardGame(config, chainAdapter, gameId, storage);
          },
          withdrawCredit(creditFixed8?: bigint | number | string) {
            assertNotGuest();
            // S11 pre-gate: deny BEFORE the SDK's ensureWallet wallet prompt.
            getPermissions().require("invoke:primary");
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
                loadStats: () => framework.game.stats.load(),
                loadLeaderboard: async () => {
                  const { ranked } = await framework.game.leaderboard.load(
                    rewardGameEvents(config).solved,
                  );
                  return ranked.map((entry) => ({
                    user: entry.address,
                    score: String(entry.totalWon),
                  }));
                },
                onAccountChanged: (handler) => framework.wallet.onAccountChanged(handler),
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

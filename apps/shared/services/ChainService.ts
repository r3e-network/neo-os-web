/**
 * ChainService - Clean contract interaction API for miniapps.
 *
 * Wraps the existing useContractInteraction composable with a class-based
 * API that integrates caching and event bus notifications. This is the
 * primary interface miniapps use for all on-chain reads and writes.
 *
 * @example
 * ```ts
 * const chain = services.chain;
 *
 * // Cached read
 * const totalBurned = await chain.readCached("TotalBurned", [], 30_000);
 *
 * // Write with automatic event bus notification
 * const result = await chain.invoke("burnGas", [
 *   { type: "Hash160", value: chain.address.get() },
 *   { type: "Integer", value: "100000000" },
 * ]);
 * ```
 */

import { createDerived, withValueCompat } from "../react/context";
import type { Observable, RefCompatObservable } from "../react/context";
import {
  useContractInteraction,
  waitForDepositConfirmation,
  DepositConfirmedActionFailedError,
} from "../composables/useContractInteraction";
import type { CacheService } from "./CacheService";
import { EventBus } from "./EventBus";
import { useEvents, useWallet } from "../utils/wallet-sdk";
import type { EventsListParams, InvokeParams } from "../utils/wallet-sdk";
import type { WalletSDK } from "../utils/wallet-sdk";
import { useAllEvents } from "../composables/useAllEvents";
import {
  BLOCKCHAIN_CONSTANTS,
  TIME_CONSTANTS,
  resolveNeoNetwork,
} from "../constants";
import {
  detectEvmNetwork,
  connectEvm,
  ensureNeoXNetwork,
  evmInvoke,
  isEvmNetwork as isEvmNetworkId,
} from "../utils/evm-chain";
import type { EvmNetwork, EvmCall } from "../utils/evm-chain";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Emitted instead of EventBus.TRANSACTION_CONFIRMED when an event wait timed
 * out: the transaction was broadcast but its confirming event was never
 * observed, so "confirmed" would be dishonest. Payload:
 * { txid: string, operation: string }. Lives here (with its only emitter)
 * because EventBus is a generic pub/sub.
 */
export const TRANSACTION_UNVERIFIED = "platform:tx:unverified";

/**
 * Default wait for a transaction's confirming event: ~2 Neo N3 blocks
 * (~15s each) plus indexer lag. TIME_CONSTANTS.DEFAULT_TIMEOUT_MS (10s) is
 * shorter than a single block, so it stays reserved for generic async ops.
 */
const EVENT_WAIT_TIMEOUT_MS = 45_000;

export interface ContractArg {
  type: "String" | "Integer" | "Boolean" | "Hash160" | "Hash256" | "PublicKey" | "ByteArray" | "Array";
  value: string | number | boolean;
}

export interface ReadOptions {
  /** Override the default contract script hash. */
  scriptHash?: string;
  /** Whether to check the memory cache first. Default: false. */
  cache?: boolean;
  /** TTL for cached results in milliseconds. Default: 30 000. */
  cacheTtlMs?: number;
}

export interface InvokeOptions {
  /** Override the default contract script hash. */
  scriptHash?: string;
  /** Custom signers for the transaction. */
  signers?: WalletSigner[];
  /** If set, wait for this event name after the transaction confirms. */
  waitForEvent?: string;
  /** Timeout for event waiting. Default: 45 000ms (~2 blocks + indexer lag). */
  waitTimeoutMs?: number;
  /**
   * Optional callback fired the moment the prepaid GAS transfer is broadcast,
   * before the settle wait and the target contract call. Receives the transfer
   * txid ("" if unavailable). Only used by {@link invokeWithPayment}; lets
   * callers tell a pre-transfer failure (nothing moved) apart from a
   * post-broadcast failure (funds in flight). Additive — safe to omit.
   */
  onPaymentSent?: (txid: string) => void;
}

export interface TxResult {
  txid: string;
  event?: unknown;
  /**
   * Whether the transaction was broadcast. A relayed tx (non-empty txid) is
   * `true` even when its confirming event was never observed — broadcasting
   * succeeded. Use {@link TxResult.verified} to tell a confirmed tx from a
   * relayed-but-unconfirmed one.
   */
  success: boolean;
  /**
   * Whether the outcome is CONFIRMED on-chain. When a `waitForEvent` was
   * requested, this is `true` only if that event was actually observed (so a
   * timeout/FAULT yields `success: true, verified: false` — broadcast, not
   * confirmed). When no event wait was requested there is nothing to confirm,
   * so it defaults to `true`.
   *
   * Optional only for backward compatibility: every {@link ChainService}
   * invoke path sets it, so it is always a real boolean at runtime. The type
   * stays optional so existing `TxResult`-typed stubs/callers that predate the
   * field keep compiling — a reader that wants the confirmed/unconfirmed
   * distinction treats an absent value as "unverified" (`verified !== true`).
   */
  verified?: boolean;
}

export type SignedMessageResult = string | { publicKey?: string; data?: string } | null;

/** One call of a multi-invoke batch (single transaction, multiple scripts). */
export interface MultiInvokeCall {
  /** Target contract; defaults to the app's configured contract when omitted. */
  scriptHash?: string;
  operation: string;
  args: ContractArg[];
}

/**
 * Result of {@link ChainService.invokeMultiple}. `state`/`exception` carry the
 * wallet-reported VM outcome through untouched so the framework surface
 * (app.chain.invokeMultiple) can apply its FAULT-state sanitization.
 */
export interface MultiInvokeResult extends TxResult {
  state?: string;
  exception?: string;
}

export interface EventListOptions {
  limit?: number;
  offset?: number;
}

interface WalletSigner {
  account: string;
  scopes: string | number;
  allowedContracts?: string[];
  allowedGroups?: string[];
  rules?: unknown[];
}

// Re-exported from the shared context module so existing
// `import { withValueCompat, RefCompatObservable } from ".../ChainService"`
// call sites keep working after the definition was hoisted to react/context.
export { withValueCompat };
export type { RefCompatObservable };

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

export class ChainService {
  private interaction: ReturnType<typeof useContractInteraction>;
  private wallet: WalletSDK;
  private cache: CacheService;
  private events: EventBus;
  private appId: string;
  private t: (key: string) => string;
  private listEventsComposable: ReturnType<typeof useEvents>;
  private allEvents: ReturnType<typeof useAllEvents>;

  /** Whether a wallet is currently connected. Created once in constructor. */
  readonly isConnected: Observable<boolean>;

  /** Wrapped Observable for the underlying wallet address ref. */
  private addressObservable: RefCompatObservable<string | null>;
  /** Wrapped Observable for the underlying contract address ref. */
  private contractAddressObservable: RefCompatObservable<string | null>;
  /** Wrapped Observable for the underlying processing state ref. */
  private isProcessingObservable: RefCompatObservable<boolean>;

  constructor(
    appId: string,
    t: (key: string) => string,
    cache: CacheService,
    events: EventBus,
  ) {
    this.appId = appId;
    this.t = t;
    this.cache = cache;
    this.events = events;

    this.wallet = useWallet() as WalletSDK;
    this.interaction = useContractInteraction({ appId, t });
    this.listEventsComposable = useEvents();
    this.allEvents = useAllEvents(this.listEventsComposable.list, appId);

    // Wrap observables with .value compat once in the constructor
    this.addressObservable = withValueCompat(this.interaction.address);
    this.contractAddressObservable = withValueCompat(this.interaction.contractAddress);
    this.isProcessingObservable = withValueCompat(this.interaction.isProcessing);

    // Derived observable: true when a wallet address is present
    this.isConnected = createDerived(
      () => Boolean(this.addressObservable.get()),
      [this.addressObservable],
    );
  }

  // -- Wallet management ----------------------------------------------------

  /** Reactive wallet address observable. Also supports `.value` for backward compat. */
  get address(): RefCompatObservable<string | null> {
    return this.addressObservable;
  }

  /**
   * Ensure a wallet is connected, prompting connection if needed.
   * Emits WALLET_CONNECTED on success.
   */
  async ensureWallet(): Promise<string> {
    const wasConnected = Boolean(this.addressObservable.get());
    const addr = await this.interaction.ensureWallet();
    if (!wasConnected && addr) {
      this.events.emit(EventBus.WALLET_CONNECTED, { address: addr });
    }
    return addr;
  }

  // -- Multi-chain (Neo N3 + Neo X) -----------------------------------------

  /**
   * Detect the active chain network from the connected wallet. Returns a Neo X
   * EVM network id ("neo-x-mainnet"/"neo-x-testnet") when an injected EVM wallet
   * is on a supported Neo X chain, otherwise the Neo N3 chain type
   * ("neo-n3-mainnet"/"neo-n3-testnet"/"neo-n3"). Read-only — never prompts.
   *
   * Miniapps that support multiple chains branch on this (see
   * {@link isEvmNetwork}); single-chain apps can ignore it and keep using the
   * Neo N3 methods unchanged.
   */
  async detectNetwork(): Promise<string> {
    const evm = await detectEvmNetwork();
    if (evm) return evm;
    const ct = (this.wallet as unknown as { chainType?: { get?: () => string; value?: string } }).chainType;
    const raw = typeof ct?.get === "function" ? ct.get() : ct?.value;
    return typeof raw === "string" && raw ? raw : "neo-n3";
  }

  /** Whether a network id is a Neo X (EVM) network. */
  isEvmNetwork(network: string): boolean {
    return isEvmNetworkId(network);
  }

  /**
   * Connect an EVM wallet (MetaMask / injected) on the given Neo X network,
   * switching/adding the chain if needed. Returns the checksummed address.
   * Emits WALLET_CONNECTED. The Neo N3 {@link ensureWallet} path is separate.
   */
  async ensureEvmWallet(network: EvmNetwork): Promise<string> {
    await ensureNeoXNetwork(network);
    const addr = await connectEvm();
    this.events.emit(EventBus.WALLET_CONNECTED, { address: addr });
    return addr;
  }

  /**
   * Payable EVM contract invocation (the Neo X analogue of
   * {@link invokeWithPayment}): sends `valueWei` native GAS with the call and
   * optionally extracts an event id from the receipt. Emits TRANSACTION_SENT /
   * TRANSACTION_CONFIRMED.
   */
  async invokeEvmWithValue(call: EvmCall): Promise<TxResult> {
    return this.withProcessing(async () => {
      const { txid, eventId } = await evmInvoke(call);
      this.events.emit(EventBus.TRANSACTION_SENT, { txid, operation: call.selector });
      const event = eventId ? { id: eventId } : undefined;
      if (event) this.events.emit(EventBus.TRANSACTION_CONFIRMED, { txid, event });
      // No waitForEvent in the EVM path (the event id, if any, comes from the
      // receipt synchronously), so there is nothing to confirm separately —
      // verified defaults to true, matching the Neo N3 no-wait case.
      return { txid, event, success: Boolean(txid), verified: true };
    });
  }

  // -- Contract address -----------------------------------------------------

  /** Reactive contract address observable. Also supports `.value` for backward compat. */
  get contractAddress(): RefCompatObservable<string | null> {
    return this.contractAddressObservable;
  }

  // -- Processing state -----------------------------------------------------

  /** Whether a write operation is currently in flight. */
  get isProcessing(): RefCompatObservable<boolean> {
    return this.isProcessingObservable;
  }

  /** Re-entrancy depth for nested write paths (e.g. prepayAndInvoke → invoke). */
  private processingDepth = 0;

  /**
   * Toggle {@link isProcessing} around a write operation. try/finally
   * guarantees the flag resets even when the write throws; the depth counter
   * keeps it true across nested writes (prepayAndInvoke issues two invokes)
   * instead of flickering false between steps.
   */
  private async withProcessing<T>(fn: () => Promise<T>): Promise<T> {
    this.processingDepth += 1;
    this.isProcessingObservable.set(true);
    try {
      return await fn();
    } finally {
      this.processingDepth -= 1;
      if (this.processingDepth === 0) {
        this.isProcessingObservable.set(false);
      }
    }
  }

  /**
   * Sign an arbitrary message with the connected wallet.
   * This keeps wallet-level signing inside the shared chain layer rather than
   * forcing miniapps to talk to the wallet SDK directly.
   */
  async signMessage(message: string): Promise<SignedMessageResult> {
    if (!message) return null;

    await this.ensureWallet();

    if (!this.wallet.signMessage) {
      throw new Error(this.t("signNotSupported"));
    }

    return this.wallet.signMessage(message);
  }

  // -- Read operations ------------------------------------------------------

  /**
   * Execute a read-only contract call. Optionally checks the cache first.
   */
  async read(operation: string, args?: ContractArg[], options?: ReadOptions): Promise<unknown> {
    const cacheKey = options?.cache
      ? this.buildCacheKey("read", operation, args, options?.scriptHash)
      : null;
    if (cacheKey && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = await this.interaction.read(
      operation,
      args as { type: string; value: string | number | boolean }[],
      options?.scriptHash,
    );

    if (cacheKey) {
      this.cache.set(cacheKey, result, options?.cacheTtlMs ?? 30_000);
    }

    return result;
  }

  /**
   * Read-only call that returns an array of parsed stack items.
   */
  async readArray(operation: string, args?: ContractArg[], options?: ReadOptions): Promise<unknown[]> {
    const cacheKey = options?.cache
      ? this.buildCacheKey("readArray", operation, args, options?.scriptHash)
      : null;
    if (cacheKey && this.cache.has(cacheKey)) {
      return this.cache.get<unknown[]>(cacheKey) ?? [];
    }

    const result = await this.interaction.readArray(
      operation,
      args as { type: string; value: string | number | boolean }[],
      options?.scriptHash,
    );

    if (cacheKey) {
      this.cache.set(cacheKey, result, options?.cacheTtlMs ?? 30_000);
    }

    return result;
  }

  /**
   * Convenience: read with caching enabled by default.
   */
  async readCached(operation: string, args?: ContractArg[], ttlMs: number = 30_000): Promise<unknown> {
    return this.read(operation, args, { cache: true, cacheTtlMs: ttlMs });
  }

  // -- Write operations -----------------------------------------------------

  /**
   * Direct contract invocation (no payment flow).
   * Use for operations that don't require a GAS payment (e.g. settle, claim).
   * Emits TRANSACTION_SENT and optionally waits for an on-chain event.
   */
  async invoke(operation: string, args: ContractArg[], options?: InvokeOptions): Promise<TxResult> {
    return this.withProcessing(async () => {
      const { txid } = await this.interaction.invokeDirectly(
        operation,
        args as { type: string; value: string | number | boolean }[],
        options?.scriptHash,
        options?.signers,
      );

      this.events.emit(EventBus.TRANSACTION_SENT, { txid, operation });

      let event: unknown;
      if (options?.waitForEvent && txid) {
        // The tx is already broadcast: an events-API outage must not convert a
        // successful invoke into a rejection. Treat wait failures exactly like
        // the timeout path (event = null → verified: false).
        try {
          event = await this.waitForEvent(txid, options.waitForEvent, options.waitTimeoutMs);
        } catch {
          event = null;
        }
        this.emitEventWaitOutcome(txid, operation, event);
      }

      // verified === false marks a relayed-but-unconfirmed tx: a waitForEvent was
      // requested but its event never landed (timeout/FAULT). success stays true
      // (the broadcast happened) so existing callers are unaffected.
      const verified = options?.waitForEvent ? Boolean(event) : true;
      return { txid, event, success: Boolean(txid), verified };
    });
  }

  /**
   * Multi-script single-transaction invoke with caller-provided signer scopes
   * — the host lane behind `app.chain.invokeMultiple` (framework S7;
   * aa-market-hub's transfer-then-settle batch). The wallet submits every
   * call in ONE transaction, so a custom signer (e.g. scopes-16 with
   * `allowedContracts`) can witness all of them. The wallet result's
   * `state`/`exception` pass through untouched — FAULT sanitization is owned
   * by the framework surface, keeping this lane byte-compatible with the raw
   * `wallet.invokeMultiple` result apps consumed before.
   *
   * Emits TRANSACTION_SENT with the batch's final operation (the consuming
   * business call of a transfer-then-act pair).
   */
  async invokeMultiple(
    calls: MultiInvokeCall[],
    options?: { signers?: WalletSigner[] },
  ): Promise<MultiInvokeResult> {
    return this.withProcessing(async () => {
      const invokeArgs: InvokeParams[] = [];
      for (const call of calls) {
        invokeArgs.push({
          scriptHash:
            call.scriptHash ?? (await this.interaction.ensureContractAddress()),
          operation: call.operation,
          args: call.args,
        });
      }

      const result = await this.wallet.invokeMultiple({
        invokeArgs,
        ...(options?.signers?.length ? { signers: options.signers } : {}),
      });

      const txid = String(result?.txid ?? "");
      this.events.emit(EventBus.TRANSACTION_SENT, {
        txid,
        operation: invokeArgs[invokeArgs.length - 1]?.operation ?? "",
      });

      // No event wait on the batch lane — nothing to confirm separately, so
      // verified defaults to true, matching the no-wait invoke() case.
      return {
        txid,
        success: Boolean(txid),
        verified: true,
        ...(typeof result?.state === "string" ? { state: result.state } : {}),
        ...(typeof result?.exception === "string"
          ? { exception: result.exception }
          : {}),
      };
    });
  }

  /**
   * Direct-prepaid GAS payment + contract invocation.
   * The most common pattern for miniapps:
   * 1. Transfer GAS to the contract with a memo
   * 2. Wait for the credit to settle
   * 3. Call the target contract method
   *
   * Emits TRANSACTION_SENT and TRANSACTION_CONFIRMED events.
   */
  async invokeWithPayment(
    amount: string,
    memo: string,
    operation: string,
    args: ContractArg[],
    options?: InvokeOptions,
  ): Promise<TxResult> {
    return this.withProcessing(async () => {
      const { txid } = await this.interaction.invokeWithDirectPrepaidGas(
        amount,
        memo,
        operation,
        args as { type: string; value: string | number | boolean }[],
        options?.scriptHash,
        undefined,
        options?.signers,
        options?.onPaymentSent,
      );

      this.events.emit(EventBus.TRANSACTION_SENT, { txid, operation });

      let event: unknown;
      if (options?.waitForEvent && txid) {
        // The tx is already broadcast: an events-API outage must not convert a
        // successful invoke into a rejection. Treat wait failures exactly like
        // the timeout path (event = null → verified: false).
        try {
          event = await this.waitForEvent(txid, options.waitForEvent, options.waitTimeoutMs);
        } catch {
          event = null;
        }
        this.emitEventWaitOutcome(txid, operation, event);
      }

      // See {@link invoke}: verified distinguishes a confirmed tx from a
      // relayed-but-unconfirmed one without disturbing success.
      const verified = options?.waitForEvent ? Boolean(event) : true;
      return { txid, event, success: Boolean(txid), verified };
    });
  }

  // -- Event watching -------------------------------------------------------

  /**
   * Poll for a specific event matching a transaction ID.
   * Returns the event payload or null on timeout.
   */
  async waitForEvent(txid: string, eventName: string, timeoutMs?: number): Promise<unknown> {
    const timeout = timeoutMs ?? EVENT_WAIT_TIMEOUT_MS;
    const result = await this.listEventsComposable.waitForEvent(
      txid,
      eventName,
      this.appId,
      timeout,
    );
    return result ?? null;
  }

  /**
   * List recent events by name with optional pagination.
   */
  async listEvents(eventName: string, options?: EventListOptions): Promise<unknown[]> {
    const params: EventsListParams = {
      app_id: this.appId,
      event_name: eventName,
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    };
    const result = await this.listEventsComposable.list(params);
    return result.events || [];
  }

  /**
   * Fetch all events by name across all pages.
   */
  async listAllEvents(eventName: string): Promise<unknown[]> {
    return this.allEvents.listAllEvents(eventName);
  }

  // -- Convenience methods --------------------------------------------------

  /**
   * Read a contract method and parse the result with a transform function.
   *
   * @example
   * ```ts
   * const balance = await chain.readParsed(
   *   "getBalance",
   *   [{ type: "Hash160", value: addr }],
   *   (raw) => fromFixed8(Number(raw)),
   * );
   * ```
   */
  async readParsed<T>(
    operation: string,
    args: ContractArg[] | undefined,
    transform: (raw: unknown) => T,
    options?: ReadOptions,
  ): Promise<T> {
    const raw = await this.read(operation, args, options);
    return transform(raw);
  }

  /**
   * Invoke a contract method, wait for confirmation, then call a reload
   * function to refresh local state. Skips reload if the invoke failed.
   *
   * @example
   * ```ts
   * await chain.invokeAndReload("claim", claimArgs, loadAll, {
   *   waitForEvent: "Claimed",
   * });
   * ```
   */
  async invokeAndReload(
    operation: string,
    args: ContractArg[],
    reloadFn: () => Promise<void>,
    options?: InvokeOptions,
  ): Promise<TxResult> {
    const result = await this.invoke(operation, args, options);
    if (result.success) {
      await reloadFn();
    }
    return result;
  }

  /**
   * Two-step prepaid pattern: transfer GAS to the contract with a memo,
   * wait for the credit to settle, then invoke an operation.
   *
   * Prefer {@link invokeWithPayment} when the underlying SDK handles both
   * steps atomically. Use this method when you need explicit control over
   * the GAS transfer and the follow-up invocation as separate transactions.
   *
   * Once the deposit transfer is broadcast, any follow-up invocation failure
   * surfaces as {@link DepositConfirmedActionFailedError} — the credit is
   * withdrawable, not lost. Its `settlement` field records whether the
   * deposit was proven in a block ("confirmed") or merely broadcast
   * ("timeout"/"unreachable" — indexer lag or outage).
   *
   * @example
   * ```ts
   * await chain.prepayAndInvoke(
   *   "100000000",
   *   "stake",
   *   "lockStake",
   *   [{ type: "Integer", value: "100000000" }],
   * );
   * ```
   */
  async prepayAndInvoke(
    gasAmount: string,
    memo: string,
    operation: string,
    args: ContractArg[],
    options?: InvokeOptions,
  ): Promise<TxResult> {
    return this.withProcessing(async () => {
      await this.ensureWallet();

      // Step 1: Transfer GAS to contract
      const transfer = await this.invoke(
        "transfer",
        [
          { type: "Hash160", value: this.address.get()! },
          { type: "Hash160", value: this.contractAddress.get()! },
          { type: "Integer", value: gasAmount },
          { type: "String", value: memo },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      // Step 2: Wait for the credit to land in a block (indexer poll, ~2 blocks
      // max). The legacy fixed sleep remains only when the indexer is
      // unreachable — a blind sleep cannot guarantee the deposit executed
      // before the consuming call.
      const settlement = await waitForDepositConfirmation(transfer.txid, {
        network: this.indexerNetwork(),
      });
      if (settlement === "unreachable") {
        await new Promise((r) => setTimeout(r, TIME_CONSTANTS.SECOND_MS * 4));
      }

      // Step 3: Invoke the target operation. The deposit transfer was
      // BROADCAST in step 1 whatever the settlement outcome — on
      // "timeout"/"unreachable" the deposit is merely unproven by the
      // indexer, not absent — so any consuming-call failure is the
      // stranded-credit branch; the settlement field keeps the states
      // distinct.
      try {
        return await this.invoke(operation, args, options);
      } catch (error: unknown) {
        throw new DepositConfirmedActionFailedError(
          operation,
          transfer.txid,
          error,
          settlement,
        );
      }
    });
  }

  /**
   * List all events matching a name and parse each with a transform.
   * Events for which the transform returns `null` are filtered out.
   *
   * @example
   * ```ts
   * const bids = await chain.listEventsParsed("BidPlaced", (evt: Record<string, unknown>) => ({
   *   bidder: evt.state[0]?.value,
   *   amount: Number(evt.state[1]?.value),
   * }));
   * ```
   */
  async listEventsParsed<T>(
    eventName: string,
    transform: (evt: unknown) => T | null,
  ): Promise<T[]> {
    const events = await this.listAllEvents(eventName);
    return events.map(transform).filter((x): x is T => x !== null);
  }

  // -- Helpers --------------------------------------------------------------

  private buildCacheKey(
    prefix: string,
    operation: string,
    args?: ContractArg[],
    scriptHash?: string,
  ): string {
    const argStr = args ? JSON.stringify(args) : "";
    // "default" denotes the app's manifest contract — unambiguous because the
    // cache namespace is per-app. Explicit overrides get their own keys so
    // reads against different contracts never collide.
    return `${prefix}:${scriptHash ?? "default"}:${operation}:${argStr}`;
  }

  /**
   * Emit the honest outcome of an event wait: TRANSACTION_CONFIRMED only when
   * the event was actually observed, TRANSACTION_UNVERIFIED otherwise. The
   * unverified path also emits BALANCE_CHANGED — the transaction was broadcast
   * and may well have landed, so balance subscribers (BalanceService.useBalance)
   * still refresh deliberately rather than riding a false "confirmed" signal.
   */
  private emitEventWaitOutcome(txid: string, operation: string, event: unknown): void {
    if (event != null) {
      this.events.emit(EventBus.TRANSACTION_CONFIRMED, { txid, event });
    } else {
      this.events.emit(TRANSACTION_UNVERIFIED, { txid, operation });
      this.events.emit(EventBus.BALANCE_CHANGED, {});
    }
  }

  /** Indexer network matching the connected wallet's chain. */
  private indexerNetwork(): "mainnet" | "testnet" {
    const ct = (this.wallet as unknown as { chainType?: { get?: () => string; value?: string } }).chainType;
    const raw = typeof ct?.get === "function" ? ct.get() : ct?.value;
    return resolveNeoNetwork(typeof raw === "string" ? raw : "");
  }

  // -- Lifecycle ------------------------------------------------------------

  /**
   * Release the underlying contract-interaction's pending timers (the prepaid
   * "success" reset timer and any in-flight settle-delay sleeps). Called by
   * {@link PlatformServices.destroy} on miniapp unmount so a write that was in
   * flight at teardown cannot fire a `setTimeout` callback after the app is
   * gone. Idempotent — `useContractInteraction.dispose()` clears its timer
   * lists on every call.
   */
  dispose(): void {
    this.interaction.dispose();
  }
}

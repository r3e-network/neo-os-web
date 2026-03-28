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
 *   { type: "Hash160", value: chain.address.value },
 *   { type: "Integer", value: "100000000" },
 * ]);
 * ```
 */

import { computed } from "vue";
import type { ComputedRef, Ref } from "vue";
import { useContractInteraction } from "../composables/useContractInteraction";
import type { CacheService } from "./CacheService";
import { EventBus } from "./EventBus";
import { useEvents } from "../utils/wallet-sdk";
import type { EventsListParams } from "../utils/wallet-sdk";
import { useAllEvents } from "../composables/useAllEvents";
import { TIME_CONSTANTS } from "../constants";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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
  /** Timeout for event waiting. Default: 30 000ms. */
  waitTimeoutMs?: number;
}

export interface TxResult {
  txid: string;
  event?: unknown;
  success: boolean;
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

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

export class ChainService {
  private interaction: ReturnType<typeof useContractInteraction>;
  private cache: CacheService;
  private events: EventBus;
  private appId: string;
  private listEventsComposable: ReturnType<typeof useEvents>;
  private allEvents: ReturnType<typeof useAllEvents>;

  /** Whether a wallet is currently connected. Created once in constructor. */
  readonly isConnected: ComputedRef<boolean>;

  constructor(
    appId: string,
    t: (key: string) => string,
    cache: CacheService,
    events: EventBus,
  ) {
    this.appId = appId;
    this.cache = cache;
    this.events = events;

    this.interaction = useContractInteraction({ appId, t });
    this.listEventsComposable = useEvents();
    this.allEvents = useAllEvents(this.listEventsComposable.list, appId);

    // Create computed once to avoid allocating a new one on each property access
    this.isConnected = computed(() => Boolean(this.interaction.address.value));
  }

  // -- Wallet management ----------------------------------------------------

  /** Reactive wallet address ref. */
  get address(): Ref<string | null> {
    return this.interaction.address;
  }

  /**
   * Ensure a wallet is connected, prompting connection if needed.
   * Emits WALLET_CONNECTED on success.
   */
  async ensureWallet(): Promise<string> {
    const wasConnected = Boolean(this.interaction.address.value);
    const addr = await this.interaction.ensureWallet();
    if (!wasConnected && addr) {
      this.events.emit(EventBus.WALLET_CONNECTED, { address: addr });
    }
    return addr;
  }

  // -- Contract address -----------------------------------------------------

  /** Reactive contract address ref. */
  get contractAddress(): Ref<string | null> {
    return this.interaction.contractAddress;
  }

  // -- Processing state -----------------------------------------------------

  /** Whether a write operation is currently in flight. */
  get isProcessing(): Ref<boolean> {
    return this.interaction.isProcessing;
  }

  // -- Read operations ------------------------------------------------------

  /**
   * Execute a read-only contract call. Optionally checks the cache first.
   */
  async read(operation: string, args?: ContractArg[], options?: ReadOptions): Promise<unknown> {
    const cacheKey = options?.cache ? this.buildCacheKey("read", operation, args) : null;
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached !== null) return cached;
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
    const cacheKey = options?.cache ? this.buildCacheKey("readArray", operation, args) : null;
    if (cacheKey) {
      const cached = this.cache.get<unknown[]>(cacheKey);
      if (cached !== null) return cached;
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
    const { txid } = await this.interaction.invokeDirectly(
      operation,
      args as { type: string; value: string | number | boolean }[],
      options?.scriptHash,
      options?.signers,
    );

    this.events.emit(EventBus.TRANSACTION_SENT, { txid, operation });

    let event: unknown;
    if (options?.waitForEvent && txid) {
      event = await this.waitForEvent(txid, options.waitForEvent, options.waitTimeoutMs);
      this.events.emit(EventBus.TRANSACTION_CONFIRMED, { txid, event });
    }

    return { txid, event, success: Boolean(txid) };
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
    const { txid } = await this.interaction.invokeWithDirectPrepaidGas(
      amount,
      memo,
      operation,
      args as { type: string; value: string | number | boolean }[],
      options?.scriptHash,
      undefined,
      options?.signers,
    );

    this.events.emit(EventBus.TRANSACTION_SENT, { txid, operation });

    let event: unknown;
    if (options?.waitForEvent && txid) {
      event = await this.waitForEvent(txid, options.waitForEvent, options.waitTimeoutMs);
      this.events.emit(EventBus.TRANSACTION_CONFIRMED, { txid, event });
    }

    return { txid, event, success: Boolean(txid) };
  }

  // -- Event watching -------------------------------------------------------

  /**
   * Poll for a specific event matching a transaction ID.
   * Returns the event payload or null on timeout.
   */
  async waitForEvent(txid: string, eventName: string, timeoutMs?: number): Promise<unknown> {
    const timeout = timeoutMs ?? TIME_CONSTANTS.DEFAULT_TIMEOUT_MS;
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

  // -- Helpers --------------------------------------------------------------

  private buildCacheKey(prefix: string, operation: string, args?: ContractArg[]): string {
    const argStr = args ? JSON.stringify(args) : "";
    return `${prefix}:${operation}:${argStr}`;
  }
}

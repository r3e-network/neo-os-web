/**
 * BalanceService - Token balance queries with caching and reactive watching.
 *
 * Wraps useWalletBalanceReader with caching, event bus integration,
 * and a reactive useBalance() API for auto-refreshing balance display.
 *
 * @example
 * ```ts
 * // One-shot query
 * const gas = await services.balance.getGasBalance();
 *
 * // Reactive balance that auto-refreshes
 * const { balance, refresh } = services.balance.useBalance("GAS");
 * // balance.get() auto-updates when BALANCE_CHANGED fires
 * ```
 */

import { createObservable } from "../react/context";
import type { Observable } from "../react/context";
import { useWalletBalanceReader } from "../composables/useWalletBalanceReader";
import { BLOCKCHAIN_CONSTANTS } from "../constants";
import type { CacheService } from "./CacheService";
import { EventBus } from "./EventBus";
import type { ChainService } from "./ChainService";

/** Observable with a backward-compatible `.value` property. */
type RefCompatObservable<T> = Observable<T> & { value: T };

function withValueCompat<T>(obs: Observable<T>): RefCompatObservable<T> {
  return Object.defineProperty(obs, "value", {
    get() { return obs.get(); },
    set(v: T) { obs.set(v); },
    enumerable: true,
    configurable: true,
  }) as RefCompatObservable<T>;
}

const BALANCE_CACHE_TTL_MS = 15_000; // 15 seconds
const BALANCE_CACHE_PREFIX = "bal";

export class BalanceService {
  private cache: CacheService;
  private events: EventBus;
  private chain: ChainService;
  private reader: ReturnType<typeof useWalletBalanceReader>;

  constructor(chain: ChainService, cache: CacheService, events: EventBus) {
    this.chain = chain;
    this.cache = cache;
    this.events = events;
    this.reader = useWalletBalanceReader();
  }

  // -- Balance queries (one-shot) -------------------------------------------

  /**
   * Get the formatted balance for any asset. Uses the connected wallet
   * address by default, or a specific address if provided.
   */
  async getBalance(asset: "NEO" | "GAS" | string, address?: string): Promise<number> {
    const owner = address ?? this.chain.address.get() ?? undefined;
    const cacheKey = this.balanceCacheKey(asset, owner);

    const cached = this.cache.get<number>(cacheKey);
    if (cached !== null) return cached;

    const balance = await this.reader.readBalance(asset, {
      targetAddress: owner,
      requireChain: false,
    });

    this.cache.set(cacheKey, balance, BALANCE_CACHE_TTL_MS);
    return balance;
  }

  /**
   * Get the raw (unscaled) balance as a bigint.
   * Useful for precise calculations before display formatting.
   */
  async getRawBalance(asset: "NEO" | "GAS" | string, address?: string): Promise<bigint> {
    const owner = address ?? this.chain.address.get() ?? undefined;
    return this.reader.readRawBalance(asset, {
      targetAddress: owner,
      requireChain: false,
    });
  }

  /**
   * Shorthand: get GAS balance for the connected wallet.
   */
  async getGasBalance(address?: string): Promise<number> {
    return this.getBalance("GAS", address);
  }

  /**
   * Shorthand: get NEO balance for the connected wallet.
   */
  async getNeoBalance(address?: string): Promise<number> {
    return this.getBalance("NEO", address);
  }

  // -- Reactive balance (auto-refreshing) -----------------------------------

  /**
   * Returns a reactive balance ref that updates automatically when
   * the BALANCE_CHANGED event fires or refresh() is called manually.
   *
   * The caller is responsible for calling cleanup() when the component
   * unmounts (or register it with LifecycleService).
   */
  useBalance(asset: "NEO" | "GAS" | string): {
    balance: RefCompatObservable<number>;
    loading: RefCompatObservable<boolean>;
    refresh: () => Promise<void>;
    cleanup: () => void;
  } {
    const balance = withValueCompat(createObservable(0));
    const loading = withValueCompat(createObservable(false));

    const refresh = async () => {
      loading.set(true);
      try {
        balance.set(await this.getBalance(asset));
      } catch {
        // Keep the last known balance on error
      } finally {
        loading.set(false);
      }
    };

    // Auto-refresh when balance changes are emitted
    const unsub = this.events.on(EventBus.BALANCE_CHANGED, (payload) => {
      const p = payload as { asset?: string } | undefined;
      // Refresh if the changed asset matches, or if no asset specified (refresh all)
      if (!p?.asset || p.asset === asset || this.resolveAssetHash(p.asset) === this.resolveAssetHash(asset)) {
        refresh();
      }
    });

    // Also refresh when a transaction is confirmed (balances likely changed)
    const unsubTx = this.events.on(EventBus.TRANSACTION_CONFIRMED, () => {
      refresh();
    });

    // Initial fetch
    refresh();

    const cleanup = () => {
      unsub();
      unsubTx();
    };

    return { balance, loading, refresh, cleanup };
  }

  // -- Multi-asset ----------------------------------------------------------

  /**
   * Fetch NEO and GAS balances, plus any custom token hashes provided.
   */
  async getAllBalances(address?: string, additionalAssets?: string[]): Promise<Record<string, number>> {
    const assets = ["NEO", "GAS", ...(additionalAssets ?? [])];
    const results: Record<string, number> = {};

    // Fetch in parallel
    const promises = assets.map(async (asset) => {
      results[asset] = await this.getBalance(asset, address);
    });

    await Promise.all(promises);
    return results;
  }

  // -- Helpers --------------------------------------------------------------

  private balanceCacheKey(asset: string, address?: string | null): string {
    return `${BALANCE_CACHE_PREFIX}:${asset}:${address ?? "self"}`;
  }

  private resolveAssetHash(asset: string): string {
    if (asset === "NEO") return BLOCKCHAIN_CONSTANTS.NEO_HASH;
    if (asset === "GAS") return BLOCKCHAIN_CONSTANTS.GAS_HASH;
    return asset;
  }
}

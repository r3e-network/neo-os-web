/**
 * usePriceConsole — React hook for Oracle Price Console domain logic.
 *
 * Equivalent to the Vue composable but uses createObservable instead of ref/computed.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { OracleService } from "@shared/services";

export interface UsePriceConsoleOptions {
  oracle: OracleService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function usePriceConsole({ oracle, t }: UsePriceConsoleOptions) {
  const asset = createObservable("NEO");
  const latestPrice = createObservable<number | null>(null);
  const isRequesting = createObservable(false);

  // Derived observables (recomputed on access)
  const priceDisplay: Observable<string> = {
    get: () => {
      const price = latestPrice.get();
      return price == null ? t("notAvailable") : `$${price.toFixed(4)}`;
    },
    set: () => {},
    subscribe: (fn) => latestPrice.subscribe(fn),
  };

  const oracleHash: Observable<string> = {
    get: () => oracle.integration.contracts.morpheusOracle,
    set: () => {},
    subscribe: () => () => {},
  };

  const networkDisplay: Observable<string> = {
    get: () => oracle.network,
    set: () => {},
    subscribe: () => () => {},
  };

  const datafeedHash: Observable<string> = {
    get: () => oracle.integration.contracts.morpheusDatafeed,
    set: () => {},
    subscribe: () => () => {},
  };

  const datafeedShort: Observable<string> = {
    get: () => `${oracle.integration.contracts.morpheusDatafeed.slice(0, 10)}...`,
    set: () => {},
    subscribe: () => () => {},
  };

  const publicApiUrl: Observable<string> = {
    get: () => oracle.integration.morpheusPublicApiUrl,
    set: () => {},
    subscribe: () => () => {},
  };

  async function fetchPrice() {
    isRequesting.set(true);
    try {
      const result = await oracle.getPrice(asset.get());
      latestPrice.set(result.price);
      return { success: true };
    } finally {
      isRequesting.set(false);
    }
  }

  const loadAll = async () => {};

  return {
    asset,
    latestPrice,
    priceDisplay,
    oracleHash,
    networkDisplay,
    datafeedHash,
    datafeedShort,
    publicApiUrl,
    isRequesting,
    fetchPrice,
    loadAll,
  };
}

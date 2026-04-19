/**
 * usePriceConsole — React hook for the on-chain Morpheus DataFeed price console.
 *
 * Reads prices DIRECTLY from the deployed MorpheusDataFeed contract via
 * Neo N3 JSON-RPC. No off-chain HTTP, no Phala dependency, no edge proxy.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { useMorpheusDataFeed } from "@shared/composables/useMorpheusDataFeed";
import { EXTERNAL_INTEGRATIONS, getNetwork } from "@shared/constants/rpc";

export interface UsePriceConsoleOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function usePriceConsole({ t }: UsePriceConsoleOptions) {
  const network = getNetwork();
  const integration = EXTERNAL_INTEGRATIONS[network];
  const datafeed = useMorpheusDataFeed({ network });

  const asset = createObservable("NEO");
  const latestPrice = createObservable<number | null>(null);
  const isRequesting = createObservable(false);
  const errorMsg = createObservable<string | null>(null);

  const priceDisplay: Observable<string> = {
    get: () => {
      const price = latestPrice.get();
      return price == null ? t("notAvailable") : `$${price.toFixed(4)}`;
    },
    set: () => {},
    subscribe: (fn) => latestPrice.subscribe(fn),
  };

  const datafeedHash: Observable<string> = {
    get: () => integration.contracts.morpheusDatafeed,
    set: () => {},
    subscribe: () => () => {},
  };

  const datafeedShort: Observable<string> = {
    get: () => `${integration.contracts.morpheusDatafeed.slice(0, 10)}...`,
    set: () => {},
    subscribe: () => () => {},
  };

  const networkDisplay: Observable<string> = {
    get: () => network,
    set: () => {},
    subscribe: () => () => {},
  };

  const sourceLabel: Observable<string> = {
    get: () => `on-chain · ${integration.rpcUrl}`,
    set: () => {},
    subscribe: () => () => {},
  };

  async function fetchPrice() {
    isRequesting.set(true);
    errorMsg.set(null);
    try {
      const price = await datafeed.getPrice(asset.get());
      latestPrice.set(price);
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fetch failed";
      errorMsg.set(msg);
      return { success: false, error: msg };
    } finally {
      isRequesting.set(false);
    }
  }

  const loadAll = async () => {};

  return {
    asset,
    latestPrice,
    priceDisplay,
    datafeedHash,
    datafeedShort,
    networkDisplay,
    sourceLabel,
    isRequesting,
    errorMsg,
    fetchPrice,
    loadAll,
  };
}

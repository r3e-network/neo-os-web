/**
 * useNeoburgerStats -- React hook for NeoBurger statistics.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { PriceData } from "@shared/utils/price";
import { getPrices } from "@shared/utils/price";
import { formatCompactNumber } from "@shared/utils/format";

const STATS_ENDPOINTS = ["/api/neoburger-stats", "/api/neoburger/stats"];
const LOCAL_STATS_MOCK = { apy: 12.8, total_staked: 1425367, total_staked_formatted: "1.43M" };
const isLocalPreview = typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);

export function useNeoburgerStats(t: (key: string, params?: Record<string, string | number>) => string) {
  const apy = createObservable(0);
  const priceData = createObservable<PriceData | null>(null);
  const totalStaked = createObservable<number | null>(null);
  const totalStakedFormatted = createObservable<string | null>(null);

  const totalStakedDisplay: Observable<string> = {
    get: () => totalStakedFormatted.get() ?? t("placeholderDash"),
    set: () => {},
    subscribe: (fn) => totalStakedFormatted.subscribe(fn),
  };

  const totalStakedUsdText: Observable<string> = {
    get: () => {
      const pd = priceData.get();
      const ts = totalStaked.get();
      if (!pd || !ts) return t("usdPlaceholder");
      const usd = ts * (pd.usd?.neo ?? 0);
      return `$ ${formatCompactNumber(usd)}`;
    },
    set: () => {},
    subscribe: (fn) => { const u1 = priceData.subscribe(fn); const u2 = totalStaked.subscribe(fn); return () => { u1(); u2(); }; },
  };

  const aprDisplay: Observable<string> = {
    get: () => apy.get() > 0 ? `${apy.get().toFixed(1)}%` : t("apyPlaceholder"),
    set: () => {},
    subscribe: (fn) => apy.subscribe(fn),
  };

  const loadApy = async () => {
    if (isLocalPreview) {
      apy.set(LOCAL_STATS_MOCK.apy);
      totalStaked.set(LOCAL_STATS_MOCK.total_staked);
      totalStakedFormatted.set(LOCAL_STATS_MOCK.total_staked_formatted);
      return;
    }
    for (const endpoint of STATS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.apy) apy.set(Number(data.apy));
        if (data.total_staked) {
          totalStaked.set(Number(data.total_staked));
          totalStakedFormatted.set(data.total_staked_formatted ?? formatCompactNumber(Number(data.total_staked)));
        }
        return;
      } catch { continue; }
    }
  };

  const loadPrices = async () => {
    try {
      const prices = await getPrices();
      priceData.set(prices);
    } catch (e) {
      console.warn("[useNeoburgerStats] loadPrices failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const cleanup = () => {};

  return { apy, priceData, totalStakedDisplay, totalStakedUsdText, aprDisplay, loadApy, loadPrices, cleanup };
}

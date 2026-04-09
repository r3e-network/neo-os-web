/**
 * useNeoburgerRewards -- React hook for NeoBurger reward calculations.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { PriceData } from "@shared/utils/price";

export function useNeoburgerRewards(
  bNeoBalance: Observable<number>,
  apy: Observable<number>,
  priceData: Observable<PriceData | null>,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const dailyRewards: Observable<string> = {
    get: () => (bNeoBalance.get() * (apy.get() / 100 / 365)).toFixed(4),
    set: () => {},
    subscribe: (fn) => { const u1 = bNeoBalance.subscribe(fn); const u2 = apy.subscribe(fn); return () => { u1(); u2(); }; },
  };

  const weeklyRewards: Observable<string> = {
    get: () => (bNeoBalance.get() * (apy.get() / 100 / 52)).toFixed(4),
    set: () => {},
    subscribe: (fn) => { const u1 = bNeoBalance.subscribe(fn); const u2 = apy.subscribe(fn); return () => { u1(); u2(); }; },
  };

  const monthlyRewards: Observable<string> = {
    get: () => (bNeoBalance.get() * (apy.get() / 100 / 12)).toFixed(4),
    set: () => {},
    subscribe: (fn) => { const u1 = bNeoBalance.subscribe(fn); const u2 = apy.subscribe(fn); return () => { u1(); u2(); }; },
  };

  const totalRewards: Observable<number> = {
    get: () => { const monthly = parseFloat(monthlyRewards.get()); return Number.isFinite(monthly) ? monthly : 0; },
    set: () => {},
    subscribe: (fn) => monthlyRewards.subscribe(fn),
  };

  const totalRewardsUsdText: Observable<string> = {
    get: () => {
      const neoPrice = priceData.get()?.usd?.neo ?? 0;
      const usd = (totalRewards.get() * neoPrice).toFixed(2);
      return t("approxUsd", { value: usd });
    },
    set: () => {},
    subscribe: (fn) => { const u1 = totalRewards.subscribe(fn); const u2 = priceData.subscribe(fn); return () => { u1(); u2(); }; },
  };

  return { dailyRewards, weeklyRewards, monthlyRewards, totalRewards, totalRewardsUsdText };
}

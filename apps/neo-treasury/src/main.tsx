/**
 * Neo Treasury — Entry Point (React)
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import { fetchTreasuryData } from "./utils/treasury";

const CACHE_KEY = "neo_treasury_cache";

interface TreasuryData {
  totalUsd: number;
  totalNeo: number;
  totalGas: number;
  lastUpdated: string;
  prices: Record<string, unknown>;
  categories: Array<{ name: string; [key: string]: unknown }>;
}

defineMiniApp({
  appId: "miniapp-neo-treasury",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const loading = createObservable(true);
    const error = createObservable("");
    const data = createObservable<TreasuryData | null>(null);

    const totalUsdDisplay: Observable<string> = {
      get: () => {
        const d = data.get();
        return d?.totalUsd
          ? `${ctx.t("currencySymbol")}${d.totalUsd.toLocaleString()}`
          : ctx.t("notAvailable");
      },
      set: () => {},
      subscribe: (listener) => data.subscribe(listener),
    };
    const totalNeoDisplay: Observable<string> = {
      get: () => data.get()?.totalNeo?.toLocaleString() ?? ctx.t("notAvailable"),
      set: () => {},
      subscribe: (listener) => data.subscribe(listener),
    };
    const totalGasDisplay: Observable<string> = {
      get: () => data.get()?.totalGas?.toLocaleString() ?? ctx.t("notAvailable"),
      set: () => {},
      subscribe: (listener) => data.subscribe(listener),
    };
    const founderCount: Observable<number> = {
      get: () => data.get()?.categories?.length ?? 0,
      set: () => {},
      subscribe: (listener) => data.subscribe(listener),
    };

    const loadData = async () => {
      loading.set(true);
      error.set("");

      try {
        const cached = readCachedJSON<TreasuryData>(CACHE_KEY);
        if (cached) data.set(cached);
      } catch (_e) {
        console.warn("[neo-treasury] cache read failed:", _e instanceof Error ? _e.message : String(_e));
      }

      try {
        const freshData = await fetchTreasuryData();
        data.set(freshData);
        writeCachedJSON(CACHE_KEY, freshData);
      } catch (e) {
        if (!data.get()) {
          error.set(formatErrorMessage(e, ctx.t("loadFailed")));
        } else {
          console.warn("[neo-treasury] using cached data:", e instanceof Error ? e.message : String(e));
        }
      } finally {
        loading.set(false);
      }
    };

    ctx.registerAction("refresh", async () => {
      await loadData();
    });

    return {
      state: {
        loading,
        error,
        data,
        totalUsdDisplay,
        totalNeoDisplay,
        totalGasDisplay,
        founderCount,
      },
      loadData,
    };
  },
});

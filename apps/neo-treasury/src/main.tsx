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
import { fetchTreasuryData, type TreasuryData } from "./utils/treasury";
import {
  buildTreasuryTransferIntent,
  type TreasuryTransferIntent,
} from "./utils/treasuryOperations";

const CACHE_KEY = "neo_treasury_cache";

function formatAmount(value: number, maximumFractionDigits: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits });
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
    // True when the displayed figures came from cache because the fresh fetch
    // failed — drives the amber "showing cached data" signal instead of the
    // green "live synced" one.
    const stale = createObservable(false);
    const address = createObservable(ctx.services.chain.address.get() ?? "");
    const disbursementSubmitting = createObservable(false);
    const disbursementStatus = createObservable(ctx.t("disbursementDraftReady"));
    const disbursementError = createObservable("");
    const lastTxid = createObservable("");
    const lastIntent = createObservable<TreasuryTransferIntent | null>(null);

    const totalUsdDisplay: Observable<string> = {
      get: () => {
        const d = data.get();
        // totalUsd is null when the price feed was unavailable — render the
        // em-dash placeholder (the NEO/GAS balances still show).
        return typeof d?.totalUsd === "number"
          ? `${ctx.t("currencySymbol")}${formatAmount(d.totalUsd, 2)}`
          : "—";
      },
      set: () => {},
      subscribe: (listener) => data.subscribe(listener),
    };
    const totalNeoDisplay: Observable<string> = {
      get: () =>
        data.get()?.totalNeo !== undefined
          ? formatAmount(data.get()!.totalNeo, 4)
          : ctx.t("notAvailable"),
      set: () => {},
      subscribe: (listener) => data.subscribe(listener),
    };
    const totalGasDisplay: Observable<string> = {
      get: () =>
        data.get()?.totalGas !== undefined
          ? formatAmount(data.get()!.totalGas, 4)
          : ctx.t("notAvailable"),
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
        // The fetch itself succeeded, but the on-chain price feed may have
        // returned a delayed (still in-window) quote. Honor that: a delayed feed
        // shows the amber "stale" signal, not the green "live synced" dot, so the
        // USD total is never presented as fresh when its record is old.
        stale.set(freshData.priceStale);
        writeCachedJSON(CACHE_KEY, freshData);
      } catch (e) {
        if (!data.get()) {
          error.set(formatErrorMessage(e, ctx.t("loadFailed")));
        } else {
          // We're rendering day-old cached figures — flag them as stale so the
          // hero shows the amber "cached data" signal, not "live synced".
          stale.set(true);
          console.warn("[neo-treasury] using cached data:", e instanceof Error ? e.message : String(e));
        }
      } finally {
        loading.set(false);
      }
    };

    ctx.registerAction("refresh", async () => {
      await loadData();
    });

    ctx.registerAction("connectWallet", async () => {
      disbursementError.set("");
      const walletAddress = await ctx.services.chain.ensureWallet();
      address.set(walletAddress);
      disbursementStatus.set(ctx.t("walletConnected"));
      return { address: walletAddress };
    });

    ctx.registerAction("submitDisbursement", async (...args: unknown[]) => {
      if (disbursementSubmitting.get()) return null;
      const form = (args[0] ?? {}) as Record<string, unknown>;
      disbursementSubmitting.set(true);
      disbursementError.set("");
      disbursementStatus.set(ctx.t("disbursementSigning"));

      try {
        const walletAddress = await ctx.services.chain.ensureWallet();
        address.set(walletAddress);
        const intent = buildTreasuryTransferIntent(walletAddress, form);
        lastIntent.set(intent);

        const result = await ctx.services.chain.invoke("transfer", intent.args, {
          scriptHash: intent.scriptHash,
        });

        lastTxid.set(result.txid || "");
        disbursementStatus.set(ctx.t("disbursementSubmitted"));
        // If the recipient is one of the watched wallets, the dashboard would
        // otherwise stay stale until a manual Refresh. Re-load after a short
        // delay to absorb RPC node-lag before re-reading balances.
        if (result.txid) {
          setTimeout(() => {
            void loadData();
          }, 6000);
        }
        return result;
      } catch (e) {
        const message = formatErrorMessage(e, ctx.t("disbursementFailed"));
        disbursementError.set(message);
        disbursementStatus.set(message);
        throw e;
      } finally {
        disbursementSubmitting.set(false);
      }
    });

    const stopAddressSync = ctx.services.chain.address.subscribe(() => {
      address.set(ctx.services.chain.address.get() ?? "");
    });

    return {
      state: {
        loading,
        error,
        data,
        stale,
        address,
        disbursementSubmitting,
        disbursementStatus,
        disbursementError,
        lastTxid,
        lastIntent,
        totalUsdDisplay,
        totalNeoDisplay,
        totalGasDisplay,
        founderCount,
      },
      loadData,
      cleanup: stopAddressSync,
    };
  },
});

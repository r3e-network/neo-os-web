/**
 * Neo Treasury — Entry Point (React)
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { fetchTreasuryData, type TreasuryData } from "./utils/treasury";
import {
  buildTreasuryTransferIntent,
  type TreasuryTransferIntent,
} from "./utils/treasuryOperations";

// Key remainder under the pinned "neo_treasury_" storage prefix — the on-disk
// localStorage key stays the legacy runtime-cache "neo_treasury_cache"
// byte-for-byte, so existing users keep their cached dashboard.
const CACHE_KEY = "cache";

function formatAmount(value: number, maximumFractionDigits: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

defineMiniApp({
  appId: "miniapp-neo-treasury",
  playArea: PlayArea,
  manifest,
  messages,
  // Pin app.storage.local to the legacy runtime-cache namespace so the
  // pre-framework "neo_treasury_cache" key keeps resolving byte-for-byte
  // (storage keys must not change across the framework migration).
  storagePrefix: "neo_treasury_",

  setup(ctx) {
    const loading = createObservable(true);
    const error = createObservable("");
    const data = createObservable<TreasuryData | null>(null);
    // True when the displayed figures came from cache because the fresh fetch
    // failed — drives the amber "showing cached data" signal instead of the
    // green "live synced" one.
    const stale = createObservable(false);
    const address = createObservable(ctx.framework.chain.address.get() ?? "");
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
        const cached = ctx.framework.storage.local.get<TreasuryData>(CACHE_KEY);
        if (cached) {
          data.set(cached);
          // Cached balances/prices are not a live read — show the amber "stale"
          // signal until the fresh fetch resolves and sets real freshness, so old
          // cached USD is never momentarily presented as "live synced".
          stale.set(true);
        }
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
        try {
          ctx.framework.storage.local.set(CACHE_KEY, freshData);
        } catch (_e) {
          // A cache-write failure (quota/sandboxed storage) is non-fatal and
          // must not trip the outer catch into flagging the just-rendered
          // FRESH data as stale — the legacy safeWriteJSON lane swallowed it.
        }
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

    ctx.framework.actions.register("refresh", async () => {
      await loadData();
    });

    ctx.framework.actions.register("connectWallet", async () => {
      disbursementError.set("");
      const walletAddress = await ctx.framework.chain.ensureWallet();
      address.set(walletAddress);
      disbursementStatus.set(ctx.t("walletConnected"));
      return { address: walletAddress };
    });

    ctx.framework.actions.register("submitDisbursement", async (...args: unknown[]) => {
      if (disbursementSubmitting.get()) return null;
      const form = (args[0] ?? {}) as Record<string, unknown>;
      disbursementSubmitting.set(true);
      disbursementError.set("");
      disbursementStatus.set(ctx.t("disbursementSigning"));

      try {
        const walletAddress = await ctx.framework.chain.ensureWallet();
        address.set(walletAddress);
        const intent = buildTreasuryTransferIntent(walletAddress, form);
        lastIntent.set(intent);

        // app.chain.write with notify:'silent' (S2): the framework never
        // toasts on this lane and errors throw unchanged, so this handler
        // keeps owning its own error reformatting (formatErrorMessage) and
        // status copy exactly as the pre-framework raw invoke did.
        const result = await ctx.framework.chain.write({
          operation: "transfer",
          args: intent.args,
          scriptHash: intent.scriptHash,
          notify: "silent",
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

    const stopAddressSync = ctx.framework.chain.address.subscribe(() => {
      address.set(ctx.framework.chain.address.get() ?? "");
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

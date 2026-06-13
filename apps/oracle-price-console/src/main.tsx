/**
 * Oracle Price Console — React Entry Point
 *
 * Parallel to main.ts (Vue). Uses the React defineMiniApp runtime.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { usePriceConsole } from "./hooks/usePriceConsole";

/**
 * Sanitize a deep-link asset to a feed base symbol (e.g. `?asset=ETH-USD` ->
 * `ETH`). The select is populated from the live on-chain catalog (listPairs),
 * so any symbol-shaped value is accepted here; an unsupported pair surfaces a
 * clean localized "feed not found" error on fetch rather than a silent no-op.
 */
function launchAsset(params: Record<string, string>) {
  const raw = String(
    params.asset || params.symbol || params.feed || params.endpoint || "",
  )
    .trim()
    .replace(/^TWELVEDATA:/i, "")
    .toUpperCase();
  const asset = raw.split(/[-/]/)[0] || "";
  return /^[A-Z0-9]{1,12}$/.test(asset) ? asset : "";
}

defineMiniApp({
  appId: "miniapp-oracle-price-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const price = usePriceConsole({ t: ctx.t });
    const requestedAsset = launchAsset(ctx.launchContext.params);
    if (requestedAsset) price.asset.set(requestedAsset);

    ctx.registerAction("fetchPrice", async () => {
      // price.fetchPrice() never throws — it catches internally and returns
      // { success, error }. notify.guard would therefore always show the
      // success toast, even on RPC failure. Branch on the result instead so
      // exactly one (correct) toast is shown.
      const result = await price.fetchPrice();
      if (result.success) {
        ctx.services.notify.success("priceLoaded");
      } else {
        ctx.services.notify.error(result.error ?? ctx.t("fetchFailed"), "fetchFailed");
      }
    });

    ctx.registerAction("updateAsset", async (val: unknown) => {
      price.asset.set(String(val));
    });

    return {
      state: {
        asset: price.asset,
        priceDisplay: price.priceDisplay,
        freshness: price.freshness,
        freshnessLabel: price.freshnessLabel,
        freshnessTimestamp: price.freshnessTimestamp,
        availablePairs: price.availablePairs,
        networkDisplay: price.networkDisplay,
        datafeedHash: price.datafeedHash,
        datafeedShort: price.datafeedShort,
        sourceLabel: price.sourceLabel,
        errorMsg: price.errorMsg,
        isRequesting: price.isRequesting,
      },
      loadData: price.loadAll,
    };
  },
});

/**
 * Oracle Price Console — React Entry Point
 *
 * Parallel to main.ts (Vue). Uses the React defineMiniApp runtime.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import { EXTERNAL_INTEGRATIONS, getNetwork } from "@shared/constants/rpc";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { launchAssetSymbol, usePriceConsole } from "./hooks/usePriceConsole";

/**
 * app.oracle.dataFeed lane config: the deployed MorpheusDataFeed contract and
 * JSON-RPC endpoint are network-specific, so the app injects them (framework
 * S13 — the reader itself is framework-owned).
 */
const network = getNetwork();
const integration = EXTERNAL_INTEGRATIONS[network];

/**
 * Sanitize a deep-link asset to a feed base symbol (e.g. `?asset=ETH-USD` ->
 * `ETH`). The select is populated from the live on-chain catalog (listPairs),
 * so any symbol-shaped value is accepted here; an unsupported pair surfaces a
 * clean localized "feed not found" error on fetch rather than a silent no-op.
 */
function launchAsset(params: Record<string, string>) {
  return launchAssetSymbol(
    params.asset || params.symbol || params.feed || params.endpoint || "",
  );
}

defineMiniApp({
  appId: "miniapp-oracle-price-console",
  playArea: PlayArea,
  manifest,
  messages,
  oracle: {
    dataFeed: {
      rpcUrl: integration.rpcUrl,
      contractHash: integration.contracts.morpheusDatafeed,
      network,
    },
  },

  setup(ctx) {
    const app = ctx.framework;
    const price = usePriceConsole({ app, t: ctx.t });
    const requestedAsset = launchAsset(ctx.launchContext.params);
    if (requestedAsset) price.selectAsset(requestedAsset);
    app.lifecycle.cleanup(price.cleanup);

    app.actions.register("fetchPrice", async () => {
      // price.fetchPrice() never throws — it catches internally and returns
      // { success, error }. app.notify.guard would therefore always show the
      // success toast, even on RPC failure. Branch on the result instead so
      // exactly one (correct) toast is shown.
      const result = await price.fetchPrice();
      if (result.ignored) return;
      if (result.success) {
        app.notify.success("priceLoaded");
      } else {
        app.notify.error(result.error ?? ctx.t("fetchFailed"), "fetchFailed");
      }
    });

    ctx.framework.actions.register("updateAsset", async (val: unknown) => {
      price.selectAsset(val);
    });

    return {
      state: {
        asset: price.asset,
        priceDisplay: price.priceDisplay,
        priceSettled: price.priceSettled,
        freshness: price.freshness,
        freshnessLabel: price.freshnessLabel,
        freshnessTimestamp: price.freshnessTimestamp,
        sourceFreshness: price.sourceFreshness,
        sourceFreshnessLabel: price.sourceFreshnessLabel,
        sourceTimestampDisplay: price.sourceTimestampDisplay,
        feedRoute: price.feedRoute,
        feedKey: price.feedKey,
        availablePairs: price.availablePairs,
        networkDisplay: price.networkDisplay,
        datafeedHash: price.datafeedHash,
        datafeedShort: price.datafeedShort,
        sourceLabel: price.sourceLabel,
        rpcEndpoint: price.rpcEndpoint,
        errorMsg: price.errorMsg,
        isRequesting: price.isRequesting,
      },
      loadData: price.loadAll,
    };
  },
});

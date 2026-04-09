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

defineMiniApp({
  appId: "miniapp-oracle-price-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const price = usePriceConsole({
      oracle: ctx.services.oracle,
      t: ctx.t,
    });

    ctx.registerAction("fetchPrice", async () => {
      await ctx.services.notify.guard(() => price.fetchPrice(), "priceLoaded");
    });

    ctx.registerAction("updateAsset", async (val: unknown) => {
      price.asset.set(String(val));
    });

    return {
      state: {
        asset: price.asset,
        priceDisplay: price.priceDisplay,
        oracleHash: price.oracleHash,
        networkDisplay: price.networkDisplay,
        datafeedHash: price.datafeedHash,
        datafeedShort: price.datafeedShort,
        publicApiUrl: price.publicApiUrl,
        isRequesting: price.isRequesting,
      },
      loadData: price.loadAll,
    };
  },
});

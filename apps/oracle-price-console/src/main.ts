/**
 * Oracle Price Console — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the price feed console with manifest-driven
 * platform sections and a composable for domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { usePriceConsole } from "./composables/usePriceConsole";

defineMiniApp({
  appId: "miniapp-oracle-price-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-oracle-price-console", {
      t: ctx.t as (key: string) => string,
    });

    const price = usePriceConsole({
      oracle: platformServices.oracle,
      t: ctx.t,
    });

    ctx.registerAction("fetchPrice", async () => {
      try {
        await price.fetchPrice();
        ctx.setStatus(ctx.t("priceLoaded"), "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("fetchFailed"), "error");
      }
    });

    ctx.registerAction("updateAsset", (val: string) => {
      price.asset.value = val;
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
      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});

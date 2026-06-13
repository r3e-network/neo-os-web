import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { appId, manifest, messages } from "./appConfig";
import { readSealedIntents } from "./history";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    return {
      state: {
        privacyMode: createObservable(ctx.t("privacyModeLabel")),
        networkLabel: createObservable(ctx.t("networkTestnet")),
        lastStatus: createObservable(ctx.t("statusReady")),
        lastDigest: createObservable(ctx.t("digestPlaceholder")),
        requestCount: createObservable(0),
      },
      // Rehydrate the header stat tiles from the device-local sealed-intents log
      // so requestCount and the commitment digest survive a remount instead of
      // resetting to 0 / "—" every time the miniapp re-opens.
      loadData: async () => {
        const intents = readSealedIntents();
        const latest = intents[0];
        if (!latest) {
          return;
        }
        ctx.state.requestCount?.set(intents.length);
        ctx.state.lastStatus?.set(ctx.t("statusSealed"));
        ctx.state.lastDigest?.set(latest.commitment);
      },
    };
  },
});

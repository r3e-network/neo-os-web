import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { appId, appMeta, manifest, messages } from "./appConfig";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    return {
      state: {
        networkLabel: createObservable(appMeta.networkLabel),
        endpointLabel: createObservable(appMeta.endpointLabel),
        lastStatus: createObservable(ctx.t("statusReady")),
        lastDigest: createObservable(ctx.t("notAvailable")),
        requestCount: createObservable(0),
      },
      loadData: async () => {},
    };
  },
});

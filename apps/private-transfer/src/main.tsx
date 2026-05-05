import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { appId, manifest, messages } from "./appConfig";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    return {
      state: {
        privacyMode: createObservable("Morpheus TEE"),
        networkLabel: createObservable("Neo N3"),
        lastStatus: createObservable(ctx.t("statusReady")),
        lastDigest: createObservable(ctx.t("notAvailable")),
        requestCount: createObservable(0),
      },
      loadData: async () => {},
    };
  },
});

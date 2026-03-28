/**
 * oracle-compute-lab — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire manifest, PlayArea, and domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

defineMiniApp({
  appId: "miniapp-oracle-compute-lab",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-oracle-compute-lab", {
      t: ctx.t as (key: string) => string,
    });

    return {
      state: {},
      loadData: async () => {},
      cleanup: () => { platformServices.destroy(); },
    };
  },
});

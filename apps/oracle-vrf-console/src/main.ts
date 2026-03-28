/**
 * Oracle VRF Console — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the VRF randomness console with manifest-driven
 * platform sections and a composable for domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useVrfConsole } from "./composables/useVrfConsole";

defineMiniApp({
  appId: "miniapp-oracle-vrf-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-oracle-vrf-console", {
      t: ctx.t as (key: string) => string,
    });

    const { notify } = platformServices;

    const vrf = useVrfConsole({
      oracle: platformServices.oracle,
      t: ctx.t,
    });

    ctx.registerAction("requestRandom", async () => {
      await notify.guard(() => vrf.requestRandom(), "randomnessRequested");
    });

    return {
      state: {
        requestId: vrf.requestId,
        randomValue: vrf.randomValue,
        proof: vrf.proof,
        oracleHash: vrf.oracleHash,
        networkDisplay: vrf.networkDisplay,
        publicApiUrl: vrf.publicApiUrl,
        isRequesting: vrf.isRequesting,
        vrfMode: { value: ctx.t("heroDirect") },
      },
      loadData: vrf.loadAll,
      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});

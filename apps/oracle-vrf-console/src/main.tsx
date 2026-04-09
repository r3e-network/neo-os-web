/**
 * Oracle VRF Console — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useVrfConsole } from "./composables/useVrfConsole";

defineMiniApp({
  appId: "miniapp-oracle-vrf-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const vrf = useVrfConsole({
      oracle: ctx.services.oracle,
      t: ctx.t,
    });

    ctx.registerAction("requestRandom", async () => {
      await ctx.services.notify.guard(() => vrf.requestRandom(), "randomnessRequested");
    });

    const vrfMode = createObservable(ctx.t("heroDirect"));

    return {
      state: {
        requestId: vrf.requestId,
        randomValue: vrf.randomValue,
        proof: vrf.proof,
        oracleHash: vrf.oracleHash,
        networkDisplay: vrf.networkDisplay,
        publicApiUrl: vrf.publicApiUrl,
        isRequesting: vrf.isRequesting,
        vrfMode,
      },
      loadData: vrf.loadAll,
    };
  },
});

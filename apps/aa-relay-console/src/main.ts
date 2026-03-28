/**
 * AA Relay Console — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire PlayArea, manifest, messages, and domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAARelayConsole } from "./composables/useAARelayConsole";

defineMiniApp({
  appId: "miniapp-aa-relay-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-aa-relay-console", {
      t: ctx.t as (key: string) => string,
    });

    const relay = useAARelayConsole({
      aa: platformServices.aa,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("checkSponsor", async (aaAddress: string, dappId: string) => {
      relay.aaAddress.value = aaAddress;
      relay.dappId.value = dappId;
      await platformServices.notify.guard(() => relay.checkSponsor(), "sponsorCheckComplete", "sponsorCheckError");
    });

    ctx.registerAction("requestSponsor", async (aaAddress: string, dappId: string) => {
      relay.aaAddress.value = aaAddress;
      relay.dappId.value = dappId;
      await platformServices.notify.guard(() => relay.requestSponsor(), "sponsorRequestComplete", "sponsorRequestError");
    });

    ctx.registerAction("submitRelay", async (aaAddress: string, dappId: string, payloadJson: string) => {
      relay.aaAddress.value = aaAddress;
      relay.dappId.value = dappId;
      relay.payloadJson.value = payloadJson;
      await platformServices.notify.guard(() => relay.submitRelay(), "relaySubmitted", "relayError");
    });

    return {
      state: {
        aaAddressDisplay: relay.aaAddressDisplay,
        paymasterDisplay: relay.paymasterDisplay,
        sponsorState: relay.sponsorState,
        relayResponse: relay.relayResponse,
        aaCoreDisplay: relay.aaCoreDisplay,
        relayUrlDisplay: relay.relayUrlDisplay,
        networkDisplay: relay.networkDisplay,
        isCheckingSponsorship: relay.isCheckingSponsorship,
        isRelaying: relay.isRelaying,
      },
      loadData: relay.loadAll,
      cleanup: () => { platformServices.destroy(); },
    };
  },
});

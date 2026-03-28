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
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("checkSponsor", async (aaAddress: string, dappId: string) => {
      try {
        relay.aaAddress.value = aaAddress;
        relay.dappId.value = dappId;
        await relay.checkSponsor();
        ctx.setStatus(ctx.t("sponsorCheckComplete"), "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("sponsorCheckError"), "error");
      }
    });

    ctx.registerAction("requestSponsor", async (aaAddress: string, dappId: string) => {
      try {
        relay.aaAddress.value = aaAddress;
        relay.dappId.value = dappId;
        await relay.requestSponsor();
        ctx.setStatus(ctx.t("sponsorRequestComplete"), "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("sponsorRequestError"), "error");
      }
    });

    ctx.registerAction("submitRelay", async (aaAddress: string, dappId: string, payloadJson: string) => {
      try {
        relay.aaAddress.value = aaAddress;
        relay.dappId.value = dappId;
        relay.payloadJson.value = payloadJson;
        await relay.submitRelay();
        ctx.setStatus(ctx.t("relaySubmitted"), "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("relayError"), "error");
      }
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
        isCheckingSponsorship: relay.aa.isCheckingSponsorship,
        isRelaying: relay.aa.isRelaying,
      },
      loadData: relay.loadAll,
      cleanup: () => { relay.cleanup(); platformServices.destroy(); },
    };
  },
});

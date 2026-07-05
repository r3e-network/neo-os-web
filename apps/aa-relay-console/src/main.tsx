/**
 * AA Relay Console — React Entry Point
 *
 * Uses the React defineMiniApp runtime with createObservable state.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useAARelayConsole } from "./composables/useAARelayConsole";
import { getRelayLaunchDefaults } from "./launch";

defineMiniApp({
  appId: "miniapp-aa-relay-console",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const relay = useAARelayConsole({
      aa: ctx.services.aa,
      eventBus: ctx.services.events,
      t: ctx.t,
    });
    const launchDefaults = getRelayLaunchDefaults(ctx.launchContext);
    if (launchDefaults.aaAddress) relay.aaAddress.set(launchDefaults.aaAddress);
    if (launchDefaults.dappId) relay.dappId.set(launchDefaults.dappId);
    if (launchDefaults.sponsorAmount) {
      relay.sponsorAmount.set(launchDefaults.sponsorAmount);
    }
    if (launchDefaults.payloadJson) {
      relay.payloadJson.set(launchDefaults.payloadJson);
    }

    ctx.framework.actions.register(
      "checkSponsor",
      async (aaAddress: unknown, dappId: unknown) => {
        relay.aaAddress.set(String(aaAddress));
        relay.dappId.set(String(dappId));
        await ctx.services.notify.guard(
          () => relay.checkSponsor(),
          "sponsorCheckComplete",
          "sponsorCheckError",
        );
      },
    );

    ctx.framework.actions.register(
      "requestSponsor",
      async (aaAddress: unknown, dappId: unknown, amount: unknown) => {
        relay.aaAddress.set(String(aaAddress));
        relay.dappId.set(String(dappId));
        relay.sponsorAmount.set(String(amount || "0.1"));
        await ctx.services.notify.guard(
          () => relay.requestSponsor(),
          "sponsorRequestComplete",
          "sponsorRequestError",
        );
      },
    );

    ctx.framework.actions.register(
      "submitRelay",
      async (aaAddress: unknown, dappId: unknown, payloadJson: unknown) => {
        relay.aaAddress.set(String(aaAddress));
        relay.dappId.set(String(dappId));
        relay.payloadJson.set(String(payloadJson));
        await ctx.services.notify.guard(
          () => relay.submitRelay(),
          "relaySubmitted",
          "relayError",
        );
      },
    );

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
    };
  },
});

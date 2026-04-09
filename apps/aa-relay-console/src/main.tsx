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

    ctx.registerAction(
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

    ctx.registerAction(
      "requestSponsor",
      async (aaAddress: unknown, dappId: unknown) => {
        relay.aaAddress.set(String(aaAddress));
        relay.dappId.set(String(dappId));
        await ctx.services.notify.guard(
          () => relay.requestSponsor(),
          "sponsorRequestComplete",
          "sponsorRequestError",
        );
      },
    );

    ctx.registerAction(
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

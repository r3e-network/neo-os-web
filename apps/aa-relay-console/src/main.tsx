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
      app: ctx.framework,
      t: ctx.t,
    });
    const launchDefaults = getRelayLaunchDefaults(ctx.launchContext);
    if (launchDefaults.aaAddress) relay.aaAddress.set(launchDefaults.aaAddress);
    if (launchDefaults.dappId) relay.dappId.set(launchDefaults.dappId);
    if (launchDefaults.payloadJson) {
      relay.payloadJson.set(launchDefaults.payloadJson);
    }

    ctx.framework.actions.register(
      "prepareReview",
      async (aaAddress: unknown, dappId: unknown, payloadJson: unknown) => {
        relay.aaAddress.set(String(aaAddress));
        relay.dappId.set(String(dappId));
        relay.payloadJson.set(String(payloadJson));
        await ctx.framework.notify.guard(() => relay.prepareReview(), {
          successKey: "reviewPrepared",
          errorKey: "reviewPrepareError",
        });
      },
    );

    ctx.framework.actions.register(
      "checkSponsor",
      async (aaAddress: unknown, dappId: unknown, payloadJson: unknown) => {
        relay.aaAddress.set(String(aaAddress));
        relay.dappId.set(String(dappId));
        relay.payloadJson.set(String(payloadJson));
        await ctx.framework.notify.guard(() => relay.checkSponsor(), {
          successKey: "sponsorCheckComplete",
          errorKey: "sponsorCheckError",
        });
      },
    );

    ctx.framework.actions.register(
      "importReceipt",
      async (receiptJson: unknown) => {
        await ctx.framework.notify.guard(() => relay.importReceipt(String(receiptJson)), {
          successKey: "receiptImported",
          errorKey: "receiptImportError",
        });
      },
    );

    ctx.framework.actions.register(
      "trackReceipt",
      async () => {
        await ctx.framework.notify.guard(() => relay.trackReceipt(), {
          successKey: "receiptRefreshed",
          errorKey: "receiptTrackError",
        });
      },
    );

    ctx.framework.actions.register("clearRelayJob", async () => relay.clearJob());

    return {
      state: {
        aaAddressInput: relay.aaAddress,
        dappIdInput: relay.dappId,
        payloadInput: relay.payloadJson,
        reviewPackageJson: relay.reviewPackageJson,
        reviewJobId: relay.reviewJobId,
        reviewDigest: relay.reviewDigest,
        reviewReadiness: relay.reviewReadiness,
        previewState: relay.previewState,
        targetDisplay: relay.targetDisplay,
        methodDisplay: relay.methodDisplay,
        preparedFingerprint: relay.preparedFingerprint,
        sponsorState: relay.sponsorState,
        sponsorSummary: relay.sponsorSummary,
        relayReceiptJson: relay.relayReceiptJson,
        receiptStatus: relay.receiptStatus,
        txidDisplay: relay.txidDisplay,
        chainStatus: relay.chainStatus,
        chainReason: relay.chainReason,
        confirmationsDisplay: relay.confirmationsDisplay,
        hasReview: relay.hasReview,
        hasReceipt: relay.hasReceipt,
        hasTrackableReceipt: relay.hasTrackableReceipt,
        aaCoreDisplay: relay.aaCoreDisplay,
        paymasterDisplay: relay.paymasterDisplay,
        relayUrlDisplay: relay.relayUrlDisplay,
        networkDisplay: relay.networkDisplay,
        runtimeMode: relay.runtimeMode,
        isPreparing: relay.isPreparing,
        isCheckingSponsorship: relay.isCheckingSponsorship,
        isTracking: relay.isTracking,
      },
      loadData: relay.loadAll,
    };
  },
});

/**
 * Gas Sponsor — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire PlayArea, manifest, messages, and domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGasSponsorApp } from "./composables/useGasSponsor";

defineMiniApp({
  appId: "miniapp-gas-sponsor",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const sponsor = useGasSponsorApp({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    const { notify } = platformServices;

    ctx.registerAction("requestSponsorship", async (amount: string) => {
      sponsor.requestAmount.value = amount;
      notify.info("requestingSponsorship");
      const result = await notify.guard(
        () => sponsor.requestSponsorship(),
        undefined,
        "requestFailed",
      );
      if (result) {
        notify.success("requestSubmitted", {
          id: `${result.request_id.slice(0, 8)}...`,
        });
      }
    });

    ctx.registerAction("donate", async (amount: string) => {
      sponsor.donateAmount.value = amount;
      await notify.guard(
        () => sponsor.handleDonate(),
        "donateSuccess",
        "loadFailed",
      );
    });

    ctx.registerAction("send", async (recipient: string, amount: string) => {
      sponsor.recipientAddress.value = recipient;
      sponsor.sendAmount.value = amount;
      await notify.guard(
        () => sponsor.handleSend(),
        "sendSuccess",
        "loadFailed",
      );
    });

    return {
      state: {
        gasBalance: sponsor.gasBalance,
        isEligible: sponsor.isEligible,
        fuelLevelPercent: sponsor.fuelLevelPercent,
        remainingQuota: sponsor.remainingQuota,
        isRequesting: sponsor.isRequesting,
        requestAmount: sponsor.requestAmount,
        maxRequestAmount: sponsor.maxRequestAmount,
        quickAmounts: sponsor.quickAmounts,
        loading: sponsor.loading,
        userAddress: sponsor.userAddress,
        usedQuota: sponsor.usedQuota,
        dailyLimit: sponsor.dailyLimit,
        quotaPercent: sponsor.quotaPercent,
        resetTime: sponsor.resetTime,
        donateAmount: sponsor.donateAmount,
        sendAmount: sponsor.sendAmount,
        recipientAddress: sponsor.recipientAddress,
        isDonating: sponsor.isDonating,
        isSending: sponsor.isSending,
        tankLevelDisplay: sponsor.tankLevelDisplay,
        gasBalanceDisplay: sponsor.gasBalanceDisplay,
        remainingQuotaDisplay: sponsor.remainingQuotaDisplay,
        eligibleDisplay: sponsor.eligibleDisplay,
      },
      loadData: sponsor.loadAll,
    };
  },
});

/**
 * Gas Sponsor — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGasSponsorApp } from "./composables/useGasSponsor";

defineMiniApp({
  appId: "miniapp-gas-sponsor",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const sponsor = useGasSponsorApp({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    const { notify } = ctx.services;

    ctx.registerAction("requestSponsorship", async (amount: string) => {
      sponsor.requestAmount.set(amount);
      notify.info("requestingSponsorship");
      const result = await notify.guard(
        () => sponsor.requestSponsorship(),
        undefined,
        "requestFailed",
      );
      if (result) {
        const requestId = result.request_id || result.requestId || result.txid || "";
        notify.success("requestSubmitted", {
          id: requestId ? `${requestId.slice(0, 8)}...` : "pending",
        });
      }
    });

    ctx.registerAction("donate", async (amount: string) => {
      sponsor.donateAmount.set(amount);
      await notify.guard(() => sponsor.handleDonate(), "donateSuccess", "donateFailed");
    });

    ctx.registerAction("send", async (recipient: string, amount: string) => {
      sponsor.recipientAddress.set(recipient);
      sponsor.sendAmount.set(amount);
      await notify.guard(() => sponsor.handleSend(), "sendSuccess", "sendFailed");
    });

    return {
      state: refsToObservables({
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
        isFunded: sponsor.isFunded,
        donateAmountValid: sponsor.donateAmountValid,
        recipientValid: sponsor.recipientValid,
        sendAmountValid: sponsor.sendAmountValid,
        canSend: sponsor.canSend,
        tankLevelDisplay: sponsor.tankLevelDisplay,
        gasBalanceDisplay: sponsor.gasBalanceDisplay,
        remainingQuotaDisplay: sponsor.remainingQuotaDisplay,
        eligibleDisplay: sponsor.eligibleDisplay,
      }),
      loadData: sponsor.loadAll,
    };
  },
});

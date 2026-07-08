/**
 * Gas Sponsor — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import { readMiniAppLaunchContext } from "@shared/utils/launch-params";
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
    const app = ctx.framework;
    const sponsor = useGasSponsorApp({
      app,
      t: ctx.t,
      network: readMiniAppLaunchContext("miniapp-gas-sponsor").network,
    });

    ctx.framework.actions.register("requestSponsorship", async (...args: unknown[]) => {
      sponsor.requestAmount.set(String(args[0] ?? ""));
      app.notify.info("requestingSponsorship");
      const result = await app.notify.guard(() => sponsor.requestSponsorship(), {
        errorKey: "requestFailed",
      });
      // The success toast stays conditional on a resolved request (the
      // composable resolves undefined on the ineligible early-return, which
      // must NOT toast) — so it goes through app.notify.success with params
      // rather than an unconditional guard successKey.
      if (result) {
        const requestId = result.request_id || result.requestId || result.txid || "";
        app.notify.success("requestSubmitted", {
          id: requestId ? `${requestId.slice(0, 8)}...` : "pending",
        });
      }
    });

    ctx.framework.actions.register("donate", async (...args: unknown[]) => {
      sponsor.donateAmount.set(String(args[0] ?? ""));
      await app.notify.guard(() => sponsor.handleDonate(), {
        successKey: "donateSuccess",
        errorKey: "donateFailed",
      });
    });

    ctx.framework.actions.register("send", async (...args: unknown[]) => {
      sponsor.recipientAddress.set(String(args[0] ?? ""));
      sponsor.sendAmount.set(String(args[1] ?? ""));
      await app.notify.guard(() => sponsor.handleSend(), {
        successKey: "sendSuccess",
        errorKey: "sendFailed",
      });
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
        poolAddress: sponsor.poolAddress,
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
        chainGasBalanceDisplay: sponsor.chainGasBalanceDisplay,
        serviceAvailable: sponsor.serviceAvailable,
        serviceNotice: sponsor.serviceNotice,
      }),
      loadData: sponsor.loadAll,
    };
  },
});

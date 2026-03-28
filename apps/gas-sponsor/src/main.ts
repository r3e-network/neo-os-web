/**
 * Gas Sponsor — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire PlayArea, manifest, messages, and domain logic.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
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
    const platformServices = PlatformServices.create("miniapp-gas-sponsor", {
      t: ctx.t as (key: string) => string,
    });

    const sponsor = useGasSponsorApp({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    ctx.registerAction("requestSponsorship", async (amount: string) => {
      try {
        sponsor.requestAmount.value = amount;
        ctx.setStatus(ctx.t("requestingSponsorship"), "loading");
        const result = await sponsor.requestSponsorship();
        if (result) {
          ctx.setStatus(ctx.t("requestSubmitted", { id: `${result.request_id.slice(0, 8)}...` }), "success");
        }
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("requestFailed"), "error");
      }
    });

    ctx.registerAction("donate", async (amount: string) => {
      try {
        sponsor.donateAmount.value = amount;
        await sponsor.handleDonate();
        ctx.setStatus(ctx.t("donateSuccess"), "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("loadFailed"), "error");
      }
    });

    ctx.registerAction("send", async (recipient: string, amount: string) => {
      try {
        sponsor.recipientAddress.value = recipient;
        sponsor.sendAmount.value = amount;
        await sponsor.handleSend();
        ctx.setStatus(ctx.t("sendSuccess"), "success");
      } catch (e: unknown) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("loadFailed"), "error");
      }
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
      cleanup: () => platformServices.destroy(),
    };
  },
});

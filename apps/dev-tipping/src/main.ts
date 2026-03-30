/**
 * Dev Tipping — Entry Point (OS Services Pattern)
 *
 * Developer/tip data is read from OS storage (ctx.os.storage) which
 * mirrors the on-chain contract state through edge functions.
 * Tip payments use ctx.os.payment.deposit() instead of direct
 * chain.invokeWithPayment(). Recent tips are loaded via os.storage.list().
 */

import { computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useDevTippingStats } from "./composables/useDevTippingStats";
import { useDevTippingWallet } from "./composables/useDevTippingWallet";

defineMiniApp({
  appId: "miniapp-dev-tipping",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const stats = useDevTippingStats({
      storage: ctx.os.storage,
      t: ctx.t as (
        key: string,
        params?: Record<string, string | number>,
      ) => string,
    });

    const wallet = useDevTippingWallet({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      payment: ctx.os.payment,
      t: ctx.t as (
        key: string,
        params?: Record<string, string | number>,
      ) => string,
    });

    const developerCount = computed(() => stats.developers.value.length);
    const totalDonatedDisplay = computed(() =>
      stats.formatNum(stats.totalDonated.value),
    );
    const recentTipCount = computed(() => stats.recentTips.value.length);

    const { notify } = ctx.services;

    ctx.registerAction("sendTip", async (...args: unknown[]) => {
      const devId = args[0] as number;
      const amount = args[1] as string;
      const message = args[2] as string;
      const tipperName = args[3] as string;
      const anonymous = args[4] as boolean;
      await notify.guard(
        () => wallet.sendTip(devId, amount, message, tipperName, anonymous),
        "tipSent",
      );
    });

    ctx.registerAction("selectDev", async (...args: unknown[]) => {
      const dev = args[0] as { id: number; name: string };
      notify.success("selected");
    });

    return {
      state: {
        developers: stats.developers,
        recentTips: stats.recentTips,
        totalDonated: stats.totalDonated,
        isLoading: wallet.isLoading,
        address: wallet.address,
        developerCount,
        totalDonatedDisplay,
        recentTipCount,
      },

      loadData: async () => {
        await stats.loadDevelopers();
        await stats.loadRecentTips();
      },
    };
  },
});

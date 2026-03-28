/**
 * Dev Tipping — Entry Point (New Pattern)
 */

import { computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useDevTippingStats } from "./composables/useDevTippingStats";
import { useDevTippingWallet } from "./composables/useDevTippingWallet";

const APP_ID = "miniapp-dev-tipping";

defineMiniApp({
  appId: APP_ID,
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create(APP_ID, {
      t: ctx.t as (key: string) => string,
    });

    const stats = useDevTippingStats();
    const wallet = useDevTippingWallet(APP_ID);

    const developerCount = computed(() => stats.developers.value.length);
    const totalDonatedDisplay = computed(() => stats.formatNum(stats.totalDonated.value));
    const recentTipCount = computed(() => stats.recentTips.value.length);

    ctx.registerAction("sendTip", async (...args: unknown[]) => {
      const devId = args[0] as number;
      const amount = args[1] as string;
      const message = args[2] as string;
      const tipperName = args[3] as string;
      const anonymous = args[4] as boolean;
      await wallet.sendTip(devId, amount, message, tipperName, anonymous);
    });

    ctx.registerAction("selectDev", async (...args: unknown[]) => {
      const dev = args[0] as { id: number; name: string };
      wallet.setStatus(`${ctx.t("selected")} ${dev.name}`, "success");
    });

    return {
      state: {
        developers: stats.developers,
        recentTips: stats.recentTips,
        totalDonated: stats.totalDonated,
        isLoading: wallet.isLoading,
        status: wallet.status,
        address: wallet.address,
        developerCount,
        totalDonatedDisplay,
        recentTipCount,
      },

      loadData: async () => {
        await stats.loadDevelopers();
        await stats.loadRecentTips(APP_ID);
      },

      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});

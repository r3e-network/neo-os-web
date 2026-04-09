/**
 * Dev Tipping — Entry Point (React)
 */

import { defineMiniApp, createObservable, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
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
      t: ctx.t as (key: string, params?: Record<string, string | number>) => string,
    });

    const wallet = useDevTippingWallet({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      payment: ctx.os.payment,
      t: ctx.t as (key: string, params?: Record<string, string | number>) => string,
    });

    const developerCount = createObservable(0);
    const totalDonatedDisplay = createObservable("0");
    const recentTipCount = createObservable(0);

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
      notify.success("selected");
    });

    return {
      state: refsToObservables({
        developers: stats.developers,
        recentTips: stats.recentTips,
        totalDonated: stats.totalDonated,
        isLoading: wallet.isLoading,
        address: wallet.address,
        developerCount,
        totalDonatedDisplay,
        recentTipCount,
      }),
      loadData: async () => {
        await stats.loadDevelopers();
        await stats.loadRecentTips();
      },
    };
  },
});

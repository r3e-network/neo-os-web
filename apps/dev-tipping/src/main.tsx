/**
 * Dev Tipping — Entry Point (React)
 *
 * Drives the standalone on-chain contract (MiniAppTipJar) directly via
 * ctx.services.chain. The earlier path read a developer registry from
 * ctx.os.storage that no contract wrote and deposited tips through
 * ctx.os.payment (which moved nothing once the kernel degraded). The registry,
 * tip ledger, and totals are now read straight from chain, and tips/register/
 * withdraw are signed contract calls.
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
    const t = ctx.t as (key: string, params?: Record<string, string | number>) => string;

    const stats = useDevTippingStats({
      chain: ctx.services.chain,
      t,
    });

    const wallet = useDevTippingWallet({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      t,
    });

    const developerCount = createObservable(0);
    const totalDonatedDisplay = createObservable("0 GAS");
    const recentTipCount = createObservable(0);
    // The devId owned by the connected wallet (0 = not registered) and that
    // developer's claimable balance in human GAS — drive the register/withdraw UI.
    const myDeveloperId = createObservable(0);
    const myClaimableBalance = createObservable(0);

    const { notify } = ctx.services;

    const syncMyDeveloper = () => {
      const addr = wallet.address.get();
      const devId = myDeveloperId.get();
      const mine = devId > 0 ? stats.developers.get().find((dev) => dev.id === devId) : undefined;
      myClaimableBalance.set(mine ? mine.balance : 0);
      // Defensive: if the registry resolves the wallet's dev by address but the
      // id lookup hasn't run yet, keep balance consistent with the registry.
      if (devId <= 0 && addr) {
        const byWallet = stats.developers.get().find((dev) => dev.wallet === addr);
        if (byWallet) {
          myDeveloperId.set(byWallet.id);
          myClaimableBalance.set(byWallet.balance);
        }
      }
    };

    const refresh = async () => {
      await stats.loadDevelopers();
      await stats.loadRecentTips();
      developerCount.set(stats.developers.get().length);
      totalDonatedDisplay.set(`${stats.formatNum(stats.totalDonated.get())} GAS`);
      recentTipCount.set(stats.recentTips.get().length);

      const addr = wallet.address.get();
      if (addr) {
        myDeveloperId.set(await stats.developerIdOf(addr));
      } else {
        myDeveloperId.set(0);
      }
      syncMyDeveloper();
    };

    ctx.registerAction("sendTip", async (...args: unknown[]) => {
      const devId = args[0] as number;
      const amount = args[1] as string;
      const message = args[2] as string;
      const tipperName = args[3] as string;
      const anonymous = args[4] as boolean;
      // Surface the guard result so PlayArea can distinguish success (truthy)
      // from failure (undefined) and reset the form only on success.
      const result = await notify.guard(
        () => wallet.sendTip(devId, amount, message, tipperName, anonymous, () => void refresh()),
        "tipSent",
      );
      return result === true;
    });

    ctx.registerAction("registerDeveloper", async (...args: unknown[]) => {
      const name = args[0] as string;
      const role = args[1] as string;
      const result = await notify.guard(
        () => wallet.registerDeveloper(name, role, () => void refresh()),
        "registered",
      );
      // registerDeveloper resolves to the new devId (>0) on success.
      return typeof result === "number" && result > 0;
    });

    ctx.registerAction("withdrawTips", async (...args: unknown[]) => {
      const devId = args[0] as number;
      const result = await notify.guard(
        () => wallet.withdrawTips(devId, () => void refresh()),
        "tipsWithdrawn",
      );
      // withdrawTips resolves to the amount paid (>0) on success.
      return typeof result === "number" && result > 0;
    });

    return {
      state: refsToObservables({
        developers: stats.developers,
        recentTips: stats.recentTips,
        totalDonated: stats.totalDonated,
        isLoading: wallet.isLoading,
        isRegistering: wallet.isRegistering,
        isWithdrawing: wallet.isWithdrawing,
        address: wallet.address,
        developerCount,
        totalDonatedDisplay,
        recentTipCount,
        myDeveloperId,
        myClaimableBalance,
      }),
      loadData: refresh,
    };
  },
});

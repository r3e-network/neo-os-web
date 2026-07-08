/**
 * Dev Tipping — Entry Point (React)
 *
 * Drives the standalone on-chain contract (MiniAppTipJar) directly via the
 * framework chain layer. The earlier path read a developer registry from
 * ctx.os.storage that no contract wrote and deposited tips through
 * ctx.os.payment (which moved nothing once the kernel degraded). The registry,
 * tip ledger, and totals are now read straight from chain, and tips/register/
 * withdraw are signed contract calls.
 */

import { defineMiniApp, createObservable, refsToObservables } from "@shared/react";
import { ownerMatchesAddress } from "@shared/utils/neo";
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
      app: ctx.framework,
      t,
    });

    const wallet = useDevTippingWallet({
      app: ctx.framework,
      t,
    });

    const developerCount = createObservable(0);
    const totalDonatedDisplay = createObservable("0 GAS");
    const recentTipCount = createObservable(0);
    // The devId owned by the connected wallet (0 = not registered) and that
    // developer's claimable balance in human GAS — drive the register/withdraw UI.
    const myDeveloperId = createObservable(0);
    const myClaimableBalance = createObservable(0);
    // Connected wallet's stranded tip credit (human GAS) — drives the reclaim row.
    const myCredit = createObservable(0);
    // Drives the in-card Connect Wallet button's loading state in the Developer
    // Zone (the connect prompt was previously a dead label).
    const isConnecting = createObservable(false);

    const syncMyDeveloper = () => {
      const addr = wallet.address.get();
      const devId = myDeveloperId.get();
      const mine = devId > 0 ? stats.developers.get().find((dev) => dev.id === devId) : undefined;
      myClaimableBalance.set(mine ? mine.balance : 0);
      // Defensive: if the registry resolves the wallet's dev by address but the
      // id lookup hasn't run yet, keep balance consistent with the registry. The
      // developer wallet comes back as a Hash160 ('0x…' hex) while addr is the
      // base58 address — ownerMatchesAddress normalizes both before comparing (a
      // raw `dev.wallet === addr` never matched, so this branch was dead).
      if (devId <= 0 && addr) {
        const byWallet = stats.developers.get().find(
          (dev) => dev.wallet && ownerMatchesAddress(dev.wallet, addr),
        );
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
        myCredit.set(await stats.creditOf(addr));
      } else {
        myDeveloperId.set(0);
        myCredit.set(0);
      }
      syncMyDeveloper();
    };

    // Connect the wallet from the Developer Zone. Reuses the existing wallet
    // connect mechanism (app.chain.ensureWallet — the same path the
    // tip/register/withdraw flows already drive); no new connect logic.
    ctx.framework.actions.register("connect", async () => {
      if (isConnecting.get()) return false;
      isConnecting.set(true);
      try {
        const addr = await ctx.framework.notify.guard(
          () => ctx.framework.chain.ensureWallet(),
          { successKey: "walletConnected", errorKey: "connectFailed" },
        );
        if (addr) await refresh();
        return Boolean(addr);
      } finally {
        isConnecting.set(false);
      }
    });

    ctx.framework.actions.register("sendTip", async (...args: unknown[]) => {
      const devId = args[0] as number;
      const amount = args[1] as string;
      const anonymous = args[2] as boolean;
      // The contract stores no message/tipper name (those inputs were removed);
      // pass empty strings for the composable's UI-only parameters. Surface the
      // guard result so PlayArea resets the form only on success.
      const result = await ctx.framework.notify.guard(
        () => wallet.sendTip(devId, amount, "", "", anonymous, () => void refresh()),
        { successKey: "tipSent" },
      );
      return result === true;
    });

    ctx.framework.actions.register("registerDeveloper", async (...args: unknown[]) => {
      const name = args[0] as string;
      const role = args[1] as string;
      const result = await ctx.framework.notify.guard(
        () => wallet.registerDeveloper(name, role, () => void refresh()),
        { successKey: "registered" },
      );
      // registerDeveloper resolves to the new devId (>0) on success.
      return typeof result === "number" && result > 0;
    });

    ctx.framework.actions.register("withdrawTips", async (...args: unknown[]) => {
      const devId = args[0] as number;
      const result = await ctx.framework.notify.guard(
        () => wallet.withdrawTips(devId, () => void refresh()),
        { successKey: "tipsWithdrawn" },
      );
      // withdrawTips resolves to the amount paid (>0) on success.
      return typeof result === "number" && result > 0;
    });

    ctx.framework.actions.register("withdrawCredit", async () => {
      const result = await ctx.framework.notify.guard(
        () => wallet.withdrawCredit(() => void refresh()),
        { successKey: "creditWithdrawn" },
      );
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
        myCredit,
        isConnecting,
      }),
      loadData: refresh,
    };
  },
});

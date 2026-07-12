/**
 * Neo NS -- React Entry Point (OS Services Pattern)
 *
 * All chain calls target the external NNS contract. The composable
 * receives services directly from the context.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoNS } from "./hooks/useNeoNS";
import type { Domain } from "./hooks/useNeoNS";

defineMiniApp({
  appId: "miniapp-neo-ns",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const ns = useNeoNS({
      app: ctx.framework,
      t: ctx.t,
    });

    // Reload the owned-domain list whenever the connected account changes, so
    // switching wallets in the host no longer strands the previous account's
    // (or empty) list until a write action happens. Debounced to coalesce the
    // connect→address bursts a wallet emits.
    let accountChangeTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribeAddress = ctx.framework.wallet.onAccountChanged(() => {
      ns.handleAccountChanged();
      if (accountChangeTimer) clearTimeout(accountChangeTimer);
      accountChangeTimer = setTimeout(() => {
        void ns.loadAll();
      }, 300);
    });

    ctx.framework.actions.register("searchDomain", async () => {
      const query = (ns.searchQuery.get() as string).trim();
      if (!query) {
        ctx.setStatus(ctx.t("enterDomainNameError"), "error");
        return;
      }
      await ns.searchDomain();
    });

    ctx.framework.actions.register("registerDomain", async () => {
      await ctx.framework.notify.guard(() => ns.registerDomain(), { successKey: "registered" });
    });

    ctx.framework.actions.register("prepareRenew", async (domain: unknown) => {
      if (!domain) return;
      await ctx.framework.notify.guard(() => ns.prepareRenew(domain as Domain));
    });

    ctx.framework.actions.register("handleRenew", async (domain: unknown) => {
      if (!domain) return;
      await ctx.framework.notify.guard(() => ns.renewDomain(domain as Domain), { successKey: "renewed" });
    });

    ctx.framework.actions.register("cancelRenew", async () => {
      ns.cancelRenew();
    });

    ctx.framework.actions.register("recoverPending", async () => {
      await ctx.framework.notify.guard(() => ns.recoverPending(), { successKey: "recovered" });
    });

    ctx.framework.actions.register("copyPendingTxid", async () => {
      const txid = ns.pendingOperation.get()?.txid;
      if (!txid) return;
      await ctx.framework.clipboard.copy(txid, { successKey: "txidCopied", errorKey: "copyFailed" });
    });

    ctx.framework.actions.register("handleSetTarget", async (targetAddress: unknown) => {
      if (!targetAddress || !ns.managingDomain.get()) return;
      await ctx.framework.notify.guard(async () => {
        await ns.setRecord(ns.managingDomain.get()!, String(targetAddress));
        ns.cancelManage();
      }, { successKey: "targetSet" });
    });

    ctx.framework.actions.register("handleTransfer", async (transferAddress: unknown) => {
      if (!transferAddress || !ns.managingDomain.get()) return;
      await ctx.framework.notify.guard(async () => {
        await ns.transferDomain(ns.managingDomain.get()!, String(transferAddress));
        ns.cancelManage();
      }, { successKey: "transferred" });
    });

    ctx.framework.actions.register("showManage", async (domain?: unknown) => {
      if (domain) ns.showManage(domain as Domain);
    });

    ctx.framework.actions.register("cancelManage", async () => {
      ns.cancelManage();
    });

    return {
      state: {
        address: ctx.framework.chain.address,
        domainCount: ns.domainCount,
        walletStatus: ns.walletStatus,
        expiringSoon: ns.expiringSoon,
        myDomains: ns.myDomains,
        domainsStatus: ns.domainsStatus,
        loading: ns.isLoading,
        error: ns.error,
        managingDomain: ns.managingDomain,
        searchQuery: ns.searchQuery,
        searchResult: ns.searchResult,
        isSearching: ns.isSearching,
        registrationCost: ns.registrationCost,
        renewQuote: ns.renewQuote,
        pendingOperation: ns.pendingOperation,
        isRecovering: ns.isRecovering,
        transactionNotice: ns.transactionNotice,
        activeNetwork: ns.activeNetwork,
        activeContract: ns.activeContract,
        recoveryStorageStatus: ns.recoveryStorageStatus,
      },
      loadData: ns.loadAll,
      cleanup: () => {
        ns.cleanup();
        if (accountChangeTimer) clearTimeout(accountChangeTimer);
        unsubscribeAddress?.();
      },
    };
  },
});

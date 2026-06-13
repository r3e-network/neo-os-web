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
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    // Reload the owned-domain list whenever the connected account changes, so
    // switching wallets in the host no longer strands the previous account's
    // (or empty) list until a write action happens. Debounced to coalesce the
    // connect→address bursts a wallet emits.
    let lastAddress = ctx.services.chain.address.get();
    let accountChangeTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribeAddress = ctx.services.chain.address.subscribe(() => {
      const next = ctx.services.chain.address.get();
      if (next === lastAddress) return;
      lastAddress = next;
      if (accountChangeTimer) clearTimeout(accountChangeTimer);
      accountChangeTimer = setTimeout(() => {
        void ns.loadAll();
      }, 300);
    });

    ctx.registerAction("searchDomain", async () => {
      const query = (ns.searchQuery.get() as string).trim();
      if (!query) {
        ctx.setStatus(ctx.t("enterDomainNameError"), "error");
        return;
      }
      ns.searchDomain();
    });

    ctx.registerAction("registerDomain", async () => {
      await ctx.services.notify.guard(() => ns.registerDomain(), "registered");
    });

    ctx.registerAction("fetchRenewPrice", async (domain: unknown) => {
      if (!domain) return 0;
      try {
        return await ns.getRenewPrice(domain as Domain);
      } catch {
        return 0;
      }
    });

    ctx.registerAction("handleRenew", async (domain: unknown) => {
      if (!domain) return;
      await ctx.services.notify.guard(() => ns.renewDomain(domain as Domain), "renewed");
    });

    ctx.registerAction("handleSetTarget", async (targetAddress: unknown) => {
      if (!targetAddress || !ns.managingDomain.get()) return;
      await ctx.services.notify.guard(async () => {
        await ns.setRecord(ns.managingDomain.get()!, String(targetAddress));
        ns.cancelManage();
      }, "targetSet");
    });

    ctx.registerAction("handleTransfer", async (transferAddress: unknown) => {
      if (!transferAddress || !ns.managingDomain.get()) return;
      await ctx.services.notify.guard(async () => {
        await ns.transferDomain(ns.managingDomain.get()!, String(transferAddress));
        ns.cancelManage();
      }, "transferred");
    });

    ctx.registerAction("showManage", async (domain?: unknown) => {
      if (domain) ns.showManage(domain as Domain);
    });

    ctx.registerAction("cancelManage", async () => {
      ns.cancelManage();
    });

    return {
      state: {
        address: ctx.services.chain.address,
        domainCount: ns.domainCount,
        walletStatus: ns.walletStatus,
        expiringSoon: ns.expiringSoon,
        myDomains: ns.myDomains,
        loading: ns.isLoading,
        error: ns.error,
        managingDomain: ns.managingDomain,
        searchQuery: ns.searchQuery,
        searchResult: ns.searchResult,
        isSearching: ns.isSearching,
        registrationCost: ns.registrationCost,
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

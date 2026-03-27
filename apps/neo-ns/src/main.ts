/**
 * Neo NS — Entry Point (New Pattern)
 *
 * Wires the useNeoNS domain composable into the defineMiniApp platform,
 * following the same structure as daily-checkin and explorer:
 *
 *   1. PlatformServices provides chain, balance, events
 *   2. useNeoNS encapsulates all NNS domain logic
 *   3. Actions are registered for operation panel + PlayArea dispatch
 *   4. State keys match manifest valueKeys for stats/sidebar
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoNS } from "./composables/useNeoNS";
import type { Domain } from "./composables/useNeoNS";

defineMiniApp({
  appId: "miniapp-neo-ns",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-neo-ns", {
      t: ctx.t as (key: string) => string,
    });

    const ns = useNeoNS({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    // ── Register actions for operation panel + PlayArea dispatch ──────

    ctx.registerAction("searchDomain", async () => {
      const query = ns.searchQuery.value.trim();
      if (!query) {
        ctx.setStatus(ctx.t("enterDomainName"), "error");
        return;
      }
      ns.searchDomain();
    });

    ctx.registerAction("registerDomain", async () => {
      try {
        await ns.registerDomain();
        ctx.setStatus(ctx.t("registered"), "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("registrationFailed"), "error");
      }
    });

    ctx.registerAction("handleRenew", async (domain?: unknown) => {
      if (!domain) return;
      try {
        await ns.renewDomain(domain as Domain);
        ctx.setStatus(`${(domain as Domain).name} ${ctx.t("renewed")}`, "success");
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("renewalFailed"), "error");
      }
    });

    ctx.registerAction("handleSetTarget", async (targetAddress?: unknown) => {
      if (!targetAddress || !ns.managingDomain.value) return;
      try {
        await ns.setRecord(ns.managingDomain.value, String(targetAddress));
        ctx.setStatus(ctx.t("targetSet"), "success");
        ns.cancelManage();
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("handleTransfer", async (transferAddress?: unknown) => {
      if (!transferAddress || !ns.managingDomain.value) return;
      try {
        await ns.transferDomain(ns.managingDomain.value, String(transferAddress));
        ctx.setStatus(ctx.t("transferred"), "success");
        ns.cancelManage();
      } catch (e) {
        ctx.setStatus(e instanceof Error ? e.message : ctx.t("error"), "error");
      }
    });

    ctx.registerAction("showManage", (domain?: unknown) => {
      if (domain) ns.showManage(domain as Domain);
    });

    ctx.registerAction("cancelManage", () => {
      ns.cancelManage();
    });

    return {
      // ── State bindings ────────────────────────────────────────────
      // Keys match the `valueKey` fields in manifest.ts
      state: {
        // Manifest stat/sidebar bindings
        address: platformServices.chain.address,
        domainCount: ns.domainCount,
        walletStatus: ns.walletStatus,
        expiringSoon: ns.expiringSoon,

        // PlayArea state
        myDomains: ns.myDomains,
        loading: ns.isLoading,
        error: ns.error,
        managingDomain: ns.managingDomain,
        searchQuery: ns.searchQuery,
        searchResult: ns.searchResult,
        isSearching: ns.isSearching,
        registrationCost: ns.registrationCost,
      },

      // ── Lifecycle ─────────────────────────────────────────────────
      loadData: ns.loadAll,

      // ── Cleanup ───────────────────────────────────────────────────
      cleanup: () => {
        ns.cleanup();
        platformServices.destroy();
      },
    };
  },
});

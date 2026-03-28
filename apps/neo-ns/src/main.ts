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
import { registerActions } from "@shared/utils/createActionHandlers";
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

    registerActions(ctx, {
      registerDomain: {
        handler: () => ns.registerDomain(),
        successKey: "registered",
        errorKey: "registrationFailed",
      },
      handleRenew: {
        handler: async (domain: unknown) => {
          if (!domain) return;
          await ns.renewDomain(domain as Domain);
        },
        successKey: "renewed",
        errorKey: "renewalFailed",
      },
      handleSetTarget: {
        handler: async (targetAddress: unknown) => {
          if (!targetAddress || !ns.managingDomain.value) return;
          await ns.setRecord(ns.managingDomain.value, String(targetAddress));
          ns.cancelManage();
        },
        successKey: "targetSet",
        errorKey: "error",
      },
      handleTransfer: {
        handler: async (transferAddress: unknown) => {
          if (!transferAddress || !ns.managingDomain.value) return;
          await ns.transferDomain(ns.managingDomain.value, String(transferAddress));
          ns.cancelManage();
        },
        successKey: "transferred",
        errorKey: "error",
      },
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

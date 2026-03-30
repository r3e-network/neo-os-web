/**
 * Neo NS — Entry Point (OS Services Pattern)
 *
 * All chain calls target the external NNS contract, so they stay on
 * ctx.services.chain. No app-owned contract state to migrate to OS
 * services. The composable receives services directly from the context.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
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
    const ns = useNeoNS({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
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
          await ns.transferDomain(
            ns.managingDomain.value,
            String(transferAddress),
          );
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
        address: ctx.services.chain.address,
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
      },
    };
  },
});

/**
 * Explorer — Entry Point (New Pattern)
 *
 * A READ-ONLY blockchain explorer that displays stats, recent
 * transactions, and provides search functionality. No wallet required.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useExplorer } from "./composables/useExplorer";

defineMiniApp({
  appId: "miniapp-explorer",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-explorer", {
      t: ctx.t as (key: string) => string,
    });

    const explorer = useExplorer({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    // Register actions for PlayArea dispatch
    registerActions(ctx, {
      search: {
        handler: async () => {
          const query = explorer.searchQuery.value.trim();
          if (!query) throw new Error(ctx.t("pleaseEnterQuery"));
          await explorer.search();
        },
        errorKey: "searchFailed",
      },
    });

    ctx.registerAction("viewTx", async (hash?: string) => {
      if (typeof hash === "string") {
        explorer.viewTx(hash);
      }
    });

    return {
      state: {
        // Formatted stats for manifest bindings
        mainnetHeight: explorer.mainnetHeight,
        mainnetTxCount: explorer.mainnetTxCount,
        testnetHeight: explorer.testnetHeight,
        testnetTxCount: explorer.testnetTxCount,
        selectedNetwork: explorer.selectedNetwork,
        recentTxCount: explorer.recentTxCount,

        // PlayArea state
        searchQuery: explorer.searchQuery,
        isLoading: explorer.isLoading,
        isSearching: explorer.isSearching,
        searchResult: explorer.searchResult,
        recentTxs: explorer.recentTxs,
      },

      loadData: explorer.loadAll,

      cleanup: () => {
        explorer.stopPolling();
        platformServices.destroy();
      },
    };
  },
});

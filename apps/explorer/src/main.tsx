/**
 * Explorer — Entry Point (React)
 *
 * A READ-ONLY blockchain explorer that displays stats, recent
 * transactions, and provides search functionality. No wallet required.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useExplorer } from "./composables/useExplorer";

defineMiniApp({
  appId: "miniapp-explorer",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const explorer = useExplorer({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    registerActions(ctx, {
      search: {
        handler: async () => {
          const query = explorer.searchQuery.get().trim();
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
        mainnetHeight: explorer.mainnetHeight,
        mainnetTxCount: explorer.mainnetTxCount,
        testnetHeight: explorer.testnetHeight,
        testnetTxCount: explorer.testnetTxCount,
        selectedNetwork: explorer.selectedNetwork,
        recentTxCount: explorer.recentTxCount,
        searchQuery: explorer.searchQuery,
        isLoading: explorer.isLoading,
        isSearching: explorer.isSearching,
        searchResult: explorer.searchResult,
        recentTxs: explorer.recentTxs,
      },
      loadData: explorer.loadAll,
      cleanup: () => {
        explorer.stopPolling();
      },
    };
  },
});

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
  // Legacy cache namespace: the pre-framework runtime-cache keys were
  // "explorer_stats_cache" / "explorer_txs_cache:<network>", so pin
  // app.storage.local to the same "explorer_" prefix (no orphaned cache).
  storagePrefix: "explorer_",

  setup(ctx) {
    const explorer = useExplorer({
      app: ctx.framework,
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

    ctx.framework.actions.register("viewTx", async (...args: unknown[]) => {
      const [hash] = args;
      if (typeof hash === "string") {
        explorer.viewTx(hash);
      }
    });

    ctx.framework.actions.register("refreshExplorer", async () => {
      await explorer.loadAll();
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
        statsStatus: explorer.statsStatus,
        recentStatus: explorer.recentStatus,
        statsUpdatedAt: explorer.statsUpdatedAt,
      },
      loadData: explorer.loadAll,
      cleanup: () => {
        explorer.stopPolling();
      },
    };
  },
});

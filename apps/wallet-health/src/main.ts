/**
 * wallet-health — Entry Point (OS Services Pattern)
 *
 * Uses OS storage proxy (ctx.os.storage) for persisting the security
 * checklist instead of raw localStorage via runtime-cache.
 * Chain reads against NEO/GAS native contracts remain on ctx.services.chain
 * since those are external protocol contracts, not app-owned state.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useWalletHealth } from "./composables/useWalletHealth";

defineMiniApp({
  appId: "miniapp-wallet-health",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const health = useWalletHealth({
      chain: ctx.services.chain,
      balance: ctx.services.balance,
      eventBus: ctx.services.events,
      storage: ctx.os.storage,
      t: ctx.t,
    });

    // Load persisted checklist from OS storage on mount
    health.loadChecklist();

    // Register actions for PlayArea dispatch
    registerActions(ctx, {
      connectWallet: {
        handler: health.connectWallet,
        errorKey: "walletNotConnected",
      },
      refreshBalances: {
        handler: health.refreshBalances,
        errorKey: "refreshFailed",
      },
    });

    return {
      state: {
        // Core wallet state
        address: health.address,
        isConnected: health.isConnected,
        isRefreshing: health.isRefreshing,

        // Display values for manifest bindings (sidebar/stats)
        connectionStatus: health.connectionStatus,
        networkLabel: health.networkLabel,
        neoDisplay: health.neoDisplay,
        gasDisplay: health.gasDisplay,
        safetyScore: health.safetyScore,

        // Risk indicators
        riskLabel: health.riskLabel,
        riskClass: health.riskClass,
        riskIcon: health.riskIcon,

        // Derived presentation data
        healthStats: health.healthStats,
      },

      loadData: async () => {
        if (health.address.value) {
          await health.refreshBalances();
        }
      },
    };
  },
});

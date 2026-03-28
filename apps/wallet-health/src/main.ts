/**
 * wallet-health — Entry Point (New Pattern)
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import { PlatformServices } from "@shared/services";
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
    const platformServices = PlatformServices.create("miniapp-wallet-health", {
      t: ctx.t as (key: string) => string,
    });

    const health = useWalletHealth({
      t: ctx.t,
    });

    // Load persisted checklist on mount
    health.loadChecklist();

    // Register actions for PlayArea dispatch
    registerActions(ctx, {
      connectWallet: { handler: health.connectWallet, errorKey: "walletNotConnected" },
      refreshBalances: { handler: health.refreshBalances, errorKey: "refreshFailed" },
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

      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});

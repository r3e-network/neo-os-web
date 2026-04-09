/**
 * wallet-health — Entry Point (React / OS Services Pattern)
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea";
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
        address: health.address,
        isConnected: health.isConnected,
        isRefreshing: health.isRefreshing,
        connectionStatus: health.connectionStatus,
        networkLabel: health.networkLabel,
        neoDisplay: health.neoDisplay,
        gasDisplay: health.gasDisplay,
        safetyScore: health.safetyScore,
        riskLabel: health.riskLabel,
        riskClass: health.riskClass,
        riskIcon: health.riskIcon,
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

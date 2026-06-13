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
      targetNetwork: ctx.launchContext.network,
      t: ctx.t,
    });

    // Load persisted checklist from OS storage on mount
    health.loadChecklist();

    // If the wallet connects via the host AFTER the app is open, the data
    // loaders (mount-only) would leave balances and the auto gas check at 0.
    // Refresh when the address transitions from empty to set (mirrors
    // neo-treasury's address sync).
    let lastAddress = ctx.services.chain.address.get() ?? "";
    const stopAddressSync = ctx.services.chain.address.subscribe(() => {
      const next = ctx.services.chain.address.get() ?? "";
      if (next && next !== lastAddress) {
        void health.refreshBalances();
      }
      lastAddress = next;
    });

    registerActions(ctx, {
      connectWallet: {
        handler: health.connectWallet,
        errorKey: "walletNotConnected",
      },
      refreshBalances: {
        handler: health.refreshBalances,
        errorKey: "refreshFailed",
      },
      toggleChecklist: {
        handler: (...args: unknown[]) => {
          const [id] = args;
          if (typeof id === "string") {
            health.toggleChecklist(id);
          }
        },
        errorKey: "error",
      },
    });

    // Copy via the shared ClipboardService so we keep its execCommand fallback
    // (which matters inside the sandboxed iframe) and its standardized toast
    // channel, instead of a raw navigator.clipboard call that throws when
    // unavailable. The successKey localizes the toast per copy kind.
    ctx.registerAction("copy", async (...args: unknown[]) => {
      const text = typeof args[0] === "string" ? args[0] : "";
      const successKey = typeof args[1] === "string" ? args[1] : "copied";
      if (!text) return false;
      return ctx.services.clipboard.copy(text, successKey);
    });

    return {
      state: {
        address: health.address,
        isConnected: health.isConnected,
        isConnecting: health.isConnecting,
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
        checklistItems: health.checklistItems,
        completedChecklistCount: health.completedChecklistCount,
        totalChecklistCount: health.totalChecklistCount,
        recommendations: health.recommendations,
      },
      loadData: async () => {
        if (health.address.value) {
          await health.refreshBalances();
        }
      },
      cleanup: stopAddressSync,
    };
  },
});

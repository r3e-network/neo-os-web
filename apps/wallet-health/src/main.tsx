/**
 * wallet-health — Entry Point (React / OS Services Pattern)
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useWalletHealth } from "./composables/useWalletHealth";

defineMiniApp({
  appId: "miniapp-wallet-health",
  playArea: PlayArea,
  manifest,
  messages,
  // Legacy namespace for app.storage.local: the checklist persisted under the
  // raw "miniapp-wallet-health:checklist" localStorage key before the
  // framework migration — keep the key byte-identical so user data survives.
  storagePrefix: "miniapp-wallet-health:",

  setup(ctx) {
    const health = useWalletHealth({
      app: ctx.framework,
      targetNetwork: ctx.launchContext.network,
      t: ctx.t,
    });

    // Load persisted checklist from device-local storage on mount
    health.loadChecklist();

    // If the wallet connects via the host AFTER the app is open, the data
    // loaders (mount-only) would leave balances and the auto gas check at 0.
    // Refresh when the address actually changes — the framework hook carries
    // the identity diff (RFC P0-5), replacing the hand-rolled lastAddress
    // bookkeeping this entry point used to maintain.
    const stopAddressSync = ctx.framework.wallet.onAccountChanged(({ current }) => {
      health.handleAddressChange(current);
      if (current) void health.refreshBalances().catch(() => undefined);
    });

    ctx.framework.actions.register("connectWallet", health.connectWallet, {
      errorKey: "walletNotConnected",
    });
    ctx.framework.actions.register("refreshBalances", health.refreshBalances, {
      errorKey: "refreshFailed",
    });
    ctx.framework.actions.register("toggleChecklist", async (...args: unknown[]) => {
      const [id] = args;
      if (typeof id === "string") health.toggleChecklist(id);
    }, {
      errorKey: "error",
    });

    // Copy via app.clipboard so we keep the execCommand fallback (which
    // matters inside the sandboxed iframe) and the standardized toast
    // channel, instead of a raw navigator.clipboard call that throws when
    // unavailable. The successKey localizes the toast per copy kind.
    ctx.framework.actions.register("copy", async (...args: unknown[]) => {
      const text = typeof args[0] === "string" ? args[0] : "";
      const successKey = typeof args[1] === "string" ? args[1] : "copied";
      if (!text) return false;
      return ctx.framework.clipboard.copy(text, { successKey });
    });

    return {
      state: {
        address: health.address,
        isConnected: health.isConnected,
        isConnecting: health.isConnecting,
        isRefreshing: health.isRefreshing,
        dataStatus: health.dataStatus,
        lastUpdatedAt: health.lastUpdatedAt,
        lastError: health.lastError,
        neoObservedAt: health.neoObservedAt,
        gasObservedAt: health.gasObservedAt,
        neoReadStatus: health.neoReadStatus,
        gasReadStatus: health.gasReadStatus,
        networkReadStatus: health.networkReadStatus,
        walletNetworkLabel: health.walletNetworkLabel,
        networkMismatch: health.networkMismatch,
        connectionStatus: health.connectionStatus,
        networkLabel: health.networkLabel,
        neoDisplay: health.neoDisplay,
        gasDisplay: health.gasDisplay,
        safetyScore: health.safetyScore,
        riskLabel: health.riskLabel,
        riskClass: health.riskClass,
        riskIcon: health.riskIcon,
        storageAvailable: health.storageAvailable,
        healthStats: health.healthStats,
        checklistItems: health.checklistItems,
        completedChecklistCount: health.completedChecklistCount,
        totalChecklistCount: health.totalChecklistCount,
        recommendations: health.recommendations,
      },
      loadData: async () => {
        if (health.address.get()) {
          await health.refreshBalances();
        }
      },
      cleanup: stopAddressSync,
    };
  },
});

/**
 * useWalletHealth — Orchestrating composable for the Wallet Health miniapp.
 *
 * Combines useWalletAnalysis (chain data, balances) and useHealthScore
 * (security checklist, review progress) into a single API surface, including
 * all derived/formatted state that PlayArea.tsx needs.
 *
 * Receives the MiniApp framework SDK (ctx.framework): balances and wallet
 * identity go through app.wallet, checklist persistence goes through
 * app.storage.local (under the app's legacy storagePrefix so existing user
 * data keeps resolving).
 */

import { createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { useWalletAnalysis } from "./useWalletAnalysis";
import { useHealthScore } from "./useHealthScore";
import type { MiniAppLaunchNetwork } from "@shared/utils/launch-params";

export interface HealthStat {
  label: string;
  value: string;
}

export interface UseWalletHealthOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  targetNetwork?: MiniAppLaunchNetwork | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useWalletHealth({ app, targetNetwork, t }: UseWalletHealthOptions) {
  const analysis = useWalletAnalysis({ app, targetNetwork, t });
  const isConnected = createDerived(() => Boolean(analysis.address.get()), [analysis.address]);
  const hasAnyBalanceEvidence = createDerived(
    () => isConnected.get() && (
      analysis.neoObservedAt.get() > 0 || analysis.gasObservedAt.get() > 0
    ),
    [isConnected, analysis.neoObservedAt, analysis.gasObservedAt],
  );
  const hasCurrentGasEvidence = createDerived(
    () => analysis.gasReadStatus.get() === "zero" || analysis.gasReadStatus.get() === "pass",
    [analysis.gasReadStatus],
  );
  const health = useHealthScore(analysis.gasOk, hasCurrentGasEvidence, app.storage.local);

  // ── Formatted display values ─────────────────────────────────────────
  const connectionStatus = createDerived(
    () => analysis.address.get() ? t("statusConnected") : t("statusDisconnected"),
    [analysis.address],
  );
  const networkLabel = createDerived(() => {
    if (targetNetwork === "testnet") return "Neo N3 TestNet";
    if (targetNetwork === "mainnet") return "Neo N3 MainNet";
    return "Neo N3";
  }, []);

  // Balances are em-dashes until a successful read so the internal 0/0.0000
  // defaults never masquerade as observed chain data after connection/RPC error.
  const neoStatDisplay = createDerived(
    () => (analysis.neoObservedAt.get() > 0 ? analysis.neoDisplay.get() : "—"),
    [analysis.neoObservedAt, analysis.neoDisplay],
  );
  const gasStatDisplay = createDerived(
    () => (analysis.gasObservedAt.get() > 0 ? analysis.gasDisplay.get() : "—"),
    [analysis.gasObservedAt, analysis.gasDisplay],
  );

  const recommendations = createDerived<string[]>(() => {
    const items = [...health.recommendations.get()];
    if (analysis.networkMismatch.get()) {
      items.unshift(t("recommendationNetworkMismatch", {
        expected: networkLabel.get(),
        actual: analysis.walletNetworkLabel.get(),
      }));
    } else if (
      isConnected.get() &&
      analysis.lastUpdatedAt.get() > 0 &&
      analysis.networkReadStatus.get() === "unknown"
    ) {
      items.unshift(t("recommendationNetworkUnknown"));
    } else if (
      isConnected.get() &&
      analysis.networkReadStatus.get() === "failed"
    ) {
      items.unshift(t("recommendationNetworkReadFailed"));
    }
    return items;
  }, [
    health.recommendations,
    analysis.networkMismatch,
    analysis.networkReadStatus,
    analysis.walletNetworkLabel,
    analysis.lastUpdatedAt,
    isConnected,
    networkLabel,
  ]);

  // ── Health stats array for the dashboard grid ────────────────────────
  const healthStats = createDerived<HealthStat[]>(
    () => [
      { label: t("statConnection"), value: connectionStatus.get() },
      { label: t("statTargetNetwork"), value: networkLabel.get() },
      { label: t("statWalletNetwork"), value: analysis.walletNetworkLabel.get() },
      { label: t("statNeo"), value: neoStatDisplay.get() },
      { label: t("statGas"), value: gasStatDisplay.get() },
      { label: t("statScore"), value: `${health.safetyScore.get()}%` },
    ],
    [
      connectionStatus,
      networkLabel,
      analysis.walletNetworkLabel,
      neoStatDisplay,
      gasStatDisplay,
      health.safetyScore,
    ],
  );

  return {
    // From useWalletAnalysis
    address: analysis.address,
    isRefreshing: analysis.isRefreshing,
    isConnecting: analysis.isConnecting,
    dataStatus: analysis.dataStatus,
    lastUpdatedAt: analysis.lastUpdatedAt,
    lastError: analysis.lastError,
    neoObservedAt: analysis.neoObservedAt,
    gasObservedAt: analysis.gasObservedAt,
    neoReadStatus: analysis.neoReadStatus,
    gasReadStatus: analysis.gasReadStatus,
    networkReadStatus: analysis.networkReadStatus,
    walletNetworkLabel: analysis.walletNetworkLabel,
    networkMismatch: analysis.networkMismatch,
    // Connection-gated so the hero/strip show "—" (not 0) while disconnected.
    neoDisplay: neoStatDisplay,
    gasDisplay: gasStatDisplay,
    refreshBalances: analysis.refreshBalances,
    connectWallet: analysis.connectWallet,
    handleAddressChange: analysis.handleAddressChange,

    // From useHealthScore
    safetyScore: health.safetyScore,
    riskLabel: health.riskLabel,
    riskClass: health.riskClass,
    riskIcon: health.riskIcon,
    storageAvailable: health.storageAvailable,
    checklistItems: health.checklistItems,
    completedChecklistCount: health.completedChecklistCount,
    totalChecklistCount: health.totalChecklistCount,
    recommendations,
    loadChecklist: health.loadChecklist,
    toggleChecklist: health.toggleChecklist,

    // Derived / formatted
    connectionStatus,
    networkLabel,
    isConnected,
    hasAnyBalanceEvidence,
    healthStats,
  };
}

/**
 * useWalletHealth — Orchestrating composable for the Wallet Health miniapp.
 *
 * Combines useWalletAnalysis (chain data, balances) and useHealthScore
 * (security checklist, safety score) into a single API surface, including
 * all derived/formatted state that PlayArea.vue needs.
 *
 * Receives ChainService + BalanceService + EventBus from PlatformServices
 * and StorageProxy from OS services. Chain reads against NEO/GAS native
 * contracts stay on ChainService (external). Checklist persistence uses
 * OS storage instead of raw localStorage.
 */

import { createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, BalanceService, EventBus } from "@shared/services";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { useWalletAnalysis } from "./useWalletAnalysis";
import { useHealthScore } from "./useHealthScore";

export interface HealthStat {
  label: string;
  value: string;
}

export interface UseWalletHealthOptions {
  chain: ChainService;
  balance: BalanceService;
  eventBus: EventBus;
  storage: StorageProxy;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useWalletHealth({ chain, balance, eventBus, storage, t }: UseWalletHealthOptions) {
  const analysis = useWalletAnalysis({ chain, balance, eventBus, t });
  const health = useHealthScore(analysis.gasOk, storage);

  // ── Formatted display values ─────────────────────────────────────────
  const connectionStatus = createDerived(
    () => analysis.address.get() ? t("statusConnected") : t("statusDisconnected"),
    [analysis.address],
  );
  const networkLabel = createDerived(() => "Neo N3", []);
  const isConnected = createDerived(() => Boolean(analysis.address.get()), [analysis.address]);

  // ── Health stats array for the dashboard grid ────────────────────────
  const healthStats = createDerived<HealthStat[]>(
    () => [
      { label: t("statConnection"), value: connectionStatus.get() },
      { label: t("statNetwork"), value: networkLabel.get() },
      { label: t("statNeo"), value: analysis.neoDisplay.get() },
      { label: t("statGas"), value: analysis.gasDisplay.get() },
      { label: t("statScore"), value: `${health.safetyScore.get()}%` },
    ],
    [
      connectionStatus,
      networkLabel,
      analysis.neoDisplay,
      analysis.gasDisplay,
      health.safetyScore,
    ],
  );

  return {
    // From useWalletAnalysis
    address: analysis.address,
    isRefreshing: analysis.isRefreshing,
    neoDisplay: analysis.neoDisplay,
    gasDisplay: analysis.gasDisplay,
    refreshBalances: analysis.refreshBalances,
    connectWallet: analysis.connectWallet,

    // From useHealthScore
    safetyScore: health.safetyScore,
    riskLabel: health.riskLabel,
    riskClass: health.riskClass,
    riskIcon: health.riskIcon,
    checklistItems: health.checklistItems,
    completedChecklistCount: health.completedChecklistCount,
    totalChecklistCount: health.totalChecklistCount,
    recommendations: health.recommendations,
    loadChecklist: health.loadChecklist,
    toggleChecklist: health.toggleChecklist,

    // Derived / formatted
    connectionStatus,
    networkLabel,
    isConnected,
    healthStats,
  };
}

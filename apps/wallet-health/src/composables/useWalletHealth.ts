/**
 * useWalletHealth — Orchestrating composable for the Wallet Health miniapp.
 *
 * Combines useWalletAnalysis (chain data, balances) and useHealthScore
 * (security checklist, safety score) into a single API surface, including
 * all derived/formatted state that PlayArea.vue needs.
 *
 * Receives ChainService + BalanceService + EventBus from PlatformServices
 * instead of relying on legacy useWallet/useContractInteraction.
 */

import { computed } from "vue";
import type { ChainService, BalanceService, EventBus } from "@shared/services";
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
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useWalletHealth({ chain, balance, eventBus, t }: UseWalletHealthOptions) {
  const analysis = useWalletAnalysis({ chain, balance, eventBus, t });
  const health = useHealthScore(analysis.gasOk);

  // ── Formatted display values ─────────────────────────────────────────
  const connectionStatus = computed(() =>
    analysis.address.value ? t("statusConnected") : t("statusDisconnected"),
  );
  const networkLabel = computed(() => "Neo N3");
  const isConnected = computed(() => Boolean(analysis.address.value));

  // ── Health stats array for the dashboard grid ────────────────────────
  const healthStats = computed<HealthStat[]>(() => [
    { label: t("statConnection"), value: connectionStatus.value },
    { label: t("statNetwork"), value: networkLabel.value },
    { label: t("statNeo"), value: analysis.neoDisplay.value },
    { label: t("statGas"), value: analysis.gasDisplay.value },
    { label: t("statScore"), value: `${health.safetyScore.value}%` },
  ]);

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

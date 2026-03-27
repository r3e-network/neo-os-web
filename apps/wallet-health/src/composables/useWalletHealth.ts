/**
 * useWalletHealth — Orchestrating composable for the Wallet Health miniapp.
 *
 * Combines useWalletAnalysis (chain data, balances) and useHealthScore
 * (security checklist, safety score) into a single API surface, including
 * all derived/formatted state that PlayArea.vue needs.
 */

import { computed } from "vue";
import { useWalletAnalysis } from "./useWalletAnalysis";
import { useHealthScore } from "./useHealthScore";

export interface HealthStat {
  label: string;
  value: string;
}

export function useWalletHealth(deps: {
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const { t } = deps;

  const analysis = useWalletAnalysis();
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
    status: analysis.status,
    setStatus: analysis.setStatus,

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

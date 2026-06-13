/**
 * useWalletHealth — Orchestrating composable for the Wallet Health miniapp.
 *
 * Combines useWalletAnalysis (chain data, balances) and useHealthScore
 * (security checklist, safety score) into a single API surface, including
 * all derived/formatted state that PlayArea.vue needs.
 *
 * Receives ChainService + BalanceService + EventBus from PlatformServices
 * and StorageProxy from OS services. Chain reads against NEO/GAS native
 * contracts stay on ChainService (external). Checklist persistence is
 * synchronous and device-local via the runtime cache under an app-namespaced
 * key (see useHealthScore); StorageProxy is wired through for API parity.
 */

import { createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, BalanceService, EventBus } from "@shared/services";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import { useWalletAnalysis } from "./useWalletAnalysis";
import { useHealthScore } from "./useHealthScore";
import type { MiniAppLaunchNetwork } from "@shared/utils/launch-params";

export interface HealthStat {
  label: string;
  value: string;
}

export interface UseWalletHealthOptions {
  chain: ChainService;
  balance: BalanceService;
  eventBus: EventBus;
  storage: StorageProxy;
  targetNetwork?: MiniAppLaunchNetwork | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useWalletHealth({ chain, balance, eventBus, storage, targetNetwork, t }: UseWalletHealthOptions) {
  const analysis = useWalletAnalysis({ chain, balance, eventBus, t });
  const isConnected = createDerived(() => Boolean(analysis.address.get()), [analysis.address]);
  const health = useHealthScore(analysis.gasOk, isConnected, storage);

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

  // Balances are em-dashes while disconnected so the 0/0.0000 defaults don't
  // read as real zero balances.
  const neoStatDisplay = createDerived(
    () => (isConnected.get() ? analysis.neoDisplay.get() : "—"),
    [isConnected, analysis.neoDisplay],
  );
  const gasStatDisplay = createDerived(
    () => (isConnected.get() ? analysis.gasDisplay.get() : "—"),
    [isConnected, analysis.gasDisplay],
  );

  // ── Health stats array for the dashboard grid ────────────────────────
  const healthStats = createDerived<HealthStat[]>(
    () => [
      { label: t("statConnection"), value: connectionStatus.get() },
      { label: t("statNetwork"), value: networkLabel.get() },
      { label: t("statNeo"), value: neoStatDisplay.get() },
      { label: t("statGas"), value: gasStatDisplay.get() },
      { label: t("statScore"), value: `${health.safetyScore.get()}%` },
    ],
    [
      connectionStatus,
      networkLabel,
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
    // Connection-gated so the hero/strip show "—" (not 0) while disconnected.
    neoDisplay: neoStatDisplay,
    gasDisplay: gasStatDisplay,
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

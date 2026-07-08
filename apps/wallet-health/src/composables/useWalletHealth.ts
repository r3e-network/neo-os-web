/**
 * useWalletHealth — Orchestrating composable for the Wallet Health miniapp.
 *
 * Combines useWalletAnalysis (chain data, balances) and useHealthScore
 * (security checklist, safety score) into a single API surface, including
 * all derived/formatted state that PlayArea.vue needs.
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
  const analysis = useWalletAnalysis({ app, t });
  const isConnected = createDerived(() => Boolean(analysis.address.get()), [analysis.address]);
  const health = useHealthScore(analysis.gasOk, isConnected, app.storage.local);

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

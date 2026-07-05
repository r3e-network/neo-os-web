import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../wallet-health/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    healthSummary: "Health Summary",
    connectToScore: "Connect to score",
    diagnosticStageTitle: "Live diagnostic run",
    diagnosticStageCopy: "Check your wallet health.",
    diagnosticStatusIdle: "Ready to scan",
    diagnosticStatusReady: "Diagnostics ready",
    diagnosticStatusScanning: "Scanning wallet",
    connectHint: "Connect your wallet to refresh live balances.",
    copyReport: "Copy report",
    copyAddress: "Copy address",
    addressCopied: "Address copied",
    reportCopied: "Report copied",
    balanceStripTitle: "Balance and connection",
    riskLabel: "Risk",
    checklistProgress: "{completed}/{total} complete",
    allSet: "All checks look good",
    diagnosticReportStep: "Report",
    sectionChecklist: "Safety Checklist",
    sectionRecommendations: "Recommendations",
    recommendationsTitle: "Next actions",
    networkReadiness: "Network readiness",
    refresh: "Refresh",
    statusConnected: "Connected",
    statusDisconnected: "Disconnected",
    notConnected: "Not connected",
    noChecklistItems: "No checklist items available",
    reportTitle: "Wallet Health Report",
    reportGeneratedAt: "Generated at",
    walletAddress: "Wallet address",
    statNetwork: "Network",
    statScore: "Safety Score",
    statNeo: "NEO Balance",
    statGas: "GAS Balance",
    reportChecklist: "Checklist",
    reportDone: "DONE",
    reportPending: "PENDING",
    checklistConnectToCheck: "Connect to check",
  };
  return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ""));
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    address: "",
    isConnected: false,
    isConnecting: false,
    isRefreshing: false,
    connectionStatus: "Disconnected",
    networkLabel: "Neo N3",
    neoDisplay: "-",
    gasDisplay: "-",
    safetyScore: 0,
    riskLabel: "High risk",
    riskClass: "risk-high",
    completedChecklistCount: 0,
    totalChecklistCount: 5,
    checklistItems: [
      { id: "backup", title: "Backup phrase stored", desc: "Store your seed phrase offline.", done: false, auto: false },
    ],
    healthStats: [],
    recommendations: ["Backup your seed phrase immediately."],
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("wallet-health integration", () => {
  it("fires the wallet connect action from the primary CTA while disconnected", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("connectWallet"));
  });

  it("exposes refresh and copy address actions once connected", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(<PlayArea t={t} state={state({
      isConnected: true,
      address: "Nabc1234567890",
      connectionStatus: "Connected",
    })} dispatch={dispatch} />);

    fireEvent.click(getByRole("button", { name: /Refresh/i }));
    fireEvent.click(getByRole("button", { name: /Copy address/i }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("refreshBalances");
      expect(dispatch).toHaveBeenCalledWith("copy", "Nabc1234567890", "addressCopied");
    });
  });
});

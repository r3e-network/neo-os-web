import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../wallet-health/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    title: "Wallet Checkup",
    diagnosticStageCopy: "Read-only wallet checkup.",
    diagnosticStatusIdle: "Wallet data not read",
    diagnosticStatusReady: "Read-only check complete",
    diagnosticStatusScanning: "Reading balances",
    diagnosticStatusPartial: "Check complete with missing data",
    diagnosticStatusError: "Read failed — retry safely",
    diagnosticStatusNetworkMismatch: "Balances read — network needs attention",
    connectToScore: "Connect wallet",
    connectHint: "Connect to read balances.",
    copyReport: "Copy report",
    copyAddress: "Copy address",
    addressCopied: "Address copied",
    reportCopied: "Report copied",
    balanceStripTitle: "Balances",
    reviewProgress: "Review progress",
    reviewNotStarted: "Not started",
    riskLabel: "Self-check status",
    checklistProgress: "{completed}/{total} complete",
    scoreSelfAssessCaption: "Progress, not a security rating.",
    allSet: "Self-check complete",
    diagnosticReportStep: "Report",
    sectionRecommendations: "Recommendations",
    recommendationsTitle: "Next actions",
    networkReadiness: "Network readiness",
    refreshBalances: "Refresh balances",
    retry: "Retry",
    statusConnected: "Connected",
    statusDisconnected: "Disconnected",
    notConnected: "Not connected",
    reportTitle: "Wallet Checkup Report",
    reportDisclaimer: "This is not a wallet audit.",
    reportGeneratedAt: "Generated at",
    walletAddress: "Wallet address",
    statNetwork: "Network",
    statTargetNetwork: "Balance network",
    statWalletNetwork: "Wallet network",
    statScore: "Review progress",
    statNeo: "NEO Balance",
    statGas: "GAS Balance",
    reportChecklist: "Checklist",
    reportDone: "CONFIRMED",
    reportPending: "NOT CONFIRMED",
    checklistConnectToCheck: "Connect to check",
    selfReported: "Self-confirmed",
    reserveAvailable: "Available",
    reserveLow: "Below 0.1 GAS",
    reserveZero: "Confirmed zero GAS",
    checkUnknown: "Unknown",
    checkReading: "Reading",
    checkFailed: "Read failed",
    checkFailedPrevious: "Read failed · previous value shown",
    checkZero: "Confirmed zero",
    checkPass: "Read successfully",
    networkMismatch: "Does not match",
    networkMismatchDetail: "Wallet reports {actual}; balances are read on {expected}.",
    networkReadFailedDetail: "Balances read, network detection failed.",
    networkUnknownDetail: "Wallet network is unknown.",
    selfCheckTitle: "Private self-check",
    moreChecks: "More self-checks ({count})",
    privacyTitle: "Privacy boundary",
    privacyCopy: "Checklist stays local.",
    readOnlyBadge: "Read-only",
    localOnlyBadge: "Checklist stays local",
    scannerArtAlt: "Wallet with shield",
    evidenceTitle: "What this tool can verify",
    evidenceConnection: "Wallet connection",
    evidenceWalletNetwork: "Connected wallet network",
    evidenceBalances: "NEO and GAS balances",
    evidenceGasReserve: "0.1 GAS reserve",
    verified: "Verified",
    notRead: "Not read",
    unavailableTitle: "Not automatically checked",
    unavailableCopy: "Private keys and devices require review.",
    lastUpdated: "Last read",
    previousRead: "Previous successful read",
    moreActions: "{count} more in report",
  };
  return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ""));
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    address: "",
    isConnected: false,
    isConnecting: false,
    isRefreshing: false,
    dataStatus: "disconnected",
    lastUpdatedAt: 0,
    lastError: "",
    neoObservedAt: 0,
    gasObservedAt: 0,
    neoReadStatus: "unknown",
    gasReadStatus: "unknown",
    networkReadStatus: "unknown",
    walletNetworkLabel: "—",
    networkMismatch: false,
    storageAvailable: true,
    connectionStatus: "Disconnected",
    networkLabel: "Neo N3",
    neoDisplay: "—",
    gasDisplay: "—",
    safetyScore: 0,
    riskLabel: "Not started",
    completedChecklistCount: 0,
    totalChecklistCount: 5,
    checklistItems: [
      { id: "backup", title: "Recovery backup", desc: "Stored offline", done: false, auto: false },
    ],
    healthStats: [],
    recommendations: ["Create an offline backup."],
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("wallet-health integration", () => {
  it("fires the wallet connect action from the primary CTA while disconnected", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(getByRole("button", { name: "Connect wallet" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("connectWallet"));
  });

  it("keeps refresh primary and address copy inside the report drawer", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(<PlayArea t={t} state={state({
      isConnected: true,
      dataStatus: "fresh",
      lastUpdatedAt: Date.now(),
      neoObservedAt: Date.now(),
      gasObservedAt: Date.now(),
      neoReadStatus: "pass",
      gasReadStatus: "pass",
      networkReadStatus: "pass",
      walletNetworkLabel: "Neo N3 MainNet",
      address: "Nabc1234567890",
      connectionStatus: "Connected",
      neoDisplay: "4",
      gasDisplay: "0.5",
    })} dispatch={dispatch} />);

    fireEvent.click(getByRole("button", { name: "Refresh balances" }));
    fireEvent.click(getByRole("button", { name: "Report" }));
    fireEvent.click(getByRole("button", { name: "Copy address" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("refreshBalances");
      expect(dispatch).toHaveBeenCalledWith("copy", "Nabc1234567890", "addressCopied");
    });
  });

  it("routes a connected read error back through the safe refresh action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getAllByRole } = render(<PlayArea t={t} state={state({
      isConnected: true,
      address: "Nabc1234567890",
      connectionStatus: "Connected",
      dataStatus: "error",
      lastError: "RPC temporarily unavailable",
    })} dispatch={dispatch} />);

    fireEvent.click(getAllByRole("button", { name: "Retry" })[0]!);
    expect(dispatch).toHaveBeenCalledWith("refreshBalances");
  });
});

import { existsSync, readFileSync, statSync } from "node:fs";
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../wallet-health/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    title: "Wallet Checkup",
    healthSummary: "Wallet Checkup",
    connectToScore: "Connect wallet",
    diagnosticStageCopy: "Read balances without sending a transaction.",
    diagnosticStatusIdle: "Wallet data not read",
    diagnosticStatusReady: "Read-only check complete",
    diagnosticStatusScanning: "Reading balances",
    diagnosticStatusPartial: "Check complete with missing data",
    diagnosticStatusError: "Read failed — retry safely",
    diagnosticStatusNetworkMismatch: "Balances read — network needs attention",
    connectHint: "Connect to read NEO and GAS balances.",
    copyReport: "Copy report",
    copyAddress: "Copy address",
    addressCopied: "Address copied",
    reportCopied: "Report copied",
    balanceStripTitle: "Balances",
    riskLabel: "Self-check status",
    reviewProgress: "Review progress",
    reviewNotStarted: "Not started",
    checklistProgress: "{completed}/{total} complete",
    scoreSelfAssessCaption: "Checklist progress, not a security rating.",
    allSet: "Self-check complete",
    diagnosticReportStep: "Report",
    sectionChecklist: "Safety checklist",
    sectionRecommendations: "Recommendations",
    recommendationsTitle: "Next actions",
    networkReadiness: "Network readiness",
    refreshBalances: "Refresh balances",
    retry: "Retry",
    statusConnected: "Connected",
    statusDisconnected: "Disconnected",
    notConnected: "Not connected",
    reportTitle: "Wallet Checkup Report",
    reportDisclaimer: "This is not a wallet audit or guarantee of safety.",
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
    privacyCopy: "Checklist choices stay in this browser.",
    storageUnavailable: "Local progress could not be saved.",
    readOnlyBadge: "Read-only",
    localOnlyBadge: "Checklist stays local",
    scannerArtAlt: "Transparent Neo wallet with a shield",
    evidenceTitle: "What this tool can verify",
    evidenceConnection: "Wallet connection",
    evidenceWalletNetwork: "Connected wallet network",
    evidenceBalances: "NEO and GAS balances",
    evidenceGasReserve: "0.1 GAS reserve",
    verified: "Verified",
    notRead: "Not read",
    unavailableTitle: "Not automatically checked",
    unavailableCopy: "Private keys, approvals, devices, and malware require your own review.",
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
      { id: "backup", title: "Recovery backup stored offline", desc: "Store it offline.", done: false, auto: false },
      { id: "gas", title: "Keep GAS for fees", desc: "Connect to check.", done: false, auto: true, pending: true },
      { id: "permissions", title: "I reviewed connected apps", desc: "Review in your wallet.", done: false, auto: false },
      { id: "device", title: "Trusted device", desc: "Sign privately.", done: false, auto: false },
      { id: "hardware", title: "Cold storage", desc: "For significant funds.", done: false, auto: false },
      { id: "twofa", title: "Strong 2FA", desc: "Secure exchanges.", done: false, auto: false },
    ],
    healthStats: [],
    recommendations: ["Create an offline recovery backup.", "Review connected apps.", "Use a trusted device."],
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("Wallet Health PlayArea", () => {
  it("renders an evidence-led read-only tool without a fake disconnected risk verdict", () => {
    const { container, getByText } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".health-console")).toBeTruthy();
    expect(container.querySelector(".health-overview")).toBeTruthy();
    expect(container.querySelector(".health-evidence")).toBeTruthy();
    expect(container.querySelector(".health-scanner-art img")?.getAttribute("src")).toContain("wallet-health-scanner.webp");
    expect(container.querySelector(".health-gauge")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(getByText("Wallet data not read")).toBeTruthy();
    expect(getByText("Checklist progress, not a security rating.")).toBeTruthy();
    expect(container.textContent).not.toContain("High risk");
  });

  it("keeps read/refresh primary and report export secondary", () => {
    const disconnected = vi.fn().mockResolvedValue(undefined);
    const disconnectedView = render(<PlayArea t={t} state={state()} dispatch={disconnected} />);
    fireEvent.click(disconnectedView.getByRole("button", { name: "Connect wallet" }));
    fireEvent.click(disconnectedView.getByRole("button", { name: "Copy report" }));
    expect(disconnected).toHaveBeenCalledWith("connectWallet");
    expect(disconnected).toHaveBeenCalledWith(
      "copy",
      expect.stringContaining("not a wallet audit"),
      "reportCopied",
    );
    disconnectedView.unmount();

    const connected = vi.fn().mockResolvedValue(undefined);
    const connectedView = render(<PlayArea t={t} state={state({
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
      neoDisplay: "12",
      gasDisplay: "1.25",
    })} dispatch={connected} />);
    fireEvent.click(connectedView.getByRole("button", { name: "Refresh balances" }));
    expect(connected).toHaveBeenCalledWith("refreshBalances");
  });

  it("shows all checks, tucks secondary self-checks away, and blocks auto toggles", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const primaryChecks = container.querySelectorAll<HTMLButtonElement>(
      ".health-checklist-card > .health-checklist .health-check",
    );

    expect(primaryChecks).toHaveLength(3);
    expect(primaryChecks[0]?.disabled).toBe(false);
    expect(primaryChecks[1]?.disabled).toBe(true);
    fireEvent.click(primaryChecks[0]!);
    expect(dispatch).toHaveBeenCalledWith("toggleChecklist", "backup");

    const details = container.querySelector<HTMLDetailsElement>(".health-more-checks")!;
    expect(details.open).toBe(false);
    fireEvent.click(getByText("More self-checks (3)"));
    expect(details.open).toBe(true);
    expect(container.querySelectorAll(".health-check")).toHaveLength(6);
  });

  it("surfaces a recoverable read error inline", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(<PlayArea t={t} state={state({
      dataStatus: "error",
      lastError: "RPC unavailable",
    })} dispatch={dispatch} />);

    expect(getByRole("alert").textContent).toContain("RPC unavailable");
    fireEvent.click(getByRole("button", { name: "Retry" }));
    expect(dispatch).toHaveBeenCalledWith("connectWallet");
  });

  it("marks retained balance evidence as a previous read after refresh failure", () => {
    const { container } = render(<PlayArea t={t} state={state({
      isConnected: true,
      dataStatus: "error",
      lastUpdatedAt: Date.now() - 60_000,
      lastError: "RPC unavailable",
      neoObservedAt: Date.now() - 60_000,
      gasObservedAt: Date.now() - 60_000,
      neoReadStatus: "failed",
      gasReadStatus: "failed",
      neoDisplay: "12",
      gasDisplay: "1.25",
    })} dispatch={vi.fn()} />);

    const balanceEvidence = [...container.querySelectorAll(".health-evidence-row")]
      .find((row) => row.textContent?.includes("NEO Balance"));
    expect(balanceEvidence?.getAttribute("data-outcome")).toBe("failed");
    expect(balanceEvidence?.textContent).toContain("previous value shown");
  });

  it("uses the real scanner asset in a compact responsive hierarchy", () => {
    const styles = readFileSync(`${process.cwd()}/../wallet-health/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../wallet-health/src/PlayArea.tsx`, "utf8");
    const assetPath = `${process.cwd()}/../wallet-health/public/wallet-health-scanner.webp`;

    expect(existsSync(assetPath)).toBe(true);
    expect(statSync(assetPath).size).toBeGreaterThan(40_000);
    expect(statSync(assetPath).size).toBeLessThan(220_000);
    expect(styles).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(styles).toMatch(/\.health-console\s*\{[\s\S]*grid-template-columns:/);
    expect(styles).toMatch(/\.health-scanner-art img\s*\{[\s\S]*height:\s*112px/);
    expect(styles).toContain("@media (max-height: 720px)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).not.toContain("radial-gradient");
    expect(source).toContain("wallet-health-scanner.webp");
    expect(source).toContain("officialNeoTokenUrl");
    expect(source).toContain("officialGasTokenUrl");
    expect(source).not.toContain("health-gauge");
  });
});

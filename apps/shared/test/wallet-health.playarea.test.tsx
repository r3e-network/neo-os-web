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
      { id: "gas", title: "Keep GAS for fees", desc: "Connect a wallet to check GAS.", done: false, auto: true, pending: true },
    ],
    healthStats: [],
    recommendations: ["Backup your seed phrase immediately."],
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("Wallet Health PlayArea", () => {
  it("renders a foreground-led diagnostic workspace with real checklist labels", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".health-workspace")).toBeTruthy();
    expect(container.querySelector(".health-summary-card")).toBeTruthy();
    expect(container.querySelector(".health-scanner-art")).toBeTruthy();
    expect(container.querySelector(".health-scanner-art img")?.getAttribute("src")).toContain("wallet-health-scanner.webp");
    expect(container.querySelector(".health-checklist-card")).toBeTruthy();
    expect(container.querySelector(".health-scene__backdrop")).toBeFalsy();
    expect(container.textContent).toContain("Backup phrase stored");
    expect(container.textContent).toContain("0/5 complete");
    expect(container.textContent).not.toContain("{completed}");
    expect(container.textContent).not.toContain("{total}");
  });

  it("dispatches connect before a wallet is connected and copy after connection", () => {
    const disconnected = vi.fn().mockResolvedValue(undefined);
    const disconnectedView = render(<PlayArea t={t} state={state()} dispatch={disconnected} />);
    fireEvent.click(disconnectedView.container.querySelector(".mx2-btn--primary") as Element);
    expect(disconnected).toHaveBeenCalledWith("connectWallet");
    disconnectedView.unmount();

    const connected = vi.fn().mockResolvedValue(undefined);
    const connectedView = render(<PlayArea t={t} state={state({
      isConnected: true,
      address: "Nabc1234567890",
      connectionStatus: "Connected",
      safetyScore: 80,
      riskLabel: "Low risk",
      riskClass: "risk-low",
    })} dispatch={connected} />);
    fireEvent.click(connectedView.container.querySelector(".mx2-btn--primary") as Element);
    expect(connected).toHaveBeenCalledWith("copy", expect.stringContaining("Wallet Health Report"), "reportCopied");
  });

  it("lets manual checklist items toggle and keeps auto checks disabled", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const checks = container.querySelectorAll<HTMLButtonElement>(".health-check");

    expect(checks).toHaveLength(2);
    expect(checks[0].disabled).toBe(false);
    expect(checks[1].disabled).toBe(true);

    fireEvent.click(checks[0]);
    expect(dispatch).toHaveBeenCalledWith("toggleChecklist", "backup");
  });

  it("keeps the diagnostic surface clean instead of using a decorative backdrop", () => {
    const styles = readFileSync(`${process.cwd()}/../wallet-health/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../wallet-health/src/PlayArea.tsx`, "utf8");
    const assetPath = `${process.cwd()}/../wallet-health/public/wallet-health-scanner.webp`;

    expect(existsSync(assetPath)).toBe(true);
    expect(statSync(assetPath).size).toBeGreaterThan(40_000);
    expect(statSync(assetPath).size).toBeLessThan(220_000);
    expect(styles).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(styles).toMatch(/\.health-workspace\s*\{[\s\S]*background:\s*#ffffff;/);
    expect(styles).toMatch(/\.health-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(500px,\s*1\.06fr\) minmax\(420px,\s*0\.94fr\)/);
    expect(styles).toMatch(/\.health-workspace\s*\{[\s\S]*box-shadow:\s*none;/);
    expect(styles).toMatch(/\.health-scanner-art img\s*\{[\s\S]*height:\s*clamp\(210px,\s*24vw,\s*300px\)/);
    expect(styles).toMatch(/\.health-scanner-art img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.health-scanner-art img\s*\{[\s\S]*filter:\s*none/);
    expect(styles).not.toMatch(/AI-generated scene backdrop|health-scene__backdrop|backdrop-filter|radial-gradient/);
    expect(source).toContain("wallet-health-scanner.webp");
    expect(source).not.toContain("health-scene__backdrop");
  });

  it("has reduced-motion guards for foreground motion", () => {
    const styles = readFileSync(`${process.cwd()}/../wallet-health/src/PlayArea.scss`, "utf8");

    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/transition-duration:\s*0\.001ms/);
  });
});

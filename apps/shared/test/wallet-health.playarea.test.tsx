import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../wallet-health/src/PlayArea";
import type { ChecklistItem } from "../../wallet-health/src/composables/useHealthScore";
import type { HealthStat } from "../../wallet-health/src/composables/useWalletHealth";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const TEST_ADDRESS = "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    allSet: "All checks look good",
    autoChecked: "Auto",
    balanceStripTitle: "Balance and connection",
    checklistProgress: `${params?.completed ?? 0}/${params?.total ?? 0} complete`,
    connectHint: "Connect a Neo N3 wallet to refresh live balances.",
    connectWallet: "Connect wallet",
    copyAddress: "Copy address",
    copyReport: "Copy report",
    diagnosticReportStep: "Report",
    diagnosticStageCopy: "Connect, refresh balances, review the local safety checklist, then export a clean wallet health report.",
    diagnosticStageTitle: "Live diagnostic run",
    diagnosticStatusIdle: "Ready to scan",
    diagnosticStatusReady: "Diagnostics ready",
    diagnosticStatusScanning: "Scanning wallet",
    downloadReport: "Download report",
    loading: "Loading",
    markDone: "Mark done",
    markUndo: "Undo",
    networkReadiness: "Network readiness",
    notConnected: "Not connected",
    notAvailable: "N/A",
    addressCopied: "Address copied",
    recommendationsTitle: "Next actions",
    reportActionError: "Action failed",
    reportChecklist: "Checklist",
    reportCopied: "Report copied",
    reportDownloaded: "Report downloaded",
    reportGeneratedAt: "Generated at",
    reportReady: "Report ready",
    reportTitle: "Wallet Health Report",
    reportDone: "DONE",
    reportPending: "PENDING",
    checklistConnectToCheck: "Connect to check",
    refreshBalances: "Refresh balances",
    riskInsights: "Risk insights",
    sectionBalances: "Balances",
    sectionChecklist: "Safety Checklist",
    statConnection: "Connection",
    statGas: "GAS reserve",
    statNeo: "NEO Balance",
    statNetwork: "Network",
    statScore: "Safety Score",
    statusConnected: "Connected",
    walletHeroSubtitle: "Review balances, network readiness, and signing hygiene.",
    walletHeroTitle: "Wallet Health Command Center",
    walletAddress: "Wallet address",
  };
  return messages[key] ?? key;
}

function baseState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const checklist: ChecklistItem[] = [
    {
      id: "backup",
      title: "Backup phrase stored",
      desc: "Store your seed phrase offline.",
      done: false,
      auto: false,
    },
    {
      id: "gas",
      title: "Keep GAS for fees",
      desc: "Maintain enough GAS for future transactions.",
      done: true,
      auto: true,
    },
  ];
  const healthStats: HealthStat[] = [
    { label: "Connection", value: "Disconnected" },
    { label: "Network", value: "Neo N3 TestNet" },
    { label: "Safety Score", value: "50%" },
  ];
  const values: Record<string, unknown> = {
    address: "",
    checklistItems: checklist,
    completedChecklistCount: 1,
    connectionStatus: "Disconnected",
    gasDisplay: "N/A",
    healthStats,
    isConnected: false,
    isRefreshing: false,
    neoDisplay: "N/A",
    networkLabel: "Neo N3 TestNet",
    recommendations: ["Backup your seed phrase immediately."],
    riskClass: "risk-medium",
    riskIcon: "alert-circle",
    riskLabel: "Medium risk",
    safetyScore: 50,
    totalChecklistCount: 2,
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Wallet Health PlayArea", () => {
  it("renders the security dashboard visual assets", () => {
    render(<PlayArea t={t} state={baseState()} dispatch={vi.fn().mockResolvedValue(undefined)} />);

    expect(document.querySelector('.wallet-health-hero-art img[src="./banner.jpg"]')).toBeTruthy();
    expect(document.querySelector('.wallet-health-logo img[src="./logo.jpg"]')).toBeTruthy();
    expect(
      document.querySelector(
        '.wallet-health-diagnostic-art img[src="./wallet-health-diagnostic-station.png"]',
      ),
    ).toBeTruthy();
    expect(document.querySelector(".wallet-health-diagnostic-stage--idle")).toBeTruthy();
    expect(document.querySelectorAll(".wallet-health-diagnostic-steps li")).toHaveLength(4);
    expect(screen.getByText("Live diagnostic run")).toBeTruthy();
  });

  it("shows an animated scanning stage while balances are refreshing", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({
          address: TEST_ADDRESS,
          connectionStatus: "Connected",
          gasDisplay: "0.45",
          isConnected: true,
          isRefreshing: true,
          neoDisplay: "12",
        })}
        dispatch={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const stage = document.querySelector(".wallet-health-diagnostic-stage--scanning");
    expect(stage).toBeTruthy();
    expect(stage?.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(document.querySelectorAll(".wallet-health-diagnostic-steps li.is-active")).toHaveLength(1);
    expect(screen.getByText("Scanning wallet")).toBeTruthy();
  });

  it("keeps the diagnostic station resource and motion accessible", () => {
    const repoPath = resolve(process.cwd(), "apps/wallet-health/src/PlayArea.scss");
    const sharedPath = resolve(process.cwd(), "../wallet-health/src/PlayArea.scss");
    const css = readFileSync(existsSync(repoPath) ? repoPath : sharedPath, "utf8");
    const repoAsset = resolve(
      process.cwd(),
      "apps/wallet-health/public/wallet-health-diagnostic-station.png",
    );
    const sharedAsset = resolve(
      process.cwd(),
      "../wallet-health/public/wallet-health-diagnostic-station.png",
    );

    expect(existsSync(existsSync(repoAsset) ? repoAsset : sharedAsset)).toBe(true);
    expect(css).toContain("@keyframes wallet-health-scan-sweep");
    expect(css).toContain("@keyframes wallet-health-diagnostic-breathe");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation: none");
  });

  it("keeps wallet actions and manual checklist items interactive", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(<PlayArea t={t} state={baseState()} dispatch={dispatch} />);

    const connectButton = screen.getByRole("button", { name: "Connect wallet" });
    const refreshButton = screen.getByRole("button", { name: "Refresh balances" });
    const copyAddressButton = screen.getByRole("button", { name: "Copy address" });
    const copyReportButton = screen.getByRole("button", { name: "Copy report" });
    expect((connectButton as HTMLButtonElement).disabled).toBe(false);
    expect((refreshButton as HTMLButtonElement).disabled).toBe(true);
    expect((copyAddressButton as HTMLButtonElement).disabled).toBe(true);
    expect((copyReportButton as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("Backup your seed phrase immediately.")).toBeTruthy();

    fireEvent.click(connectButton);
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("connectWallet");
      expect(dispatch).toHaveBeenCalledWith("toggleChecklist", "backup");
    });
  });

  it("enables balance refresh and shows the scoped connected wallet state", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState({
          address: TEST_ADDRESS,
          checklistItems: [
            {
              id: "backup",
              title: "Backup phrase stored",
              desc: "Store your seed phrase offline.",
              done: true,
              auto: false,
            },
            {
              id: "gas",
              title: "Keep GAS for fees",
              desc: "Maintain enough GAS for future transactions.",
              done: true,
              auto: true,
            },
          ],
          completedChecklistCount: 2,
          connectionStatus: "Connected",
          gasDisplay: "0.45",
          isConnected: true,
          neoDisplay: "12",
          recommendations: [],
          riskClass: "risk-low",
          riskIcon: "check-circle",
          riskLabel: "Low risk",
          safetyScore: 100,
        })}
        dispatch={dispatch}
      />,
    );

    expect(screen.getByText("Ndb1n4zz...F9m2Aa")).toBeTruthy();
    expect(screen.getByText("All checks look good")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Connected" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    const refreshButton = screen.getByRole("button", { name: "Refresh balances" });
    expect((refreshButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(refreshButton);

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("refreshBalances"),
    );
  });

  it("copies address and exports a business-ready wallet health report", async () => {
    // Copy now routes through the shared ClipboardService via the host "copy"
    // action (so the iframe execCommand fallback + standardized toast apply),
    // not a raw navigator.clipboard call — assert via the dispatched action.
    const dispatch = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:wallet-health-report"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <PlayArea
        t={t}
        state={baseState({
          address: TEST_ADDRESS,
          checklistItems: [
            {
              id: "backup",
              title: "Backup phrase stored",
              desc: "Store your seed phrase offline.",
              done: true,
              auto: false,
            },
            {
              id: "gas",
              title: "Keep GAS for fees",
              desc: "Maintain enough GAS for future transactions.",
              done: true,
              auto: true,
            },
          ],
          completedChecklistCount: 2,
          connectionStatus: "Connected",
          gasDisplay: "0.45",
          isConnected: true,
          neoDisplay: "12",
          recommendations: ["Revoke stale app approvals."],
          riskClass: "risk-low",
          riskIcon: "check-circle",
          riskLabel: "Low risk",
          safetyScore: 100,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("copy", TEST_ADDRESS, "addressCopied"),
    );
    expect(screen.getByRole("status").textContent).toBe("Address copied");

    fireEvent.click(screen.getByRole("button", { name: "Copy report" }));
    await waitFor(() => {
      const reportCall = dispatch.mock.calls.find(
        (c) => c[0] === "copy" && c[2] === "reportCopied",
      );
      expect(reportCall).toBeTruthy();
      const report = String(reportCall?.[1] ?? "");
      expect(report).toContain("Wallet Health Report");
      expect(report).toContain(`Wallet address: ${TEST_ADDRESS}`);
      // Score now carries the % suffix everywhere.
      expect(report).toContain("Safety Score: 100%");
      expect(report).toContain("DONE: Backup phrase stored");
      expect(report).toContain("Revoke stale app approvals.");
    });
    expect(screen.getByRole("status").textContent).toBe("Report copied");

    fireEvent.click(screen.getByRole("button", { name: "Download report" }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:wallet-health-report");
    expect(screen.getByRole("status").textContent).toBe("Report downloaded");
  });
});

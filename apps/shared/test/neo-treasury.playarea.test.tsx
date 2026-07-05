import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../neo-treasury/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    operationsEyebrow: "Treasury",
    operationsTitle: "Operations",
    disbursementTitle: "Disbursement",
    connectWallet: "Connect Wallet",
    connectAndSignDisbursement: "Connect & Sign",
    submitDisbursement: "Sign Disbursement",
    treasuryFlowSubtitle: "Live foundation wallet balances.",
    treasuryFlowTitle: "Treasury payout route",
    treasuryFlowSource: "Source wallet",
    treasuryFlowRecipient: "Recipient",
    treasuryFlowDraft: "Draft",
    treasuryStale: "Showing cached data",
    treasuryLiveSynced: "Live balances synced",
    treasuryLiveLoading: "Loading balances",
    treasuryLivePending: "Awaiting data",
    treasuryWalletsUnreachable: "wallets unreachable",
    treasuryPriceFeedUnavailable: "Price feed unavailable",
    treasuryReadOnlyRoute: "Read-only route",
    treasuryWatchlistNetwork: "Watchlist data",
    treasuryWatchlist: "Watchlist",
    networkMainnet: "Mainnet",
    networkTestnet: "Testnet",
    asset: "Asset",
    amount: "Amount",
    recipient: "Recipient",
    memo: "Memo",
    tokenNeo: "NEO",
    tokenGas: "GAS",
    founders: "Wallets",
    sidebarTotalUsd: "Total USD",
    refresh: "Refresh",
    refreshData: "Refresh data",
    lastTx: "Last tx",
    policyTitle: "Policy",
    policyCopy: "Disbursements are from your connected wallet.",
    lastUpdated: "Last updated",
    loading: "Loading",
    loadFailed: "Failed to load",
    retry: "Retry",
    treasuryLoadTimeout: "Load timed out",
    treasuryLoadTimeoutHint: "Retry live balances",
  };
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function treasuryData(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    totalUsd: 123456.78,
    totalNeo: 1000,
    totalGas: 500,
    lastUpdated: Date.now(),
    prices: { neo: 12.5, gas: 5.5 },
    failedCount: 0,
    categories: [
      {
        name: "Da Hongfei",
        totalUsd: 60000,
        wallets: [
          { address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs", label: "wallet-1", neo: 500, gas: 250, failed: false },
        ],
      },
      {
        name: "Erik Zhang",
        totalUsd: 63456.78,
        wallets: [
          { address: "NanotherWallet123456789", label: "wallet-2", neo: 500, gas: 250, failed: false },
        ],
      },
    ],
    ...overrides,
  };
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    loading: false,
    error: "",
    data: treasuryData(),
    stale: false,
    address: "",
    disbursementSubmitting: false,
    disbursementStatus: "Ready",
    disbursementError: "",
    lastTxid: "",
    totalUsdDisplay: "$123,456.78",
    totalNeoDisplay: "1,000",
    totalGasDisplay: "500",
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)]));
}

function launch(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  return parseMiniAppLaunchContext(
    `https://neomini.app/miniapps/neo-treasury/index.html?network=mainnet${query ? `&${query}` : ""}`,
    "miniapp-neo-treasury",
  );
}

describe("Neo Treasury PlayArea (v2 scene-driven)", () => {
  const amountInputSelector = ".treasury-input-control--amount .semi-input";
  const recipientInputSelector = ".treasury-input-control--recipient .semi-input";
  const assetOptionSelector = ".treasury-ticket__asset-group .semi-radio";
  const drawerTabSelector = ".treasury-drawer-tabs__group .semi-radio";

  it("renders the balance dashboard scene with live data", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launch()} />);
    expect(container.querySelector(".treasury-scene")).toBeTruthy();
    expect(container.querySelector(".treasury-scene__backdrop")).toBeNull();
    expect((container.querySelector(".treasury-scene__art img") as HTMLImageElement)?.src).toContain("treasury-vault-desk.webp");
    expect(container.querySelector(".treasury-scene__gauge")).toBeTruthy();
    expect(container.querySelector(".treasury-ticket__flow")).toBeTruthy();
    expect(container.querySelectorAll(".treasury-ticket__node")).toHaveLength(2);
    expect(container.querySelectorAll(".treasury-ticket__summary-card")).toHaveLength(2);
    expect(container.querySelector(amountInputSelector)).toBeNull();
    expect(container.querySelector(recipientInputSelector)).toBeNull();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.textContent).toContain("$123,456.78");
    expect(container.textContent).toContain("1,000");
    expect(container.textContent).toContain("500");
  });

  it("shows the cached signal when data is stale", () => {
    const { container } = render(<PlayArea t={t} state={state({ stale: true })} dispatch={vi.fn()} launchContext={launch()} />);
    expect(container.querySelector('.treasury-scene[data-state="stale"]')).toBeTruthy();
    expect(container.textContent).toContain("cached");
  });

  it("does not show an empty USD overview when the price feed is unavailable", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ data: treasuryData({ totalUsd: null }), totalUsdDisplay: "" })}
        dispatch={vi.fn()}
        launchContext={launch()}
      />,
    );
    expect(container.querySelector(".treasury-scene__gauge")?.textContent).not.toContain("Total USD");
    expect(container.querySelector(".treasury-scene__gauge")?.textContent).toContain("NEO / GAS");
    expect(container.textContent).toContain("Price feed unavailable");
  });

  it("dispatches connectWallet when no wallet is connected", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ address: "" })} dispatch={dispatch} launchContext={launch()} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(dispatch).toHaveBeenCalledWith("connectWallet");
  });

  it("dispatches submitDisbursement with launch-prefilled fields", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs" })}
        dispatch={dispatch}
        launchContext={launch({ asset: "GAS", amount: "0.1", recipient: "0x1234567890abcdef1234567890abcdef12345678", memo: "ops" })}
      />,
    );
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("submitDisbursement", expect.objectContaining({ asset: "GAS", amount: "0.1", recipient: "0x1234567890abcdef1234567890abcdef12345678" })),
    );
  });

  it("switches asset between GAS and NEO", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launch()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const neoOption = container.querySelectorAll(assetOptionSelector)[1];
    fireEvent.click(neoOption);
    expect(neoOption.classList.contains("semi-radio-checked")).toBe(true);
    expect((container.querySelector(amountInputSelector) as HTMLInputElement).placeholder).toBe("1");
  });

  it("keeps NEO disbursement amounts whole before submit", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs" })}
        dispatch={dispatch}
        launchContext={launch()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(container.querySelectorAll(assetOptionSelector)[1]);
    const amountInput = container.querySelector(amountInputSelector) as HTMLInputElement;
    expect(amountInput.inputMode).toBe("numeric");
    fireEvent.change(amountInput, { target: { value: "2.9" } });
    expect(amountInput.value).toBe("2");
    expect(Array.from(container.querySelectorAll(".treasury-preset-option")).map((button) => button.textContent)).toEqual(["1", "5", "10"]);

    const recipientInput = container.querySelector(recipientInputSelector) as HTMLInputElement;
    fireEvent.change(recipientInput, { target: { value: "0x1234567890abcdef1234567890abcdef12345678" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("submitDisbursement", expect.objectContaining({ asset: "NEO", amount: "2", recipient: "0x1234567890abcdef1234567890abcdef12345678" })),
    );
  });

  it("keeps payout controls, watchlist, and policy in drawer tabs", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launch()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.querySelectorAll(drawerTabSelector)).toHaveLength(3);
    expect(container.querySelector(".treasury-drawer__panel")?.getAttribute("data-mode")).toBe("payout");
    expect(container.querySelector(amountInputSelector)).toBeTruthy();
    expect(container.querySelector(recipientInputSelector)).toBeTruthy();
    expect(container.textContent).not.toContain("Da Hongfei");
    fireEvent.click(container.querySelectorAll(drawerTabSelector)[1]);
    expect(container.querySelector(".treasury-drawer__panel")?.getAttribute("data-mode")).toBe("watchlist");
    expect(container.textContent).toContain("Da Hongfei");
    fireEvent.click(container.querySelectorAll(drawerTabSelector)[2]);
    expect(container.querySelector(".treasury-drawer__panel")?.getAttribute("data-mode")).toBe("policy");
    expect(container.textContent).toContain("Disbursements are from your connected wallet.");
  });

  it("renders a loading state before data arrives", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ loading: true, data: null })} dispatch={dispatch} launchContext={launch()} />,
    );
    // Balance loading is scoped to the vault notice; the core payout route
    // stays available instead of being blocked by a full-page empty state.
    expect(container.querySelector(".treasury-scene")).toBeTruthy();
    expect(container.querySelector(".treasury-ticket")).toBeTruthy();
    expect(container.textContent).toContain("Loading balances");
    expect(container.textContent).toContain("Connect Wallet");
  });

  it("turns an unresolved first load into an actionable retry state", async () => {
    vi.useFakeTimers();
    try {
      const dispatch = vi.fn().mockResolvedValue(undefined);
      const { container } = render(
        <PlayArea t={t} state={state({ loading: true, data: null })} dispatch={dispatch} launchContext={launch()} />,
      );

      expect(container.textContent).toContain("Loading");
      await vi.advanceTimersByTimeAsync(1300);
      expect(container.textContent).toContain("Load timed out");
      expect(container.textContent).toContain("Retry live balances");
      const refreshButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Refresh"));
      expect(refreshButton).toBeTruthy();
      fireEvent.click(refreshButton!);
      expect(dispatch).toHaveBeenCalledWith("refresh");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps motion backed by reduced-motion fallbacks", () => {
    const styles = readFileSync(`${process.cwd()}/../neo-treasury/src/PlayArea.scss`, "utf8");
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
  });

  it("keeps treasury balances on a clean foreground dashboard", () => {
    const styles = readFileSync(`${process.cwd()}/../neo-treasury/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../neo-treasury/src/PlayArea.tsx`, "utf8");

    expect(styles).toMatch(/\.treasury-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.treasury-scene__art\s*\{[\s\S]*background:\s*#f8fcfb/);
    expect(styles).toMatch(/\.treasury-scene__art img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.treasury-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(480px,\s*1\.35fr\) minmax\(260px,\s*0\.65fr\)/);
    expect(styles).toMatch(/\.treasury-ticket__flow\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(110px,\s*0\.45fr\) minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.treasury-ticket__summary-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.treasury-ticket__summary-card\s*\{[\s\S]*min-height:\s*104px/);
    expect(styles).toMatch(/\.treasury-ticket__amount-input\s*\{[\s\S]*border:\s*0/);
    expect(styles).toMatch(/\.treasury-ticket__asset-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*border:\s*1px solid var\(--mx2-border\)/);
    expect(styles).toMatch(/\.treasury-asset-option\s*\{[\s\S]*border-radius:\s*var\(--mx2-r-pill\)/);
    expect(styles).toMatch(/\.treasury-input-control--amount \.semi-input\s*\{[\s\S]*font-size:\s*46px/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.treasury-input-control--amount \.semi-input\s*\{[\s\S]*font-size:\s*39px/);
    expect(styles).not.toContain("font-size: clamp(");
    expect(styles).toMatch(/\.treasury-ticket__presets-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*flex-wrap:\s*wrap/);
    expect(styles).toMatch(/\.treasury-preset-option\s*\{[\s\S]*border-radius:\s*var\(--mx2-r-pill\)/);
    expect(styles).toMatch(/\.treasury-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/\.treasury-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.treasury-drawer__payout\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.treasury-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 210px/);
    for (const match of styles.matchAll(/letter-spacing:\s*([^;]+);/g)) {
      expect(match[1].trim()).toBe("0");
    }
    expect(styles).not.toMatch(/treasury-scene__backdrop|var\(--mx2-scene-wash|background-image:\s*url/);
    expect(source).toContain("treasury-vault-desk.webp");
    expect(source).toContain("OpenUiProvider");
    expect(source).toContain("OpenUiSegmented");
    expect(source).toContain("OpenUiTextField");
    expect(source).not.toMatch(/<(input|textarea|select)\b/);
    expect(source).not.toContain('role="radio"');
    expect(source).not.toContain('role="radiogroup"');
    expect(source).not.toContain('role="tab"');
    expect(source).not.toContain('role="tablist"');
    expect(source).not.toContain("treasury-scene-art.jpg");
    expect(source).not.toContain("treasury-scene__backdrop");
    expect(source).not.toContain("score={[");
  });
});

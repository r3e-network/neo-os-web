import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import { addressToScriptHash } from "../utils/neo";
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
    treasuryEstimatedValue: "Estimated watchlist value",
    treasuryAllocationTitle: "Watchlist allocation",
    treasuryAllocationCaption: "USD estimate, not a spendable balance",
    treasuryPartialTotals: "Partial totals",
    treasuryNativeOnly: "Native balances only",
    treasuryPriceFresh: "Price quote fresh",
    treasuryPriceDelayed: "Price quote delayed",
    treasuryPriceUnavailableShort: "USD valuation unavailable",
    treasuryPriceRecord: "Price record",
    treasuryBalancesReadAt: "Balances read",
    treasuryWalletsUnreachable: "wallets unreachable",
    treasuryPriceFeedUnavailable: "Price feed unavailable",
    treasuryReadOnlyRoute: "Read-only route",
    treasuryWatchlistNetwork: "Watchlist data",
    treasuryWatchlist: "Watchlist",
    treasuryAttributionNotice: "Community-attributed, read-only addresses",
    treasuryBalanceUnavailable: "Balance unavailable",
    networkMainnet: "Mainnet",
    networkTestnet: "Testnet",
    networkUnverified: "Network unverified",
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
    disbursementPendingTitle: "Transfer awaiting proof",
    disbursementConfirmedTitle: "Transfer confirmed",
    disbursementConfirmationPending: "Waiting for event and readback",
    disbursementConfirmed: "Event and state confirmed",
    checkTransferConfirmation: "Check Transfer Proof",
    intentContract: "Native contract",
    intentSigner: "Signer",
    intentExactBinding: "Exact transfer binding",
    pendingNoRebroadcast: "Checking never rebroadcasts",
    treasuryErrorRecipient: "Enter a valid Neo N3 recipient",
    treasuryErrorSelfTransfer: "Choose a different recipient",
    policyTitle: "Policy",
    policyCopy: "Disbursements are from your connected wallet.",
    lastUpdated: "Last updated",
    loading: "Loading",
    loadFailed: "Failed to load",
    retry: "Retry",
    treasuryLoadTimeout: "Load timed out",
    treasuryLoadTimeoutHint: "Retry live balances",
    priceFeedSourceNote: "Morpheus on-chain price feed",
    treasuryErrorNetworkUnverified: "Wallet network could not be verified",
    addresses: "addresses",
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
    prices: { neo: 12.5, gas: 5.5, feedRecordTimestamp: Date.now() - 30_000 },
    priceStale: false,
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
  const { network = "mainnet", ...rest } = params;
  const query = new URLSearchParams(rest).toString();
  return parseMiniAppLaunchContext(
    `https://neomini.app/miniapps/neo-treasury/index.html?network=${encodeURIComponent(network)}${query ? `&${query}` : ""}`,
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

  it("separates live balance freshness from a delayed USD valuation quote", () => {
    const delayed = treasuryData({
      priceStale: true,
      prices: { neo: 12.5, gas: 5.5, feedRecordTimestamp: Date.now() - 15 * 60_000 },
    });
    const { container } = render(
      <PlayArea t={t} state={state({ stale: false, data: delayed })} dispatch={vi.fn()} launchContext={launch()} />,
    );

    expect(container.querySelector('.treasury-scene[data-state="live"]')).toBeTruthy();
    expect(container.querySelector('.treasury-price-status[data-status="delayed"]')?.textContent).toContain("Price quote delayed");
    expect(container.textContent).not.toContain("Showing cached data");
  });

  it("leads with real watchlist allocation and labels valuation as an estimate", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launch()} />);
    expect(container.querySelectorAll(".treasury-allocation__row")).toHaveLength(2);
    expect(container.querySelector(".treasury-allocation")?.textContent).toContain("Da Hongfei");
    expect(container.querySelector(".treasury-allocation")?.textContent).toContain("Erik Zhang");
    expect(container.querySelector(".treasury-allocation")?.textContent).toContain("not a spendable balance");
    expect(container.querySelector(".treasury-scene__gauge")?.textContent).toContain("Estimated watchlist value");
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

  it("keeps wallet connection available while a payout draft is incomplete", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ address: "" })}
        dispatch={dispatch}
        launchContext={launch({ amount: "0.1" })}
      />,
    );
    const primary = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(primary.textContent).toContain("Connect Wallet");
    expect(primary.disabled).toBe(false);
    fireEvent.click(primary);
    expect(dispatch).toHaveBeenCalledWith("connectWallet");
  });

  it("fails closed instead of labelling an unknown launch network as Mainnet", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const setStatus = vi.fn();
    const { container } = render(
      <PlayArea t={t} state={state({ address: "" })} dispatch={dispatch} launchContext={launch({ network: "neo-n3" })} setStatus={setStatus} />,
    );
    expect(container.querySelector('.treasury-network-badge[data-verified="false"]')?.textContent).toContain("Network unverified");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(dispatch).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith("Wallet network could not be verified", "error");
  });

  it("recognizes the canonical neo-n3-testnet launch label", () => {
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launch({ network: "neo-n3-testnet" })} />,
    );
    expect(container.querySelector('.treasury-network-badge[data-verified="true"]')?.textContent).toContain("Testnet");
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

  it("turns a persisted broadcast into one idempotent recovery task", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const pendingTransfer = {
      version: 1,
      network: "testnet",
      asset: "GAS",
      amount: "0.1",
      scaledAmount: "10000000",
      senderHash: `0x${"1".repeat(40)}`,
      recipientHash: `0x${"2".repeat(40)}`,
      memo: "ops",
      scriptHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      createdAt: 1,
      bindingKey: "binding",
      args: [],
      txid: `0x${"ab".repeat(32)}`,
      preSenderBalance: "50000000",
      preRecipientBalance: "0",
      broadcastAt: 2,
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
          pendingTransfer,
          settlementStatus: "pending",
          settlementMessage: "Waiting for event and readback",
        })}
        dispatch={dispatch}
        launchContext={launch({ network: "testnet" })}
      />,
    );

    expect(container.querySelector('.treasury-ticket[data-state="pending"]')).toBeTruthy();
    expect(container.querySelector(".treasury-settlement")?.textContent).toContain("0.1 GAS");
    expect(container.querySelector(".treasury-settlement")?.textContent).toContain("0xd2a4cff3");
    const primary = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(primary.textContent).toContain("Check Transfer Proof");
    fireEvent.click(primary);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("recoverDisbursement"));

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".treasury-drawer__recovery")).toBeTruthy();
    expect(container.querySelector(amountInputSelector)).toBeNull();
    expect(container.querySelector(recipientInputSelector)).toBeNull();
    expect(container.textContent).toContain("Checking never rebroadcasts");
  });

  it("shows confirmed state only after settlement verification", () => {
    const sender = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
    const recipientHash = "0x1234567890abcdef1234567890abcdef12345678";
    const confirmedIntent = {
      version: 1,
      network: "mainnet",
      asset: "GAS",
      amount: "0.1",
      scaledAmount: "10000000",
      senderHash: addressToScriptHash(sender).toLowerCase(),
      recipientHash,
      memo: "ops",
      scriptHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      createdAt: 1,
      bindingKey: "binding",
      args: [],
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: sender,
          pendingTransfer: null,
          lastIntent: confirmedIntent,
          settlementStatus: "confirmed",
          settlementMessage: "Event and state confirmed",
          lastTxid: `0x${"cd".repeat(32)}`,
        })}
        dispatch={vi.fn()}
        launchContext={launch({ amount: "0.1", recipient: recipientHash, memo: "ops" })}
      />,
    );
    expect(container.querySelector('.treasury-ticket[data-state="confirmed"]')).toBeTruthy();
    expect(container.querySelector('.treasury-settlement[data-status="confirmed"]')?.textContent).toContain("Transfer confirmed");
    expect(container.textContent).toContain("Event and state confirmed");

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.change(container.querySelector(amountInputSelector) as HTMLInputElement, { target: { value: "0.2" } });
    expect(container.querySelector('.treasury-settlement[data-status="confirmed"]')).toBeNull();
  });

  it("switches asset between GAS and NEO", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launch()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const neoOption = container.querySelectorAll(assetOptionSelector)[1];
    fireEvent.click(neoOption);
    expect(neoOption.classList.contains("semi-radio-checked")).toBe(true);
    expect((container.querySelector(amountInputSelector) as HTMLInputElement).placeholder).toBe("1");
  });

  it("rejects fractional NEO without silently changing the requested amount", async () => {
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
    expect(amountInput.value).toBe("2.9");
    expect(Array.from(container.querySelectorAll(".treasury-preset-option")).map((button) => button.textContent)).toEqual(["1", "5", "10"]);

    const recipientInput = container.querySelector(recipientInputSelector) as HTMLInputElement;
    fireEvent.change(recipientInput, { target: { value: "0x1234567890abcdef1234567890abcdef12345678" } });
    expect(amountInput.getAttribute("aria-invalid")).toBe("true");
    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(amountInput, { target: { value: "2" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("submitDisbursement", expect.objectContaining({ asset: "NEO", amount: "2", recipient: "0x1234567890abcdef1234567890abcdef12345678" })),
    );
  });

  it("binds inline recipient errors to the field and recovers after correction", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const sender = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ address: sender })}
        dispatch={dispatch}
        launchContext={launch()}
      />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.change(container.querySelector(amountInputSelector) as HTMLInputElement, { target: { value: "1" } });
    const recipientInput = container.querySelector(recipientInputSelector) as HTMLInputElement;
    fireEvent.change(recipientInput, { target: { value: "not-an-address" } });
    expect(recipientInput.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("Enter a valid Neo N3 recipient");
    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(recipientInput, { target: { value: "0x1234567890abcdef1234567890abcdef12345678" } });
    expect(recipientInput.getAttribute("aria-invalid")).not.toBe("true");
    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps payout controls, watchlist, and policy in drawer tabs", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launch()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.querySelectorAll(drawerTabSelector)).toHaveLength(3);
    expect(container.querySelector(".treasury-drawer__panel")?.getAttribute("data-mode")).toBe("payout");
    expect(container.querySelector(amountInputSelector)).toBeTruthy();
    expect(container.querySelector(recipientInputSelector)).toBeTruthy();
    expect(container.querySelector(".treasury-drawer__panel")?.textContent).not.toContain("Da Hongfei");
    fireEvent.click(container.querySelectorAll(drawerTabSelector)[1]);
    expect(container.querySelector(".treasury-drawer__panel")?.getAttribute("data-mode")).toBe("watchlist");
    expect(container.textContent).toContain("Da Hongfei");
    fireEvent.click(container.querySelectorAll(drawerTabSelector)[2]);
    expect(container.querySelector(".treasury-drawer__panel")?.getAttribute("data-mode")).toBe("policy");
    expect(container.textContent).toContain("Disbursements are from your connected wallet.");
  });

  it("keeps the complete watchlist available and never renders failed reads as zero balances", () => {
    const wallets = Array.from({ length: 7 }, (_, index) => ({
      address: `Nwallet${String(index).padStart(2, "0")}1234567890123456789012345`,
      label: `wallet-${index + 1}`,
      neo: index === 6 ? 0 : index + 1,
      gas: index === 6 ? 0 : index + 0.5,
      failed: index === 6,
    }));
    const data = treasuryData({
      failedCount: 1,
      categories: [{ name: "Da Hongfei", totalUsd: null, wallets }],
    });
    const { container } = render(
      <PlayArea t={t} state={state({ data })} dispatch={vi.fn()} launchContext={launch()} />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(container.querySelectorAll(drawerTabSelector)[1]);

    expect(container.querySelectorAll(".treasury-drawer__wallet")).toHaveLength(7);
    const failed = container.querySelector('.treasury-drawer__wallet[data-failed="true"]');
    expect(failed?.textContent).toContain("Balance unavailable");
    expect(failed?.textContent).not.toContain("0 NEO");
    expect(container.textContent).toContain("Community-attributed, read-only addresses");
    expect(container.textContent).toContain("Partial totals");
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
      await vi.advanceTimersByTimeAsync(10_100);
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
    expect(styles).toMatch(/\.treasury-workspace\s*\{[\s\S]*grid-template-areas:\s*"overview transfer"[\s\S]*grid-template-columns:\s*minmax\(500px,\s*1\.35fr\) minmax\(300px,\s*0\.65fr\)/);
    expect(styles).toMatch(/\.treasury-scene\s*\{[\s\S]*grid-area:\s*overview/);
    expect(styles).toMatch(/\.treasury-ticket\s*\{[\s\S]*grid-area:\s*transfer/);
    expect(styles).toMatch(/\.treasury-ticket__flow\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/\.treasury-ticket__summary-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/\.treasury-ticket__summary-card\s*\{[\s\S]*min-height:\s*86px/);
    expect(styles).toMatch(/\.treasury-allocation\s*\{[\s\S]*border-top:\s*1px solid/);
    expect(styles).toMatch(/\.treasury-price-status\s*\{[\s\S]*background:\s*#f8fcfb/);
    expect(styles).toContain("--treasury-success-ink: #106b35");
    expect(styles).toContain("--treasury-warning-ink: #8a3f06");
    expect(styles).toContain("--treasury-danger-ink: #b42318");
    expect(styles).not.toMatch(/color:\s*var\(--mx2-(?:success|warning|danger)\)/);
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
    expect(source).toContain("treasury-allocation__rows");
    expect(source).toContain("treasury-price-status");
    expect(source).not.toContain(".slice(0, 5)");
    expect(source).toContain("OpenUiProvider");
    expect(source).toContain("OpenUiSegmented");
    expect(source).toContain("OpenUiTextField");
    expect(source).not.toContain("eyebrow:");
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

import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-swap/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const tokens = [
  { symbol: "NEO", hash: "neo", balance: 24, decimals: 0 },
  { symbol: "GAS", hash: "gas", balance: 421.54321, decimals: 8 },
];

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    balance: "Balance",
    balanceLoading: "Checking balance",
    balanceUnavailable: "Balance unavailable",
    connectForBalance: "Connect to view",
    connectForBalances: "Connect wallet to view balances",
    connectToPreview: "Connect wallet",
    dismiss: "Dismiss",
    docSubtitle: "Swap tokens with a protected route.",
    enterAmount: "Amount",
    exchangeRate: "Rate",
    exchangeRateShort: "Rate",
    from: "From",
    marketPairs: "Market pairs",
    max: "MAX",
    minReceived: "Min received",
    minReceivedShort: "Min received",
    payAmountLabel: "You pay",
    payWith: "Pay with",
    pricePreviewAwaiting: "Awaiting amount",
    rateAsOf: `Rate as of ${params?.time ?? ""}`,
    rateRefreshFailed: "Quote failed",
    rateRetryHint: "Refresh the quote",
    retryBalance: "Retry wallet balances",
    rateStale: "Rate stale",
    receiveEstimated: "Receive estimated",
    refreshRate: "Refresh",
    routeModeLive: "Live route",
    routeModeLiveBody: "Quote routes through the wallet.",
    routeModePreview: "Preview route",
    routeModePreviewBody: "Connect a wallet for a live route.",
    routeReview: "Route review",
    routeReviewShort: "Route",
    routeSourceAwaiting: "Enter an amount",
    routeSourceMorpheus: "Morpheus quote",
    routeStepPair: "Pair",
    routeStepQuote: "Quote",
    routeStepWallet: "Wallet",
    selectToken: "Select token",
    slippage: "Slippage",
    slippageShort: "Slippage",
    slippageControl: "Slippage guard",
    slippageHint: "Choose the maximum route movement.",
    swapRouteReady: "Route ready",
    swapRouteNeedsAttention: "Quote unavailable",
    swapRouteSyncing: "Syncing route",
    swapRouteUnavailable: "Route unavailable",
    switchTokens: "Switch tokens",
    tabSwap: "Swap",
    to: "To",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const defaults: Record<string, unknown> = {
    fromToken: tokens[0],
    toToken: tokens[1],
    fromAmount: "",
    toAmount: "",
    exchangeRate: "",
    rateError: "",
    rateLoading: false,
    loading: false,
    isSwapping: false,
    canSwap: false,
    swapButtonText: "Swap",
    amountError: "",
    slippage: "0.5%",
    slippageValue: 50,
    minReceived: "",
    selectedPairDisplay: "NEO/GAS",
    availableTokens: tokens,
    showSelector: false,
    selectorTarget: "from",
    routerAvailable: true,
    rateStale: false,
    walletConnected: true,
    balancesVerified: true,
    balanceLoading: false,
    rateAsOf: "",
    quoteNetwork: "mainnet",
    walletNetwork: "mainnet",
    networkVerified: true,
    networkError: "",
    transactionStatus: "idle",
    pendingTxid: "",
    transactionError: "",
    recovering: false,
  };
  return Object.fromEntries(
    Object.entries({ ...defaults, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Neo Swap PlayArea (v2)", () => {
  it("renders a focused NeoBurger-style swap station instead of a flat token form", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".swap-scene")).toBeTruthy();
    expect(container.querySelector(".swap-scene__image")).toBeFalsy();
    expect(container.querySelector(".swap-scene__shade")).toBeFalsy();
    expect(container.querySelector(".swap-terminal")).toBeTruthy();
    expect(container.querySelector(".swap-terminal__header")?.textContent).toContain("0.5%");
    expect(container.querySelector(".swap-station")).toBeTruthy();
    expect(container.querySelector(".swap-quote-card")).toBeTruthy();
    expect((container.querySelector(".swap-quote-card__art") as HTMLImageElement)?.src).toContain("liquidity-route-v2.webp");
    expect(container.querySelectorAll(".swap-quote-card__tokens .neo-swap-token-icon")).toHaveLength(2);
    expect(container.querySelectorAll(".swap-leg")).toHaveLength(2);
    expect(container.querySelector(".swap-route-core__bead")).toBeNull();
    expect(container.querySelector(".swap-route-core__line")).toBeNull();
    expect(container.querySelector(".swap-scene__metrics")).toBeNull();
    expect(container.querySelectorAll(".swap-quote-card__metrics span")).toHaveLength(3);
    expect(container.querySelector(".swap-quote-card__metrics")?.textContent).toContain("Min received");
    expect(container.querySelector(".swap-quote-card__metrics")?.textContent).toContain("Slippage");
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".swap-station")?.textContent).toContain("NEO");
    expect(container.querySelector(".swap-station")?.textContent).toContain("GAS");
    expect(container.querySelectorAll(".swap-leg .neo-swap-token-icon")).toHaveLength(2);
    expect(container.querySelectorAll(".swap-station__review span")).toHaveLength(3);
    expect(container.querySelector(".swap-token-list")).toBeNull();
    expect(container.querySelector(".swap-slippage-grid")).toBeNull();
    expect(container.querySelector(".swap-amount-field")).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>(".swap-input .semi-input")?.placeholder).toBe("0");
    expect(container.textContent).toContain("NEO/GAS");
    expect(container.textContent).not.toContain("[object Object]");
  });

  it("dispatches setFromAmount on input", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.change(container.querySelector(".swap-input .semi-input") as Element, { target: { value: "10" } });

    expect(dispatch).toHaveBeenCalledWith("setFromAmount", "10");
  });

  it("keeps NEO input numeric but never silently changes a fractional transaction intent", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ fromAmount: "10.75", amountError: "NEO is indivisible" })}
        dispatch={dispatch}
      />,
    );
    const input = container.querySelector<HTMLInputElement>(".swap-input .semi-input")!;

    expect(input.inputMode).toBe("numeric");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".mx2-open-field__hint")?.textContent).toContain("NEO is indivisible");
    fireEvent.change(input, { target: { value: "10.5" } });

    expect(dispatch).toHaveBeenCalledWith("setFromAmount", "10.5");
  });

  it("dispatches executeSwap when the route is ready", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ canSwap: true, fromAmount: "10", toAmount: "50" })} dispatch={dispatch} />,
    );

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("executeSwap"));
  });

  it("dispatches connectWallet before execution when the wallet is disconnected", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ walletConnected: false })} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("connectWallet"));
    expect(dispatch).not.toHaveBeenCalledWith("executeSwap");
  });

  it("refreshes public quote data without requesting a wallet when settlement is unavailable", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ walletConnected: false, routerAvailable: false })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("Refresh");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("refreshRate"));
    expect(dispatch).not.toHaveBeenCalledWith("connectWallet");
    expect(dispatch).not.toHaveBeenCalledWith("executeSwap");
  });

  it("never presents disconnected or failed wallet balances as verified zeroes", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ walletConnected: false, balancesVerified: false, routerAvailable: false })}
        dispatch={dispatch}
      />,
    );

    const balanceCopy = Array.from(container.querySelectorAll(".swap-leg__balance")).map((node) => node.textContent);
    expect(balanceCopy).toEqual(["Balance: Connect to view", "Balance: Connect to view"]);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(container.querySelectorAll(".swap-drawer-tab")[2]);
    fireEvent.click(container.querySelector(".swap-balance-action") as Element);

    expect(dispatch).toHaveBeenCalledWith("connectWallet");
  });

  it("turns a failed or stale quote into a recoverable refresh action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          canSwap: true,
          exchangeRate: "1.25",
          fromAmount: "2",
          rateError: "Quote failed",
          routerAvailable: true,
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".swap-quote-card__summary")?.getAttribute("data-tone")).toBe("error");
    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("Refresh");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("refreshRate"));
    expect(dispatch).not.toHaveBeenCalledWith("executeSwap");
  });

  it("dispatches swapTokens and setMaxAmount from the focused swap station controls", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".swap-switch-btn") as Element);
    fireEvent.click(container.querySelector(".swap-max-btn") as Element);

    expect(dispatch).toHaveBeenCalledWith("swapTokens");
    expect(dispatch).toHaveBeenCalledWith("setMaxAmount");
  });

  it("selects token objects from the inline selector", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ showSelector: true })} dispatch={dispatch} />);
    const tokenButtons = container.querySelectorAll(".swap-selector__token");

    fireEvent.click(tokenButtons[1]);

    expect(dispatch).toHaveBeenCalledWith("selectToken", expect.objectContaining({ symbol: "GAS" }));
  });

  it("keeps secondary route controls behind drawer mode tabs", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(Array.from(container.querySelectorAll(".mx2-action-rail__row button")).map((button) => button.textContent)).not.toContain("Refresh");
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.querySelectorAll(".swap-drawer-tabs__group .semi-radio")).toHaveLength(3);
    expect(container.querySelector(".swap-drawer-panel--route")).toBeTruthy();
    expect(container.querySelectorAll(".swap-settlement-checks > div")).toHaveLength(5);
    expect(container.querySelector(".swap-settlement-checks")?.textContent).toContain("priceImpactUnavailable");
    expect(container.querySelector(".swap-slippage-grid")).toBeNull();

    expect(dispatch).not.toHaveBeenCalledWith("setSlippage", 0.1);

    const drawerTabs = container.querySelectorAll(".swap-drawer-tab");
    fireEvent.click(container.querySelector(".swap-refresh-btn") as Element);
    fireEvent.click(drawerTabs[1]);
    fireEvent.click(container.querySelector(".swap-slippage-option") as Element);
    fireEvent.click(drawerTabs[2]);
    fireEvent.click(container.querySelector(".swap-token-list button") as Element);

    expect(dispatch).toHaveBeenCalledWith("refreshRate");
    expect(dispatch).toHaveBeenCalledWith("setSlippage", 0.1);
    expect(dispatch).toHaveBeenCalledWith("selectToken", expect.objectContaining({ symbol: "NEO" }));
  });

  it("turns a persisted broadcast into the primary recovery action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const txid = `0x${"a".repeat(64)}`;
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ transactionStatus: "unverified", pendingTxid: txid, routerAvailable: true })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("checkPendingSwap");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("recoverPendingSwap"));
    expect(dispatch).not.toHaveBeenCalledWith("executeSwap");
  });

  it("guards against cross-miniapp style pollution and preserves reduced motion", () => {
    const fs = require("node:fs");
    const scss = fs.readFileSync(`${process.cwd()}/../neo-swap/src/PlayArea.scss`, "utf8");
    const source = fs.readFileSync(`${process.cwd()}/../neo-swap/src/PlayArea.tsx`, "utf8");

    expect(source).toContain("OpenUiProvider");
    expect(source).toContain("OpenUiSegmented");
    expect(source).toContain("OpenUiTextField");
    expect(source).not.toMatch(/<(input|textarea|select)\b/);
    expect(source).not.toContain('role="tab"');
    expect(source).not.toContain('role="tablist"');
    expect(scss).toMatch(/prefers-reduced-motion/);
    expect(scss).toMatch(/0\.001ms/);
    expect(scss).toMatch(/\.neo-swap-play-area \.mx2-stage__scene\s*\{[\s\S]*display:\s*block/);
    expect(scss).toMatch(/\.neo-swap-play-area \.mx2-stage__scene\s*\{[\s\S]*contain:\s*layout;[\s\S]*overflow:\s*visible/);
    expect(scss).toMatch(/\.neo-swap-play-area \.mx2-playstage,[\s\S]*\.neo-swap-play-area \.mx2-stage__scene\s*\{[\s\S]*width:\s*100%;[\s\S]*min-width:\s*0;[\s\S]*max-width:\s*100%/);
    expect(scss).toMatch(/\.swap-scene\s*\{[\s\S]*width:\s*min\(100%,\s*860px\)/);
    expect(scss).toMatch(/\.swap-scene\s*\{[\s\S]*border:\s*0/);
    expect(scss).toMatch(/\.swap-scene\s*\{[\s\S]*background:\s*transparent/);
    expect(scss).toMatch(/\.swap-terminal\s*\{[\s\S]*width:\s*min\(100%,\s*820px\)/);
    expect(scss).toMatch(/\.swap-terminal\s*\{[\s\S]*background:\s*#ffffff/);
    expect(scss).toMatch(/\.swap-terminal__body\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.14fr\) minmax\(230px,\s*0\.86fr\)/);
    expect(scss).toMatch(/\.swap-station\s*\{[\s\S]*width:\s*100%/);
    expect(scss).toMatch(/\.swap-quote-card__visual\s*\{[\s\S]*overflow:\s*hidden/);
    expect(scss).toMatch(/\.swap-quote-card__art\s*\{[\s\S]*object-fit:\s*cover/);
    expect(scss).toMatch(/\.swap-quote-card__tokens\s*\{[\s\S]*position:\s*absolute/);
    expect(source).not.toMatch(/swap-route-core__(?:bead|line)/);
    expect(scss).not.toMatch(/swap-route-core__(?:bead|line)|swap-flow-bead-y/);
    expect(scss).toMatch(/\.swap-quote-card__metrics\s*\{[\s\S]*display:\s*grid/);
    expect(scss).toMatch(/\.swap-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(scss).toMatch(/\.swap-leg\s*\{[\s\S]*background:\s*var\(--mx2-brand-light\)/);
    expect(scss).toMatch(/\.swap-input\.mx2-open-field__control\s*\{[\s\S]*border:\s*0/);
    expect(scss).toMatch(/\.swap-input \.semi-input\s*\{[\s\S]*font-size:\s*30px/);
    expect(scss).toMatch(/\.swap-slippage-grid__group \.semi-radio-checked \.swap-slippage-option\s*\{[\s\S]*background:\s*var\(--mx2-brand-light\)/);
    expect(scss).not.toMatch(/gradient/);
    expect(scss).not.toMatch(/font-size:\s*clamp/);
    expect(scss).toMatch(/\.swap-station__review\s*\{[\s\S]*display:\s*flex/);
    expect(scss).toMatch(/\.swap-leg__amount-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(scss).toMatch(/\.swap-drawer__head\s*\{[\s\S]*display:\s*flex/);
    expect(scss).toMatch(/@media \(max-width:\s*620px\)[\s\S]*\.swap-terminal__body\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(scss).toMatch(/@media \(max-width:\s*620px\)[\s\S]*\.swap-quote-card__metrics\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(scss).toMatch(/@media \(max-width:\s*620px\)[\s\S]*\.neo-swap-play-area \.mx2-action-rail__row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) 96px/);
    expect(scss).toMatch(/@media \(max-width:\s*620px\)[\s\S]*\.neo-swap-play-area \.mx2-action-rail\s*\{[\s\S]*position:\s*fixed/);
    expect(scss).toMatch(/@media \(max-width:\s*620px\)[\s\S]*\.neo-swap-play-area \.mx2-action-rail\s*\{[\s\S]*width:\s*min\(calc\(100% - 32px\),\s*480px\)/);
    expect(scss).not.toMatch(/@media \(max-width:\s*620px\)[\s\S]*\.swap-terminal\s*\{[^}]*width:\s*\d+px/);
    expect(scss).not.toMatch(/swap-scene__image|swap-scene__shade|swap-scene__metrics|stageImageUrl|swap-ticket/);
    expect(scss).not.toMatch(/\.swap-max-btn\s*\{[^}]*grid-column:\s*1 \/ -1/);
    expect(scss).not.toMatch(/backdrop-filter/);
    expect(scss).not.toMatch(/:root\s*,\s*\.mx2/);
    expect(scss).not.toMatch(/ticket-scene__backdrop|redenv-scene__backdrop|!important[^;]*(?:ticket|redenv)/);
  });
});

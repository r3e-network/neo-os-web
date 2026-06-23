import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-swap/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const neoToken = {
  symbol: "NEO",
  hash: "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
  balance: 12,
  decimals: 0,
};

const gasToken = {
  symbol: "GAS",
  hash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
  balance: 28.42,
  decimals: 8,
};

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    balance: "Balance",
    connectToPreview: "Connect wallet to preview",
    dismiss: "Close",
    enterAmount: "Enter amount",
    estSettlement: "Est. settlement",
    estSettlementValue: "~15s after wallet confirmation",
    exchangeRate: "Exchange rate",
    from: "From",
    introBody: "Connect your Neo wallet to preview the trade.",
    introHeading: "Preview before you sign",
    introStepRate: "Live cross-rate",
    introStepRateBody: "Pulled from the Morpheus data feed.",
    introStepSettle: "Settle in your wallet",
    introStepSettleBody: "Review before signing.",
    introStepSlippage: "Adjustable slippage",
    introStepSlippageBody: "Minimum received updates instantly.",
    liquidityPool: "Route liquidity",
    loadingRate: "Loading rate...",
    marketPairs: "Market",
    max: "MAX",
    minReceived: "Minimum received",
    networkFeeLabel: "Network fee",
    networkFeeValue: "Paid in GAS at signing",
    networkLabel: "Network",
    payAmountLabel: "Amount to pay",
    payWith: "Pay with",
    popularPairs: "Popular pairs",
    pricePreviewAwaiting: "Refresh to load the live rate",
    pricePreviewBody: "This is a planning quote until a router is deployed.",
    pricePreviewOnly:
      "Preview only — review every figure in your wallet before you sign.",
    pricePreviewRate: "1 {from} buys",
    pricePreviewTitle: "Live price preview",
    quoteHealth: "Quote health",
    quoteSummary: "Quote summary",
    rateAsOf: "Rate as of {time}",
    rateStale: "Rate may be stale",
    rateSourceAsOf: "Rate via Morpheus data feed, as of {time}",
    rateSourceStaleAsOf:
      "Rate via Morpheus data feed, as of {time} — may be out of date",
    rateUnavailable: "Rate unavailable",
    receiveEstimated: "You receive (estimated)",
    refreshRate: "Refresh rate",
    routeDirectValue: "Direct {pair}",
    routeModeLive: "Ready for wallet settlement",
    routeModeLiveBody: "A router is configured for this network.",
    routeModePreview: "Planning mode only",
    routeModePreviewBody: "No router is deployed on this network yet.",
    routeReview: "Route review",
    routeSourceAwaiting: "Refresh to load the quote",
    routeSourceMorpheus: "Morpheus quote loaded",
    routeStepPair: "Direct pair",
    routeStepQuote: "Oracle quote",
    routeStepWallet: "Wallet review",
    selectToken: "Select token",
    setupTradeSummary: "Set up the trade (settles when a route is enabled)",
    settlementUnavailable: "Settlement unavailable",
    slippage: "Slippage tolerance",
    slippageControl: "Slippage guard",
    slippageCustom: "Custom",
    slippageCustomLabel: "Custom slippage in percent",
    slippageHigh: "High slippage — you may receive notably less than quoted.",
    slippageHint:
      "Your trade reverts if you receive less than the minimum below.",
    slippagePreset: "Set slippage to {pct}",
    swapArrow: "to",
    subtitle: "Plan a NEO/GAS trade with live quotes.",
    swapRouteStatus: "Route status",
    swapRouteReady: "Route ready",
    swapRouteSyncing: "Syncing quote",
    swapRouteUnavailable: "Planning only",
    switchTokens: "Switch tokens",
    tabPool: "Route",
    tabSwap: "Swap",
    title: "Neo Swap",
    to: "To",
    tokenNeo: "NEO",
    tradeTicket: "Swap ticket",
  };

  let value = messages[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function state(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    availableTokens: [neoToken, gasToken],
    canSwap: false,
    exchangeRate: "1.98183469",
    fromAmount: "10",
    fromToken: neoToken,
    isSwapping: false,
    loading: false,
    minReceived: "19.719",
    rateAsOf: "12:30",
    rateLoading: false,
    rateStale: false,
    routerAvailable: false,
    selectorTarget: "",
    showSelector: false,
    slippage: "0.5%",
    slippageValue: 50,
    swapButtonText: "Swap NEO to GAS",
    toAmount: "19.8183469",
    toToken: gasToken,
    walletConnected: true,
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Neo Swap PlayArea", () => {
  it("renders a DeFi trade desk while keeping no-router settlement unavailable", () => {
    const dispatch = vi.fn();
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );

    expect(screen.getByRole("region", { name: "Swap ticket" })).toBeTruthy();
    expect(container.querySelector(".neo-swap-play-area--quoted")).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Route liquidity" }),
    ).toBeTruthy();
    expect(
      container.querySelector(
        '.neo-swap-liquidity-stage__image[src="./swap-liquidity-stage.jpg"]',
      ),
    ).toBeTruthy();
    expect(container.querySelectorAll(".neo-swap-token-orb").length).toBe(2);
    expect(
      container.querySelectorAll(".neo-swap-liquidity-lane__pulse").length,
    ).toBe(3);
    expect(
      container.querySelector(".neo-swap-liquidity-stage__status"),
    ).toBeTruthy();
    expect(screen.getByText("Live price preview")).toBeTruthy();
    expect(screen.getAllByText("Planning mode only").length).toBeGreaterThan(0);
    expect(screen.getByText("Morpheus quote loaded")).toBeTruthy();
    expect(screen.getByText("Minimum received")).toBeTruthy();

    fireEvent.click(
      screen.getByText("Set up the trade (settles when a route is enabled)"),
    );

    expect(container.querySelector(".neo-swap-flow-amount-panel.is-armed.is-quoted")).toBeTruthy();
    expect(container.querySelector(".neo-swap-flow-rail")).toBeTruthy();
    expect(container.querySelectorAll(".neo-swap-flow-token .neo-swap-token-icon").length).toBe(4);
    expect(container.querySelector(".neo-swap-amount-input")).toBeNull();
    expect((screen.getByLabelText("Amount to pay") as HTMLInputElement).value).toBe("10");

    fireEvent.change(screen.getByLabelText("Amount to pay"), {
      target: { value: "4.5" },
    });
    expect(dispatch).toHaveBeenCalledWith("setFromAmount", "4.5");

    fireEvent.click(screen.getByRole("button", { name: "MAX" }));
    expect(dispatch).toHaveBeenCalledWith("setMaxAmount");

    expect(
      (
        screen.getByRole("button", {
          name: "Settlement unavailable",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.queryByText("routeModePreview")).toBeNull();
  });

  it("keeps popular-pair selection wired to the existing action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /GAS\/NEO/ }));

    expect(dispatch).toHaveBeenCalledWith("selectPair", "gas-neo");
  });

  it("keeps the DeFi desk motion backed by reduced-motion fallbacks", () => {
    const playAreaStyles = fs.readFileSync(
      `${process.cwd()}/../neo-swap/src/PlayArea.scss`,
      "utf8",
    );
    const heroStyles = fs.readFileSync(
      `${process.cwd()}/../neo-swap/src/components/SwapHero.scss`,
      "utf8",
    );

    expect(playAreaStyles).toContain("@keyframes neo-swap-stage-drift");
    expect(playAreaStyles).toContain("@keyframes neo-swap-liquidity-pulse");
    expect(playAreaStyles).toContain("@keyframes neo-swap-orb-from");
    expect(playAreaStyles).toContain("@keyframes neo-swap-flow-panel-scan");
    expect(playAreaStyles).toContain("@keyframes neo-swap-flow-token-route");
    expect(playAreaStyles).toContain("@keyframes neo-swap-flow-token-route-mobile");
    expect(playAreaStyles).toContain("@keyframes neo-swap-flow-rail-live");
    expect(playAreaStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.neo-swap-liquidity-lane__pulse/,
    );
    expect(playAreaStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.neo-swap-flow-token/,
    );
    expect(heroStyles).toContain("@keyframes swap-hero-drift");
    expect(heroStyles).toContain("@keyframes swap-token-float");
    expect(heroStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.swap-hero-token/,
    );
  });
});

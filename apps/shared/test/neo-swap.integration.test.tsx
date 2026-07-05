import React from "react";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-swap/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const tokenState = {
  fromToken: { symbol: "NEO", hash: "neo", balance: 12, decimals: 0 },
  toToken: { symbol: "GAS", hash: "gas", balance: 325.75, decimals: 8 },
  availableTokens: [
    { symbol: "NEO", hash: "neo", balance: 12, decimals: 0 },
    { symbol: "GAS", hash: "gas", balance: 325.75, decimals: 8 },
  ],
};

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    balance: "Balance",
    connectToPreview: "Connect wallet",
    dismiss: "Dismiss",
    docSubtitle: "Swap",
    enterAmount: "Amount",
    exchangeRate: "Rate",
    from: "From",
    marketPairs: "Market",
    max: "MAX",
    minReceived: "Min",
    payAmountLabel: "Pay",
    payWith: "Pay with",
    pricePreviewAwaiting: "Awaiting",
    rateAsOf: `Rate as of ${params?.time ?? ""}`,
    receiveEstimated: "Receive",
    refreshRate: "Refresh",
    routeModeLive: "Live",
    routeModeLiveBody: "Live route",
    routeModePreview: "Preview",
    routeModePreviewBody: "Preview route",
    routeReview: "Route",
    routeSourceAwaiting: "Awaiting",
    routeSourceMorpheus: "Morpheus",
    routeStepPair: "Pair",
    routeStepQuote: "Quote",
    routeStepWallet: "Wallet",
    selectToken: "Select token",
    slippage: "Slippage",
    slippageControl: "Slippage",
    slippageHint: "Slippage hint",
    swapRouteReady: "Ready",
    swapRouteSyncing: "Syncing",
    swapRouteUnavailable: "Unavailable",
    switchTokens: "Switch",
    tabSwap: "Swap",
    to: "To",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const defaults: Record<string, unknown> = {
    ...tokenState,
    fromAmount: "",
    toAmount: "",
    exchangeRate: "",
    rateLoading: false,
    loading: false,
    isSwapping: false,
    canSwap: false,
    swapButtonText: "Swap",
    slippage: "0.5%",
    slippageValue: 50,
    minReceived: "",
    selectedPairDisplay: "NEO/GAS",
    showSelector: false,
    selectorTarget: "from",
    routerAvailable: true,
    rateStale: false,
    walletConnected: true,
  };
  return Object.fromEntries(
    Object.entries({ ...defaults, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("neo-swap integration: dispatch params + state", () => {
  it("dispatches setFromAmount on input", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.change(container.querySelector("#swap-from-amount") as HTMLInputElement, { target: { value: "10" } });

    expect(dispatch).toHaveBeenCalledWith("setFromAmount", "10");
  });

  it("does not dispatch fractional NEO from the amount input", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.change(container.querySelector("#swap-from-amount") as HTMLInputElement, { target: { value: "10.75" } });

    expect(dispatch).toHaveBeenCalledWith("setFromAmount", "10");
  });

  it("dispatches swapTokens on the route switch control", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".swap-switch-btn") as Element);

    expect(dispatch).toHaveBeenCalledWith("swapTokens");
  });

  it("dispatches executeSwap only when the route can be submitted", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ canSwap: true, fromAmount: "10", toAmount: "50" })} dispatch={dispatch} />,
    );

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("executeSwap"));
  });

  it("disables swap when route guards are not satisfied", () => {
    const { container } = render(<PlayArea t={t} state={state({ canSwap: true, rateStale: true })} dispatch={vi.fn()} />);
    const button = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;

    expect(button.disabled).toBe(true);
  });

  it("dispatches openFromSelector and openToSelector from token controls", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".swap-token-btn") as Element);
    fireEvent.click(container.querySelector(".swap-receive-value") as Element);

    expect(dispatch).toHaveBeenCalledWith("openFromSelector");
    expect(dispatch).toHaveBeenCalledWith("openToSelector");
  });

  it("dispatches selectToken with the selected token object from the drawer list", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(within(container.querySelector(".swap-drawer-tabs") as HTMLElement).getByRole("radio", { name: /Select token/ }));
    const drawerTokenButtons = container.querySelectorAll(".swap-token-list button");
    fireEvent.click(drawerTokenButtons[1]);

    expect(dispatch).toHaveBeenCalledWith("selectToken", expect.objectContaining({ symbol: "GAS" }));
  });
});

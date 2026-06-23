import { readFileSync } from "node:fs";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-price-console/src/PlayArea";
import { messages } from "../../oracle-price-console/src/locale/messages";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

type LocalizedMessage = {
  en: string;
  zh: string;
};

const appMessages = messages as Record<string, LocalizedMessage>;

function t(key: string, params: Record<string, string | number> = {}) {
  let text = appMessages[key]?.en ?? key;
  for (const [param, value] of Object.entries(params)) {
    text = text.replace(`{${param}}`, String(value));
  }
  return text;
}

function makeState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    asset: "NEO",
    priceDisplay: "$21.8500",
    networkDisplay: "mainnet",
    datafeedShort: "0xabc123...",
    datafeedHash: "0xabc123456789",
    sourceLabel: "on-chain mainnet RPC",
    errorMsg: "",
    isRequesting: false,
    freshness: "fresh",
    freshnessLabel: "Fresh - updated just now",
    freshnessTimestamp: "6/23/2026, 10:00:00 AM",
    availablePairs: ["NEO", "GAS", "BTC", "ETH"],
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

function makeProps(state = makeState()) {
  return {
    t,
    state,
    dispatch: vi.fn(async () => undefined),
  };
}

afterEach(() => cleanup());

describe("Oracle Price Console PlayArea", () => {
  it("renders a visual oracle relay stage instead of a form-only console", () => {
    const props = makeProps();
    const { container } = render(<PlayArea {...props} />);

    expect(
      container.querySelector('.price-hero__media[src="./oracle-market-stage.jpg"]'),
    ).toBeTruthy();
    expect(container.querySelector(".price-oracle-route--fresh")).toBeTruthy();
    expect(screen.getByText("Market signal to chain feed")).toBeTruthy();
    expect(screen.getByText("Market source")).toBeTruthy();
    expect(screen.getByText("Freshness gate")).toBeTruthy();
    expect(screen.getByText("On-chain feed")).toBeTruthy();
    expect(container.querySelector(".price-oracle-route__packet")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "GAS/USD" }));
    expect(props.dispatch).toHaveBeenCalledWith("updateAsset", "GAS");

    fireEvent.click(screen.getByRole("button", { name: "Read NEO/USD" }));
    expect(props.dispatch).toHaveBeenCalledWith("fetchPrice");
  });

  it("marks the relay path busy while a feed read is in flight", () => {
    const state = makeState({
      isRequesting: true,
      freshness: "idle",
      freshnessLabel: "Ready for a fresh read",
      priceDisplay: "Not available",
      freshnessTimestamp: "",
    });
    const { container } = render(<PlayArea {...makeProps(state)} />);

    const route = container.querySelector(".price-oracle-route--loading");
    expect(route).toBeTruthy();
    expect(route?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Reading live feed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reading NEO/USD" })).toBeTruthy();
    expect(container.querySelector(".price-market-state__spinner")).toBeTruthy();
    expect(container.querySelector(".price-query-spinner")).toBeTruthy();
  });

  it("keeps price relay motion backed by reduced-motion fallbacks", () => {
    const styles = readFileSync(
      "../oracle-price-console/src/PlayArea.scss",
      "utf8",
    );

    expect(styles).toContain(".price-oracle-route--loading");
    expect(styles).toContain("@keyframes price-route-packet");
    expect(styles).toContain("@keyframes price-route-packet-mobile");
    expect(styles).toContain("@keyframes price-route-node-pulse");
    expect(styles).toContain("@keyframes price-route-confirm");
    expect(styles).toContain(".price-query-spinner");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.price-oracle-route--loading \.price-oracle-route__packet[\s\S]*animation:\s*none/,
    );
  });
});

import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-price-console/src/PlayArea";
import { manifest as runtimeManifest } from "../../oracle-price-console/src/manifest";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(key: string, params?: Record<string, string | number>) {
  const m: Record<string,string> = {
    notAvailable:"—",
    priceStatusReady:"Fresh",
    feedTicketContract:"Contract",
    feedDetails:"Oracle details",
    asset:"Asset",
    sourceLabel:"Source",
    freshnessLabel:"Freshness",
    recordTimestampLabel:"On-chain write time",
    priceMetricNetwork:"Network",
    ageJustNow:"Updated",
    oracleStationEyebrow:"Oracle station",
    oracleStationTitle:"{pair} on-chain feed",
    priceRouteHint:"The quote packet moves after a read starts.",
    marketBoardTitle:"Market signal",
    stationPair:"Pair",
    latestPrice:"Latest Price",
    priceRouteSourceFallback:"Configured RPC source",
    priceRouteTitle:"Market signal to chain feed",
    priceRouteSource:"Market source",
    priceRouteFreshness:"Freshness gate",
    priceRouteQueued:"Queued for timestamp check",
    priceStatusLive:"Fresh feed result",
    priceRouteReading:"Reading live feed",
    priceRouteFeed:"On-chain feed",
    priceRouteFeedPending:"Feed contract pending",
    feedRoutePending:"Aggregate, then provider fallback",
    resolvedFeedKey:"Resolved feed key",
    rpcEndpointLabel:"RPC endpoint",
    priceSignalTitle:"Signal",
    watchlistTitle:"Market watchlist",
    pairPickerSubtitle:"Reading {pair}",
    pairSelected:"Active",
    assetHintNeo:"Governance and base asset signal.",
    assetHintGas:"Execution fuel and fee market signal.",
    assetHintBtc:"External market reference signal.",
    assetHintGeneric:"Catalog pair discovered from the feed.",
    fetchPair:"Read {pair}",
    readingPair:"Reading {pair}",
    priceReferenceTitle:"Request path",
    priceReferenceContract:"Reference contract",
    priceReferenceMethod:"Method",
    priceReferenceMethodValue:"getLatest(pair)",
    priceReferenceQuote:"Quote",
    priceReferenceQuoteValue:"USD · exact 6-decimal feed scale",
  };
  let value = m[key] ?? key;
  if (params) for (const [name, paramValue] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(paramValue));
  return value;
}
function state(o: Partial<Record<string,unknown>> = {}): ObservableState {
  const b: Record<string,unknown> = { asset:"NEO", priceDisplay:"—", networkDisplay:"", datafeedShort:"", datafeedHash:"", sourceLabel:"", feedKey:"", rpcEndpoint:"", errorMsg:"", isRequesting:false, freshness:"idle", freshnessLabel:"Fresh", freshnessTimestamp:"", sourceFreshness:"idle", sourceFreshnessLabel:"Market source time pending", sourceTimestampDisplay:"", availablePairs:["NEO","GAS","BTC"], ...o };
  return Object.fromEntries(Object.entries(b).map(([k,v]) => [k, createObservable(v)]));
}
describe("Oracle Price Console PlayArea (v2)", () => {
  it("declares the exact read-only RPC surfaces without a host-generated operation form", () => {
    const fs = require("node:fs");
    const manifest = JSON.parse(fs.readFileSync(`${process.cwd()}/../oracle-price-console/neo-manifest.json`, "utf8"));
    expect(manifest.permissions).toEqual(["read:blockchain"]);
    expect(manifest.platform.transactions).toBe(false);
    expect(manifest.operation_panel.operations).toEqual([]);
    expect(manifest).not.toHaveProperty("stateSource");
    expect(manifest.contracts).toEqual({
      "neo-n3-mainnet": "0x03013f49c42a14546c8bbe58f9d434c3517fccab",
      "neo-n3-testnet": "0x9bea75cf702f6afc09125aa6d22f082bfd2ee064",
    });
    expect(manifest.urls.banner).toBe("/miniapps/oracle-price-console/oracle-market-stage.webp");
    expect(runtimeManifest.permissions).toEqual({ datafeed: true });
    expect(runtimeManifest).not.toHaveProperty("contract");
  });
  it("renders a resource-led market feed station", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".price-station")).toBeTruthy();
    expect(container.querySelector(".price-feed-panel")).toBeTruthy();
    expect((container.querySelector(".price-station__market img") as HTMLImageElement)?.src).toContain("oracle-market-stage.webp");
    expect(container.querySelector(".price-ticket")).toBeTruthy();
    expect(container.querySelector(".price-ticket__watermark.mx2-coin")).toBeTruthy();
    expect(container.querySelector(".price-ticket__pair .mx2-coin")).toBeTruthy();
    expect(container.querySelector(".price-route")).toBeNull();
    expect(container.querySelector(".price-watchlist")).toBeTruthy();
    expect(container.querySelectorAll(".price-pair-card .mx2-coin")).toHaveLength(2);
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".price-drawer")).toBeNull();
    expect(container.textContent).toContain("NEO/USD");
    expect(container.textContent).toContain("Read NEO");
    expect(container.textContent).not.toContain("Method");
  });
  it("dispatches fetchPrice", async () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />); fireEvent.click(container.querySelector(".mx2-btn--primary") as Element); await waitFor(() => expect(d).toHaveBeenCalledWith("fetchPrice")); });
  it("dispatches updateAsset on pair card click", () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />); fireEvent.click(container.querySelectorAll(".price-pair-card")[1]); expect(d).toHaveBeenCalledWith("updateAsset", "GAS"); });
  it("keeps pair switching available while a read is in flight so stale results can be superseded", () => {
    const { container } = render(<PlayArea t={t} state={state({ isRequesting: true })} dispatch={vi.fn()} />);
    expect(Array.from(container.querySelectorAll(".price-pair-card")).every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
    expect(container.querySelector(".price-station")?.getAttribute("aria-busy")).toBe("true");
  });
  it("keeps a deep-linked catalog pair visible even when it is outside the first six entries", () => {
    const { container } = render(<PlayArea t={t} state={state({ asset: "SOL", availablePairs: ["NEO", "GAS", "BTC", "ETH", "LINK", "DOGE", "SOL"] })} dispatch={vi.fn()} />);
    expect(container.querySelector(".price-pair-card")?.textContent).toContain("SOL/USD");
    expect(container.querySelector(".price-pair-card")?.getAttribute("aria-pressed")).toBe("true");
  });
  it("renders an unverified or stale quote as stale instead of live", () => {
    const { container } = render(<PlayArea t={t} state={state({ freshness: "stale", freshnessLabel: "Timestamp unavailable — freshness unverified", freshnessTimestamp: "", sourceFreshness: "stale", sourceFreshnessLabel: "Market source is stale — 2h ago" })} dispatch={vi.fn()} />);
    expect(container.querySelector(".price-station")?.getAttribute("data-state")).toBe("stale");
    expect(container.querySelector('.price-ticket__meta > span[data-tone="warning"]')?.textContent).toContain("Market source is stale");
  });
  it("keeps secondary oracle details behind drawer tabs", () => {
    const { container } = render(<PlayArea t={t} state={state({ datafeedShort:"0xabcd…7890", datafeedHash:"0xabcdef7890", sourceLabel:"testnet oracle", feedKey:"AGG:NEO-USD", rpcEndpoint:"https://api.n3index.dev/testnet", freshnessTimestamp:"2026-07-02T12:00:00Z", priceDisplay:"$7.420000" })} dispatch={vi.fn()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const drawer = container.querySelector(".price-drawer") as HTMLElement;
    expect(drawer).toBeTruthy();
    expect(drawer.querySelector("h4")).toBeNull();
    expect(drawer.querySelector(".price-drawer-tabs__group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(drawer.querySelectorAll(".price-drawer-tabs__group .semi-radio")).toHaveLength(3);
    expect(drawer.querySelectorAll('.price-drawer-tabs [role="tab"]')).toHaveLength(0);
    expect(drawer.querySelectorAll(".price-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(drawer.querySelector(".price-drawer-tab strong")?.textContent).toContain("$7.420000");
    expect(container.querySelector(".price-drawer__panel-body")?.getAttribute("data-mode")).toBe("signal");
    expect(drawer.textContent).toContain("$7.420000");
    expect(drawer.textContent).toContain("AGG:NEO-USD");
    expect(drawer.textContent).toContain("testnet oracle");
    fireEvent.click(drawer.querySelectorAll(".price-drawer-tabs__group .semi-radio")[1]);
    expect(drawer.querySelectorAll(".price-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".price-drawer__panel-body")?.getAttribute("data-mode")).toBe("contract");
    expect(drawer.textContent).toContain("0xabcd…7890");
    expect(drawer.textContent).toContain("0xabcdef7890");
    expect(drawer.textContent).toContain("https://api.n3index.dev/testnet");
    fireEvent.click(drawer.querySelectorAll(".price-drawer-tabs__group .semi-radio")[2]);
    expect(drawer.querySelectorAll(".price-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".price-drawer__panel-body")?.getAttribute("data-mode")).toBe("reference");
    expect(drawer.textContent).toContain("getLatest(pair)");
    expect(drawer.textContent).toContain("USD · exact 6-decimal feed scale");
  });
  it("has clean foreground hierarchy and reduced-motion safeguards", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../oracle-price-console/src/PlayArea.scss`, "utf8");
    const tsx = fs.readFileSync(`${process.cwd()}/../oracle-price-console/src/PlayArea.tsx`, "utf8");
    expect(tsx).toContain("OpenUiSegmented");
    expect(tsx).toContain('dispatchSafely("fetchPrice")');
    expect(tsx).toContain(".catch(() => undefined)");
    expect(tsx).not.toContain('role="tablist"');
    expect(tsx).not.toContain('role="tab"');
    expect(s).toContain("@media (prefers-reduced-motion: reduce)");
    expect(s).toMatch(/animation-duration:\s*0\.001ms/);
    expect(s).toMatch(/price-stage-stack[\s\S]*display:\s*grid/);
    expect(s).toMatch(/\.price-station\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.18fr\) minmax\(290px,\s*0\.82fr\)/);
    expect(s).toMatch(/\.price-station\s*\{[\s\S]*align-items:\s*start/);
    expect(s).toMatch(/\.price-feed-panel\s*\{[^}]*display:\s*block/);
    expect(s).toMatch(/price-station__market[\s\S]*min-height:\s*300px/);
    expect(s).toMatch(/price-station__market[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/price-station__market img[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/price-station__market img[\s\S]*object-position:\s*center/);
    expect(s).toMatch(/price-station__market img[\s\S]*transform:\s*scale\(1\.04\)/);
    expect(s).toMatch(/price-station__market img[\s\S]*opacity:\s*1/);
    expect(s).toMatch(/price-station__market img[\s\S]*filter:\s*none/);
    expect(s).toMatch(/price-station__market::after[\s\S]*content:\s*none/);
    expect(s).not.toMatch(/price-station__market img[\s\S]*opacity:\s*0\.34/);
    expect(s).not.toMatch(/price-station__market img[\s\S]*filter:\s*saturate/);
    expect(s).toMatch(/price-ticket__watermark[\s\S]*opacity:\s*0\.1/);
    expect(s).not.toMatch(/price-route__node|price-route__arrow/);
    expect(s).toMatch(/price-ticket[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/price-watchlist__grid[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/oracle-price-play-area \.mx2-action-rail__row \.mx2-btn--primary[\s\S]*flex:\s*0 0 190px/);
    expect(s).toMatch(/\.oracle-price-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/\.oracle-price-play-area \.mx2-action-rail,[\s\S]*\.oracle-price-play-area \.mx2-drawer\s*\{[\s\S]*width:\s*min\(100%,\s*760px\)/);
    expect(s).toMatch(/\.price-drawer-tabs > \.mx2-open-field__label\s*\{[\s\S]*clip:\s*rect\(0 0 0 0\)/);
    expect(s).toMatch(/\.price-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.price-drawer-tab\s*\{[\s\S]*min-height:\s*54px/);
    expect(s).toMatch(/\.price-drawer-tab strong\s*\{[\s\S]*font-size:\s*13px/);
    expect(s).toMatch(/\.price-drawer-tabs__group \.semi-radio-checked \.price-drawer-tab,[\s\S]*\.price-drawer-tabs__group \.semi-radio:hover \.price-drawer-tab\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.price-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*20px/);
    expect(s).toMatch(/\.price-drawer-list div\s*\{[\s\S]*grid-template-columns:\s*minmax\(112px,\s*0\.35fr\) minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/@media \(max-width:\s*760px\)[\s\S]*price-station__market[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.price-drawer-tab strong\s*\{[\s\S]*display:\s*none/);
    expect(s).not.toMatch(/backdrop-filter|price-scene__backdrop|oracle-price-scene-art/);
  });
});

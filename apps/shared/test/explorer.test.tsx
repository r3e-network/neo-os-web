import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../explorer/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(key: string) { const m: Record<string,string> = { blockHeight:"Block Height", explorerReadOnly:"Explorer", docSubtitle:"Explore Neo N3.", address:"Search address/hash", search:"Search", block:"Block", explorerRecentEmptyDesc:"No recent txs." }; return m[key] ?? key; }
function state(o: Partial<Record<string,unknown>> = {}): ObservableState {
  const b: Record<string,unknown> = { mainnetHeight:"1234567", mainnetTxCount:"999999", testnetHeight:"7654321", testnetTxCount:"888888", selectedNetwork:"mainnet", recentTxCount:5, isLoading:false, isSearching:false, searchQuery:"", searchResult:null, recentTxs:[], ...o };
  return Object.fromEntries(Object.entries(b).map(([k,v]) => [k, createObservable(v)]));
}
function readPlayAreaStyles() {
  const fs = require("node:fs");
  const path = require("node:path");
  const candidates = [
    path.resolve(process.cwd(), "apps/explorer/src/PlayArea.scss"),
    path.resolve(process.cwd(), "../explorer/src/PlayArea.scss"),
  ];
  return fs.readFileSync(candidates.find((file: string) => fs.existsSync(file)) ?? candidates[0], "utf8");
}
describe("Explorer PlayArea (v2)", () => {
  it("renders the data workspace", () => { const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />); expect(container.querySelector(".explorer-workspace")).toBeTruthy(); expect(container.textContent).toContain("1234567"); });
  it("dispatches search", () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state({ searchQuery:"0xabc" })} dispatch={d} />); fireEvent.click(container.querySelector(".mx2-btn--primary") as Element); expect(d).toHaveBeenCalledWith("search"); });
  it("switches network", () => { const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />); fireEvent.click(container.querySelectorAll(".explorer-net-btn")[1]); expect(container.textContent).toContain("7654321"); });
  it("has reduced-motion", () => { const s = readPlayAreaStyles(); expect(s).toContain("@media (prefers-reduced-motion: reduce)"); });
});

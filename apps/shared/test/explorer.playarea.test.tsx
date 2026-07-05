import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../explorer/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    address: "Address",
    blockHeight: "Block Height",
    explorerLiveScanner: "Live chain scanner",
    explorerNoSignature: "No signature required",
    explorerReadOnly: "Read-only chain lookup",
    explorerRecentEmptyDesc: "Run a search or refresh chain data to populate this activity lane.",
    explorerResultReady: "Result ready",
    explorerSafetyDesc: "Explorer never requests signatures or sends assets.",
    explorerSafetyTitle: "Safety model",
    explorerScannerTargetEmpty: "Paste a tx, address, contract, or block",
    explorerSearchDeck: "Lookup scanner",
    explorerSearchDeckCopy: "Paste an on-chain identifier, choose the network lane, then inspect the public record without signing.",
    explorerSearchHint: "Paste any Neo N3 identifier and inspect it without signing.",
    explorerSearchableTypes: "Search by",
    explorerSignalReady: "Signal ready",
    explorerTipAddress: "Address",
    explorerTipBlock: "Block",
    explorerTipContract: "Contract",
    explorerTipTx: "Tx hash",
    explorerWorkflowTitle: "Explorer workflow",
    mainnet: "Mainnet",
    recentTransactions: "Recent Transactions",
    search: "Search",
    searching: "Searching...",
    searchPlaceholder: "Search tx hash, address, or contract...",
    searchResult: "Last lookup",
    searchResultNone: "None yet",
    searchUnknownDesc: "That doesn't look like a Neo N3 tx hash, address, or contract.",
    searchUnknownTitle: "Unrecognized identifier",
    sidebarNetwork: "Network",
    sidebarRecentTxs: "Recent TXs",
    testnet: "Testnet",
    transactions: "Transactions",
    viewFullRecord: "View full record",
    vmUnknown: "Unknown",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    mainnetHeight: "7,001,001",
    mainnetTxCount: "88,000,000",
    testnetHeight: "5,010,100",
    testnetTxCount: "9,000,100",
    selectedNetwork: "mainnet",
    recentTxCount: 1,
    isLoading: false,
    isSearching: false,
    searchQuery: "",
    searchResult: null,
    recentTxs: [
      {
        hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890",
        vmState: "HALT",
        blockIndex: 7001001,
      },
    ],
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, createObservable(value)]));
}

describe("Explorer PlayArea (v2)", () => {
  it("renders the live chain scanner scene without decorative background art", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".explorer-scene")).toBeTruthy();
    expect(container.querySelector(".explorer-scene__image")).toBeNull();
    expect(container.querySelector(".explorer-scene__wash")).toBeNull();
    expect(container.querySelector(".explorer-scanner")).toBeTruthy();
    expect(container.querySelector(".explorer-controls__net-group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".explorer-controls__net-group .semi-radio")).toHaveLength(2);
    expect(container.querySelector(".explorer-search-shell")).toBeTruthy();
    expect(container.querySelector(".explorer-search-box.mx2-open-field")).toBeTruthy();
    expect(container.textContent).toContain("Live chain scanner");
  });

  it("dispatches search from the primary action and Enter key", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ searchQuery: "0xabc" })} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("search"));

    fireEvent.keyDown(container.querySelector(".explorer-search-box input") as Element, { key: "Enter" });
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
  });

  it("switches the selected network without dispatching a wallet action", () => {
    const appState = state();
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(<PlayArea t={t} state={appState} dispatch={dispatch} />);

    fireEvent.click(getByRole("radio", { name: "Testnet" }));

    expect(appState.selectedNetwork.get()).toBe("testnet");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("shows search results and opens recent transaction actions in the drawer", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PlayArea
        t={t}
        state={state({
          searchResult: {
            type: "transaction",
            label: "Transfer 0xabc",
            hash: "0xabc123",
            blockIndex: 7001001,
          },
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.textContent).toContain("Transfer 0xabc");

    fireEvent.click(getByText("Recent Transactions"));
    fireEvent.click(getByText("View full record"));

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("viewTx", "0xabcdef1234567890abcdef1234567890abcdef1234567890"));
  });

  it("includes reduced-motion protections", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const candidates = [
      path.resolve(process.cwd(), "apps/explorer/src/PlayArea.scss"),
      path.resolve(process.cwd(), "../explorer/src/PlayArea.scss"),
    ];
    const styles = fs.readFileSync(candidates.find((file: string) => fs.existsSync(file)) ?? candidates[0], "utf8");

    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
  });

  it("keeps the scanner foreground-led instead of glass over a scenic backdrop", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const styleCandidates = [
      path.resolve(process.cwd(), "apps/explorer/src/PlayArea.scss"),
      path.resolve(process.cwd(), "../explorer/src/PlayArea.scss"),
    ];
    const sourceCandidates = [
      path.resolve(process.cwd(), "apps/explorer/src/PlayArea.tsx"),
      path.resolve(process.cwd(), "../explorer/src/PlayArea.tsx"),
    ];
    const styles = fs.readFileSync(styleCandidates.find((file: string) => fs.existsSync(file)) ?? styleCandidates[0], "utf8");
    const source = fs.readFileSync(sourceCandidates.find((file: string) => fs.existsSync(file)) ?? sourceCandidates[0], "utf8");

    expect(styles).toMatch(/\.explorer-controls__net-group\.mx2-open-segmented\.semi-radioGroup\s*{[\s\S]*display:\s*inline-flex/);
    expect(styles).toMatch(/\.explorer-search-box\.mx2-open-field/);
    expect(source).toContain("OpenUiSegmented");
    expect(source).toContain("OpenUiTextField");
    expect(source).not.toContain('role="radiogroup"');
    expect(source).not.toContain('role="radio"');
    expect(source).not.toContain("<input");
    expect(styles).not.toContain("explorer-scene-art");
    expect(styles).not.toContain("backdrop-filter");
    expect(styles).not.toContain("explorer-scene__image");
    expect(styles).not.toContain("explorer-scene__wash");
    expect(styles).toMatch(/\.explorer-scene\s*{[\s\S]*background:\s*[\s\S]*#ffffff/);
  });
});

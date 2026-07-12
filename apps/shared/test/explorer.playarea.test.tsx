import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../explorer/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    address: "Address",
    block: "Block",
    blockHeight: "Block Height",
    blockNotFound: "Block not found on this network",
    contract: "Contract",
    contractCalls: "Indexed Calls",
    contractMethods: "Methods",
    contractName: "Name",
    contractNotFound: "Contract not found",
    contractUpdates: "Update Counter",
    dataSources: "Data sources",
    explorerDataCached: "Cached snapshot",
    explorerDataEmpty: "No recent transactions",
    explorerDataLive: "Live chain data",
    explorerDataLoading: "Syncing chain data",
    explorerDataUnavailable: "Data temporarily unavailable",
    explorerDetails: "Record details",
    explorerHeroAlt: "Neo blockchain explorer artwork",
    explorerIndexerDescription: "Indexer-backed transaction data.",
    explorerIndexerUnavailableDesc: "The indexer is unavailable, so address activity cannot be confirmed.",
    explorerNetworkTelemetry: "Network telemetry",
    explorerNoMatchTitle: "No {type} record on this network",
    explorerPollingDescription: "Polling cadence.",
    explorerRecentEmptyDesc: "No recent transactions loaded.",
    explorerRecentUnavailable: "Recent transactions are unavailable.",
    explorerRecordFound: "Public record found",
    explorerScannerTargetEmpty: "Paste a tx, address, contract, or block",
    explorerSearchDeck: "Chain search",
    explorerSearchHint: "Paste any Neo N3 identifier and inspect it.",
    explorerSearchScope: "Search transactions, addresses, contracts, and blocks",
    explorerSearchableTypes: "Search by",
    explorerServiceUnavailable: "Explorer service is temporarily unavailable. Try again shortly.",
    explorerSourceApi: "Explorer API",
    explorerSourceDescription: "RPC-backed block data.",
    explorerSourceIndexer: "N3 indexer",
    explorerSourceIndexerUnavailable: "Indexer unavailable",
    explorerSourceRpc: "Neo N3 RPC",
    explorerSourceSummary: "RPC height · indexed activity",
    explorerTipAddress: "Address",
    explorerTipBlock: "Block",
    explorerTipContract: "Contract",
    explorerTipTx: "Tx hash",
    explorerTypeBlock: "Block",
    gasConsumed: "Gas Consumed",
    hash: "Hash",
    indexedTransactions: "Indexed transactions",
    mainnet: "Mainnet",
    previousBlock: "Previous block",
    rawRecord: "Raw API record",
    recentTransactions: "Recent Transactions",
    refresh: "Refresh",
    resultNetwork: "Network",
    resultSource: "Data source",
    resultStatus: "VM state",
    retrySearch: "Retry search",
    search: "Search",
    searching: "Searching...",
    searchFailed: "Search failed",
    searchPlaceholder: "Block height, tx hash, address, or contract",
    searchResult: "Last lookup",
    searchResultNone: "None yet",
    searchUnknownDesc: "That doesn't look like a Neo N3 identifier.",
    searchUnknownTitle: "Unrecognized identifier",
    sender: "Sender",
    sidebarNetwork: "Network",
    testnet: "Testnet",
    time: "Time",
    title: "Neo Explorer",
    transaction: "Transaction",
    transactionNotFound: "Transaction not found on this network",
    transactions: "Transactions",
    viewFullRecord: "View full record",
    vmUnknown: "Unknown",
  };
  let value = messages[key] ?? key;
  if (params) for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

const RECENT_HASH = `0x${"ab".repeat(32)}`;
const TX_HASH = `0x${"cd".repeat(32)}`;
const CONTRACT_HASH = `0x${"12".repeat(20)}`;

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
    statsStatus: "live",
    recentStatus: "live",
    statsUpdatedAt: 1_800_000_000_000,
    recentTxs: [{ hash: RECENT_HASH, vmState: "HALT", blockIndex: 7_001_001 }],
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, createObservable(value)]));
}

describe("Explorer PlayArea production workspace", () => {
  it("leads with one search command, real idle artwork, and a data rail", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".explorer-controls")).toBeTruthy();
    expect(container.querySelector(".explorer-workspace")).toBeTruthy();
    expect(container.querySelector('.explorer-result-surface[data-state="idle"]')).toBeTruthy();
    expect((container.querySelector(".explorer-result-surface--idle img") as HTMLImageElement).src).toContain("banner.webp");
    expect(container.querySelector(".explorer-live-rail")).toBeTruthy();
    expect(container.querySelector(".explorer-network-orbit")).toBeNull();
    expect(container.querySelector(".explorer-scanner__lens")).toBeNull();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.textContent).toContain("7,001,001");
    expect(container.textContent).toContain("88,000,000");
  });

  it("dispatches search from the primary action and Enter key", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ searchQuery: TX_HASH })} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("search"));
    fireEvent.keyDown(container.querySelector(".explorer-search-box input") as Element, { key: "Enter" });
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
  });

  it("switches network without invoking a wallet action", () => {
    const appState = state();
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole, container } = render(<PlayArea t={t} state={appState} dispatch={dispatch} />);

    fireEvent.click(getByRole("radio", { name: "Testnet" }));
    expect(appState.selectedNetwork.get()).toBe("testnet");
    expect(container.querySelector(".explorer-live-rail")?.textContent).toContain("5,010,100");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("renders the real fields returned for a transaction", () => {
    const result = {
      type: "transaction",
      found: true,
      network: "mainnet",
      source: "rpc",
      query: TX_HASH,
      data: {
        hash: TX_HASH,
        sender: CONTRACT_HASH,
        vm_state: "HALT",
        block_index: 7_001_001,
        gas_consumed: "1200000",
        block_time: "2026-07-12T00:00:00.000Z",
      },
    };
    const { container } = render(<PlayArea t={t} state={state({ searchResult: result })} dispatch={vi.fn()} />);

    expect(container.querySelector('.explorer-result-surface[data-state="ready"]')).toBeTruthy();
    expect(container.querySelector(".explorer-object-id")?.textContent).toBe(TX_HASH);
    expect(container.querySelector(".explorer-field-grid")?.textContent).toContain("HALT");
    expect(container.querySelector(".explorer-field-grid")?.textContent).toContain("7,001,001");
    expect(container.querySelector(".explorer-field-grid")?.textContent).toContain("1200000");
    expect(container.textContent).toContain("Neo N3 RPC");
  });

  it("renders block, address, and contract result anatomy from API-shaped records", () => {
    const block = render(
      <PlayArea t={t} state={state({ searchResult: {
        type: "block", found: true, network: "mainnet", query: "7001001",
        data: { index: 7_001_001, hash: TX_HASH, tx_count: 3, time: 1_800_000_000, previousblockhash: RECENT_HASH },
      } })} dispatch={vi.fn()} />,
    );
    expect(block.container.querySelector(".explorer-field-grid")?.textContent).toContain("Previous block");
    expect(block.container.querySelector(".explorer-field-grid")?.textContent).toContain("3");
    block.unmount();

    const address = render(
      <PlayArea t={t} state={state({ searchResult: {
        type: "address", found: true, network: "mainnet", address: "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw", tx_count: 1,
        transactions: [{ tx_hash: TX_HASH, role: "sender" }],
      } })} dispatch={vi.fn()} />,
    );
    expect(address.container.querySelector(".explorer-related-list")?.textContent).toContain("sender");
    address.unmount();

    const contract = render(
      <PlayArea t={t} state={state({ searchResult: {
        type: "contract", found: true, network: "testnet", source: "rpc", contract_hash: CONTRACT_HASH,
        call_count: 0, data: { updatecounter: 2, manifest: { name: "SampleContract", abi: { methods: [{ name: "ping" }] } } },
      } })} dispatch={vi.fn()} />,
    );
    expect(contract.container.querySelector(".explorer-field-grid")?.textContent).toContain("SampleContract");
    expect(contract.container.querySelector(".explorer-field-grid")?.textContent).toContain("Methods1");
  });

  it("distinguishes invalid, not-found, unavailable, and loading states", () => {
    const invalid = render(<PlayArea t={t} state={state({ searchQuery: "0xabc", searchResult: { type: "invalid", found: false, query: "0xabc" } })} dispatch={vi.fn()} />);
    expect(invalid.container.querySelector('[data-state="invalid"]')?.textContent).toContain("Unrecognized identifier");
    expect(invalid.container.querySelector(".explorer-search-box input")?.getAttribute("aria-invalid")).toBe("true");
    invalid.unmount();

    const missing = render(<PlayArea t={t} state={state({ searchResult: { type: "block", found: false, network: "testnet", query: "9999999999" } })} dispatch={vi.fn()} />);
    expect(missing.container.querySelector('[data-state="empty"]')?.textContent).toContain("Block not found on this network");
    missing.unmount();

    const unavailable = render(<PlayArea t={t} state={state({ searchQuery: "1", searchResult: { type: "unavailable", found: false, query: "1" } })} dispatch={vi.fn()} />);
    expect(unavailable.container.querySelector('[data-state="error"]')?.textContent).toContain("Explorer service is temporarily unavailable");
    expect((unavailable.container.querySelector(".mx2-btn--primary") as HTMLButtonElement).textContent).toContain("Retry search");
    unavailable.unmount();

    const loading = render(<PlayArea t={t} state={state({ isSearching: true })} dispatch={vi.fn()} />);
    expect(loading.container.querySelector('[data-state="loading"]')?.getAttribute("aria-busy")).toBe("true");
    loading.unmount();

    const indexerUnavailable = render(<PlayArea t={t} state={state({ searchQuery: "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw", searchResult: {
      type: "address", found: false, network: "mainnet", source: "indexer_unavailable", address: "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw",
    } })} dispatch={vi.fn()} />);
    expect(indexerUnavailable.container.querySelector('[data-state="error"]')?.textContent).toContain("address activity cannot be confirmed");
    expect((indexerUnavailable.container.querySelector(".mx2-btn--primary") as HTMLButtonElement).textContent).toContain("Retry search");
  });

  it("opens raw evidence and dispatches recent transaction inspection", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const result = { type: "transaction", found: true, network: "mainnet", query: TX_HASH, data: { hash: TX_HASH, vm_state: "HALT" } };
    const { container, getByText } = render(<PlayArea t={t} state={state({ searchResult: result })} dispatch={dispatch} />);

    fireEvent.click(getByText("Record details"));
    expect(container.querySelector(".explorer-drawer-result pre")?.textContent).toContain('"vm_state": "HALT"');
    fireEvent.click(getByText("View full record"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("viewTx", RECENT_HASH));
  });

  it("labels cached and unavailable telemetry without turning either into live data", () => {
    const cached = render(<PlayArea t={t} state={state({ statsStatus: "cached" })} dispatch={vi.fn()} />);
    expect(cached.container.querySelector('.explorer-status-dot[data-status="cached"]')).toBeTruthy();
    expect(cached.container.textContent).toContain("Cached snapshot");
    cached.unmount();

    const unavailable = render(<PlayArea t={t} state={state({ recentTxs: [], recentTxCount: 0, recentStatus: "unavailable" })} dispatch={vi.fn()} />);
    expect(unavailable.container.querySelector('.explorer-recent-state[data-status="unavailable"]')?.textContent).toContain("Recent transactions are unavailable");
    unavailable.unmount();

    const cachedEmpty = render(<PlayArea t={t} state={state({ recentTxs: [], recentTxCount: 0, recentStatus: "cached" })} dispatch={vi.fn()} />);
    expect(cachedEmpty.container.querySelector('.explorer-recent-state[data-status="cached"] button')?.textContent).toContain("Refresh");
  });

  it("uses the shared lightweight controls, real WebP asset, and responsive data layout", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const appRoot = path.resolve(process.cwd(), "../explorer");
    const source = fs.readFileSync(path.join(appRoot, "src/PlayArea.tsx"), "utf8");
    const styles = fs.readFileSync(path.join(appRoot, "src/PlayArea.scss"), "utf8");

    expect(source).toContain('from "@shared/components-react/v2/OpenUiLite"');
    expect(source).toContain('EXPLORER_BANNER_ART = "banner.webp"');
    expect(source).toContain("explorer-field-grid");
    expect(source).not.toContain("eyebrow:");
    expect(source).not.toContain("score={[");
    expect(source).not.toContain("explorer-network-orbit");
    expect(source).not.toContain("explorer-scanner__lens");
    expect(styles).toMatch(/\.explorer-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.65fr\) minmax\(250px,\s*0\.72fr\)/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.explorer-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
    expect(styles).not.toContain("backdrop-filter");
    expect(styles).not.toContain("explorer-network-orbit");
    expect(styles).not.toContain("explorer-scanner__lens");
  });
});

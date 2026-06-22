/**
 * Explorer miniapp — regression tests for two audit findings.
 *
 *  explorer-1: hero/metrics figures rendered "—" forever because PlayArea
 *              re-parsed the already-formatted, comma-grouped figure strings
 *              with Number() (→ NaN). The figures must render the live values.
 *
 *  explorer-2: toggling the network never refetched the recent-tx list, so the
 *              list silently disagreed with the selected network. set() on
 *              selectedNetwork must trigger a recent-tx reload scoped to it.
 */

import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState, type Observable } from "../react/context";
import { formatNumber } from "../utils/format";
import PlayArea from "../../explorer/src/PlayArea";
import SearchResultDisplay from "../../explorer/src/components/SearchResultDisplay";
import { useExplorer } from "../../explorer/src/composables/useExplorer";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    title: "Neo Explorer",
    docSubtitle: "Browse Neo N3 blockchain data in real-time",
    docDescription: "Explorer provides a comprehensive view of the Neo N3 blockchain.",
    blockHeight: "Block Height",
    transactions: "Transactions",
    mainnet: "Mainnet",
    testnet: "Testnet",
    notAvailable: "N/A",
    loading: "Loading...",
    explorerReadOnly: "Read-only chain lookup",
    explorerHeroAlt: "Neo blockchain explorer scanner",
    explorerSignalReady: "Signal ready",
    explorerMainnetHint: "Production network",
    explorerTestnetHint: "Testing network",
    explorerSearchDeck: "Lookup scanner",
    explorerSearchDeckCopy: "Paste an on-chain identifier, choose the network lane, then inspect the public record without signing.",
    sidebarNetwork: "Network",
    sidebarRecentTxs: "Recent TXs",
    searchResult: "Search Result",
    explorerResultReady: "Result ready",
    explorerSearchScope: "Search transactions",
    explorerSearchHint: "Paste any Neo N3 identifier and inspect it without signing.",
    searchPlaceholder: "Search tx hash, address, or contract...",
    search: "Search",
    searching: "Searching...",
    pleaseEnterQuery: "Please enter a search query",
    recentTransactions: "Recent Transactions",
    explorerRecentEmptyTitle: "No recent transactions loaded",
    explorerRecentEmptyDesc: "Run a search or refresh chain data to populate this activity lane.",
    explorerSearchableTypes: "Search by",
    explorerTipTx: "Tx hash",
    explorerTipAddress: "Address",
    explorerTipContract: "Contract",
    vmHalt: "HALT",
    vmFault: "FAULT",
    vmUnknown: "Unknown",
    contract: "Contract",
    contractName: "Name",
    contractMethods: "Methods",
    contractUpdates: "Update Counter",
    contractCalls: "Indexed Calls",
    contractNotFound: "Contract not found",
    noResults: "No results found",
    searchUnknownTitle: "Unrecognized identifier",
    searchUnknownDesc: "That doesn't look like a Neo N3 tx hash, address, or contract.",
    transactionNotFound: "Transaction not found on this network",
    blockNotFound: "Block not found on this network",
    addressNoActivity: "No indexed activity for this address",
    explorerServiceUnavailable: "Explorer service is temporarily unavailable.",
    hash: "Hash:",
    block: "Block:",
    time: "Time:",
    sender: "Sender:",
    addressLabel: "Address:",
    transactionsLabel: "Transactions:",
  };
  return messages[key] ?? key;
}

/**
 * Mirror exactly how main.tsx binds the figure observables: each exposes the
 * already-formatted string (formatNumber(n, 0)) or the "N/A" placeholder.
 */
function formattedFigure(value: number | null): Observable {
  const inner = createObservable(value);
  return {
    get: () => (typeof inner.get() === "number" ? formatNumber(inner.get() as number, 0) : t("notAvailable")),
    set: (v: unknown) => inner.set(v as number | null),
    subscribe: (listener) => inner.subscribe(listener),
  };
}

function playState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  return {
    mainnetHeight: formattedFigure(5_123_456),
    mainnetTxCount: formattedFigure(98_765_432),
    testnetHeight: formattedFigure(2_222_333),
    testnetTxCount: formattedFigure(4_444_555),
    recentTxCount: createObservable(3),
    selectedNetwork: createObservable("mainnet"),
    searchQuery: createObservable(""),
    isLoading: createObservable(false),
    isSearching: createObservable(false),
    searchResult: createObservable(null),
    recentTxs: createObservable([]),
    ...overrides,
  } as ObservableState;
}

describe("Explorer PlayArea — live figures (explorer-1)", () => {
  it("renders comma-grouped live block height and tx count, not the pending placeholder", () => {
    render(<PlayArea t={t} state={playState()} dispatch={vi.fn(async () => undefined)} />);

    // The active (mainnet) figures must appear verbatim from the formatted string.
    expect(screen.getAllByText("5,123,456").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("98,765,432").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the resource-led scanner surface and network cards", () => {
    const state = playState();
    const { container } = render(
      <PlayArea t={t} state={state} dispatch={vi.fn(async () => undefined)} />,
    );

    expect(
      container.querySelector('.explorer-hero__media img[src="./banner.jpg"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('.explorer-hero__badge img[src="./logo.jpg"]'),
    ).toBeTruthy();
    expect(container.querySelector(".explorer-scan-console__beam")).toBeTruthy();
    expect(
      container.querySelector('.search-console__stage img[src="./logo.jpg"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('.recent-empty-state__beacon img[src="./logo.jpg"]'),
    ).toBeTruthy();

    const mainnet = screen.getByRole("radio", { name: "Mainnet Production network" });
    const testnet = screen.getByRole("radio", { name: "Testnet Testing network" });
    expect(mainnet.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(testnet);
    expect(state.selectedNetwork?.get?.()).toBe("testnet");
  });

  it("keeps the scanner motion reduced-motion safe", () => {
    const playAreaStyles = readFileSync(
      resolve(process.cwd(), "../explorer/src/PlayArea.scss"),
      "utf8",
    );
    const searchStyles = readFileSync(
      resolve(process.cwd(), "../explorer/src/components/SearchPanel.scss"),
      "utf8",
    );
    const recentStyles = readFileSync(
      resolve(process.cwd(), "../explorer/src/components/RecentTransactions.scss"),
      "utf8",
    );

    expect(playAreaStyles).toContain("@keyframes explorer-scanner-sweep");
    expect(playAreaStyles).toContain("@keyframes explorer-banner-drift");
    expect(searchStyles).toContain("@keyframes search-console-pulse");
    expect(recentStyles).toContain("@keyframes recent-beacon-sweep");
    expect(`${playAreaStyles}\n${searchStyles}\n${recentStyles}`).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/,
    );
  });

  it("falls back to the '—' placeholder only when a figure is genuinely unavailable, and shows a loaded zero verbatim", () => {
    render(
      <PlayArea
        t={t}
        state={playState({
          // null source = not loaded yet → the calm em-dash placeholder.
          mainnetHeight: formattedFigure(null),
          // a real fetched 0 = loaded-and-genuinely-zero → shown as "0", never
          // collapsed to a dash (em-dash means data-not-loaded, real 0 is real).
          mainnetTxCount: formattedFigure(0),
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.queryByText("N/A")).toBeNull();
    // The unavailable block height collapses to "—" (plus the search-result tile).
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    // The loaded zero tx-count renders as a real "0".
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });

  it("switches the inline figures to the testnet values when that network is active", () => {
    render(
      <PlayArea
        t={t}
        state={playState({ selectedNetwork: createObservable("testnet") })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getAllByText("2,222,333").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("4,444,555").length).toBeGreaterThanOrEqual(1);
  });
});

describe("Explorer composable — network toggle refetches recent txs (explorer-2)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Track the network query param for each /recent fetch so we can assert the
    // list is re-scoped on toggle. /stats requests return an empty stats object.
    fetchMock = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/recent")) {
        const network = u.includes("network=testnet") ? "testnet" : "mainnet";
        return {
          ok: true,
          json: async () => ({
            transactions: [{ hash: `0x${network}tx`, vmState: "HALT", blockTime: "1700000000" }],
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({ mainnet: { height: 1, txCount: 1 }, testnet: { height: 2, txCount: 2 } }),
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function deps() {
    return {
      chain: {} as never,
      eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as never,
      t: ((k: string) => k) as (key: string) => string,
    };
  }

  it("loads mainnet txs initially then reloads testnet txs after the network changes", async () => {
    const explorer = useExplorer(deps());
    explorer.stopPolling(); // never start the live poller in tests

    await explorer.loadAll();
    explorer.stopPolling();

    const recentUrls = () => fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/recent"));

    expect(recentUrls().some((u) => u.includes("network=mainnet"))).toBe(true);
    expect(explorer.recentTxs.get()[0]?.hash).toBe("0xmainnettx");

    // Toggling the network is exactly what PlayArea's onUpdateSelectedNetwork does.
    explorer.selectedNetwork.set("testnet");

    // The subscription kicks off an async reload — wait for it to settle.
    await vi.waitFor(() => {
      expect(recentUrls().some((u) => u.includes("network=testnet"))).toBe(true);
    });
    await vi.waitFor(() => {
      expect(explorer.recentTxs.get()[0]?.hash).toBe("0xtestnettx");
    });

    explorer.stopPolling();
  });

  // explorer-5: switching networks must also clear the previous network's search
  // result so the metrics-strip "Search result" tile doesn't imply the new
  // network returned the old hit.
  it("clears the stale search result when the network is toggled", async () => {
    const explorer = useExplorer(deps());
    explorer.stopPolling();
    await explorer.loadAll();
    explorer.stopPolling();

    explorer.searchResult.set({ type: "contract", found: true });
    expect(explorer.searchResult.get()).not.toBeNull();

    explorer.selectedNetwork.set("testnet");
    expect(explorer.searchResult.get()).toBeNull();

    explorer.stopPolling();
  });

  it("throws a friendly service error instead of leaking raw JSON parser details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token '<', \"<!doctype \"... is not valid JSON");
        },
      })) as never,
    );

    const explorer = useExplorer(deps());
    explorer.stopPolling();
    explorer.searchQuery.set("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

    await expect(explorer.search()).rejects.toThrow("explorerServiceUnavailable");
    expect(explorer.searchResult.get()).toBeNull();
    expect(explorer.isSearching.get()).toBe(false);

    explorer.stopPolling();
  });
});

/**
 * explorer-3: contract lookup is advertised everywhere (placeholder, docs,
 * features) but SearchResultDisplay had no `type === "contract"` branch, so a
 * contract identifier rendered the "Search Result" title above a blank card.
 * The branch must surface the contract hash, manifest metadata, and call count.
 */
describe("Explorer SearchResultDisplay — contract renderer (explorer-3)", () => {
  const formatTime = (v: unknown) => String(v ?? "");

  it("renders contract hash, name, method/update counts, and indexed calls from an RPC-backed result", () => {
    const result = {
      type: "contract",
      found: true,
      network: "mainnet",
      contract_hash: "0x1234567890abcdef1234567890abcdef12345678",
      call_count: 7,
      calls: [],
      data: {
        updatecounter: 3,
        manifest: {
          name: "MyToken",
          abi: { methods: [{ name: "transfer" }, { name: "balanceOf" }] },
        },
      },
    };

    render(<SearchResultDisplay t={t} result={result} formatTime={formatTime} />);

    expect(screen.getByText("0x1234567890abcdef1234567890abcdef12345678")).toBeTruthy();
    expect(screen.getByText("MyToken")).toBeTruthy();
    // 2 methods in the abi
    expect(screen.getByText("2")).toBeTruthy();
    // updatecounter
    expect(screen.getByText("3")).toBeTruthy();
    // call_count (indexed calls)
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("renders the contract hash and a not-found notice for an unindexed contract (found:false)", () => {
    const result = {
      type: "contract",
      found: false,
      network: "mainnet",
      contract_hash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      call_count: 0,
      calls: [],
    };

    render(<SearchResultDisplay t={t} result={result} formatTime={formatTime} />);

    expect(screen.getByText("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd")).toBeTruthy();
    expect(screen.getByText("Contract not found")).toBeTruthy();
  });
});

/**
 * explorer-4: the API returns {type:'unknown'} for malformed queries and
 * {type:'transaction'|'block'|'address', found:false} for valid-shaped-but-
 * missing ones. SearchResultDisplay had no 'unknown' branch (title-only, blank
 * card) and rendered tx/block/address cards full of blank rows when found:false.
 * Both must now surface an explicit, type-aware not-found notice.
 */
describe("Explorer SearchResultDisplay — unknown / not-found branches (explorer-4)", () => {
  const formatTime = (v: unknown) => String(v ?? "");

  it("guides the user on an unrecognized identifier instead of an empty card", () => {
    const result = { type: "unknown", found: false, query: "garbage" };
    render(<SearchResultDisplay t={t} result={result} formatTime={formatTime} />);

    expect(screen.getByText("Unrecognized identifier")).toBeTruthy();
    expect(
      screen.getByText("That doesn't look like a Neo N3 tx hash, address, or contract."),
    ).toBeTruthy();
  });

  it("shows a transaction-not-found notice (not a card of blank rows) for found:false", () => {
    const result = { type: "transaction", found: false, network: "mainnet" };
    render(<SearchResultDisplay t={t} result={result} formatTime={formatTime} />);

    expect(screen.getByText("Transaction not found on this network")).toBeTruthy();
    // No blank tx field labels should render.
    expect(screen.queryByText("Hash:")).toBeNull();
    expect(screen.queryByText("Sender:")).toBeNull();
  });

  it("shows a block-not-found notice for a missing block", () => {
    const result = { type: "block", found: false, network: "mainnet", query: "999999999" };
    render(<SearchResultDisplay t={t} result={result} formatTime={formatTime} />);

    expect(screen.getByText("Block not found on this network")).toBeTruthy();
    expect(screen.queryByText("Block:")).toBeNull();
  });

  it("shows a no-activity notice for an address with no indexed transactions", () => {
    const result = {
      type: "address",
      found: false,
      address: "Nxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      tx_count: 0,
      transactions: [],
    };
    render(<SearchResultDisplay t={t} result={result} formatTime={formatTime} />);

    expect(screen.getByText("No indexed activity for this address")).toBeTruthy();
    // The blank address-card rows must not render.
    expect(screen.queryByText("Address:")).toBeNull();
  });

  it("still renders the normal transaction card when found:true", () => {
    const result = {
      type: "transaction",
      found: true,
      data: { hash: "0xdeadbeef", block_index: 42, sender: "Nsender" },
    };
    render(<SearchResultDisplay t={t} result={result} formatTime={formatTime} />);

    expect(screen.getByText("0xdeadbeef")).toBeTruthy();
    expect(screen.getByText("Nsender")).toBeTruthy();
  });
});

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
import { cleanup, render, screen } from "@testing-library/react";
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
    explorerReadOnly: "Read-only chain lookup",
    explorerMainnetHint: "Production network",
    explorerTestnetHint: "Testing network",
    sidebarNetwork: "Network",
    sidebarRecentTxs: "Recent TXs",
    searchResult: "Search Result",
    explorerResultReady: "Result ready",
    explorerSearchScope: "Search transactions",
    searching: "Searching...",
    contract: "Contract",
    contractName: "Name",
    contractMethods: "Methods",
    contractUpdates: "Update Counter",
    contractCalls: "Indexed Calls",
    contractNotFound: "Contract not found",
    noResults: "No results found",
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
    expect(screen.getByText("5,123,456")).toBeTruthy();
    expect(screen.getByText("98,765,432")).toBeTruthy();
  });

  it("falls back to the '—' placeholder only when a figure is genuinely unavailable", () => {
    render(
      <PlayArea
        t={t}
        state={playState({
          mainnetHeight: formattedFigure(null),
          mainnetTxCount: formattedFigure(0),
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    // "N/A" (null source) and "0" (unsynced) both collapse to the calm em-dash.
    expect(screen.queryByText("N/A")).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("switches the inline figures to the testnet values when that network is active", () => {
    render(
      <PlayArea
        t={t}
        state={playState({ selectedNetwork: createObservable("testnet") })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText("2,222,333")).toBeTruthy();
    expect(screen.getByText("4,444,555")).toBeTruthy();
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

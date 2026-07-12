import { describe, expect, it, vi } from "vitest";
import type { MiniAppFramework } from "../react";
import {
  classifyExplorerQuery,
  normalizeExplorerSearchResult,
  normalizeExplorerStats,
  useExplorer,
} from "../../explorer/src/composables/useExplorer";

const ADDRESS = "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw";
const TX_HASH = `0x${"ab".repeat(32)}`;
const CONTRACT_HASH = `0x${"cd".repeat(20)}`;

function framework() {
  const cache = new Map<string, unknown>();
  return {
    storage: {
      local: {
        get: vi.fn((key: string) => cache.get(key) ?? null),
        set: vi.fn((key: string, value: unknown) => cache.set(key, value)),
        delete: vi.fn((key: string) => cache.delete(key)),
      },
    },
    lifecycle: {
      poll: vi.fn(() => vi.fn()),
    },
  } as unknown as MiniAppFramework;
}

describe("Explorer production domain logic", () => {
  it("matches the exact identifier forms accepted by the production API", () => {
    expect(classifyExplorerQuery("7001001")).toBe("block");
    expect(classifyExplorerQuery(TX_HASH)).toBe("hash");
    expect(classifyExplorerQuery(CONTRACT_HASH)).toBe("contract");
    expect(classifyExplorerQuery(ADDRESS)).toBe("address");
    expect(classifyExplorerQuery("0xabc")).toBeNull();
    expect(classifyExplorerQuery("NnotAValidNeoAddress12345678901234")).toBeNull();
    expect(classifyExplorerQuery("12345678901")).toBeNull();
  });

  it("normalizes RPC/indexer stats without presenting failure sentinels as live zeroes", () => {
    expect(normalizeExplorerStats({
      mainnet: { height: 7_001_001, txCount: 88_000_000, txCountSource: "indexer" },
      testnet: { height: 0, txCount: 123, txCountSource: "unavailable" },
      timestamp: 1_800_000_000_000,
    })).toEqual({
      mainnet: { height: 7_001_001, txCount: 88_000_000, txCountSource: "indexer" },
      testnet: { height: null, txCount: null, txCountSource: "unavailable" },
      timestamp: 1_800_000_000_000,
    });
    expect(normalizeExplorerStats({ mainnet: {}, testnet: {} })).toBeNull();
    expect(normalizeExplorerStats(null)).toBeNull();
  });

  it("binds a search result to the submitted query and selected network", () => {
    expect(normalizeExplorerSearchResult({
      type: "transaction",
      found: true,
      source: "rpc",
      data: { hash: TX_HASH },
    }, TX_HASH, "testnet")).toMatchObject({
      type: "transaction",
      found: true,
      source: "rpc",
      network: "testnet",
      query: TX_HASH,
    });

    expect(normalizeExplorerSearchResult({ type: "block", found: false, network: "mainnet" }, "999", "testnet")).toMatchObject({
      type: "unavailable",
      found: false,
      network: "testnet",
      query: "999",
      source: "network_mismatch",
      reportedNetwork: "mainnet",
    });
  });

  it("turns invalid and standalone-static searches into explicit inline states", async () => {
    const explorer = useExplorer({ app: framework(), t: (key) => key });

    explorer.searchQuery.set("0xabc");
    await explorer.search();
    expect(explorer.searchResult.get()).toMatchObject({ type: "invalid", found: false, query: "0xabc" });

    explorer.searchQuery.set(TX_HASH);
    await explorer.search();
    expect(explorer.searchResult.get()).toMatchObject({
      type: "unavailable",
      found: false,
      network: "mainnet",
      query: TX_HASH,
    });
    expect(explorer.isSearching.get()).toBe(false);
  });
});

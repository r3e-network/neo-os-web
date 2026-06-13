import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMorpheusDataFeed } from "../composables/useMorpheusDataFeed";

/**
 * Real-node fixture (captured 2026-06-12 from api.n3index.dev/mainnet):
 *
 *   invokefunction 0x03013f49c42a14546c8bbe58f9d434c3517fccab getLatest
 *     ["TWELVEDATA:NEO-USD"]
 *
 * Struct fields: [pair, dataTimestamp, price, recordTimestamp, signature,
 * flag]. Timestamps are epoch SECONDS (1781231101 = 2026-06-12) and the
 * price integer is scaled by 10^6 (2185000 = 2.185 USD).
 */
const LIVE_STRUCT = {
  type: "Struct",
  value: [
    { type: "ByteString", value: "VFdFTFZFREFUQTpORU8tVVNE" },
    { type: "Integer", value: "1781231101" },
    { type: "Integer", value: "2185000" },
    { type: "Integer", value: "1781231101" },
    { type: "ByteString", value: "b3bcd664405adedbc9d2d09183c1fb19" },
    { type: "Integer", value: "0" },
  ],
};

function rpcResponse(result: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  };
}

describe("useMorpheusDataFeed — freshness metadata", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getPriceWithMeta returns price together with both feed timestamps", async () => {
    fetchMock.mockResolvedValue(
      rpcResponse({ state: "HALT", exception: null, stack: [LIVE_STRUCT] }),
    );
    const feed = useMorpheusDataFeed({ network: "mainnet", rpcUrl: "https://rpc.test.local" });

    const quote = await feed.getPriceWithMeta("NEO");

    expect(quote).toEqual({
      price: 2.185,
      dataTimestamp: 1781231101,
      recordTimestamp: 1781231101,
    });
    expect(feed.error.get()).toBeNull();
  });

  it("getPrice keeps the legacy bare-number contract", async () => {
    fetchMock.mockResolvedValue(
      rpcResponse({ state: "HALT", exception: null, stack: [LIVE_STRUCT] }),
    );
    const feed = useMorpheusDataFeed({ network: "mainnet", rpcUrl: "https://rpc.test.local" });

    await expect(feed.getPrice("NEO")).resolves.toBe(2.185);
  });

  it("defaults timestamps to 0 when the struct omits or malforms them", async () => {
    fetchMock.mockResolvedValue(
      rpcResponse({
        state: "HALT",
        exception: null,
        stack: [
          {
            type: "Struct",
            value: [
              { type: "ByteString", value: "VFdFTFZFREFUQTpORU8tVVNE" },
              { type: "ByteString", value: "bm90LWEtbnVtYmVy" },
              { type: "Integer", value: "2185000" },
            ],
          },
        ],
      }),
    );
    const feed = useMorpheusDataFeed({ network: "mainnet", rpcUrl: "https://rpc.test.local" });

    const quote = await feed.getPriceWithMeta("NEO");

    expect(quote).toEqual({ price: 2.185, dataTimestamp: 0, recordTimestamp: 0 });
  });

  it("still rejects (and records) FAULT results", async () => {
    fetchMock.mockResolvedValue(
      rpcResponse({ state: "FAULT", exception: "pair not registered", stack: [] }),
    );
    const feed = useMorpheusDataFeed({ network: "mainnet", rpcUrl: "https://rpc.test.local" });

    await expect(feed.getPriceWithMeta("NEO")).rejects.toThrow(
      "getLatest FAULT: pair not registered",
    );
    expect(feed.error.get()).toBe("getLatest FAULT: pair not registered");
  });
});

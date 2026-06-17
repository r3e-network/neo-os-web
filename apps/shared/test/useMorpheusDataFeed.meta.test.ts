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

  it("still rejects (and records) when neither the canonical nor the per-provider record exists", async () => {
    // Both the AGG: canonical attempt and the TWELVEDATA: fallback FAULT, so the
    // read has no usable record and surfaces the no-record error keyed on the
    // per-provider pair it ultimately tried.
    fetchMock.mockResolvedValue(
      rpcResponse({ state: "FAULT", exception: "pair not registered", stack: [] }),
    );
    const feed = useMorpheusDataFeed({ network: "mainnet", rpcUrl: "https://rpc.test.local" });

    await expect(feed.getPriceWithMeta("NEO")).rejects.toThrow(
      "getLatest FAULT: no record for TWELVEDATA:NEO-USD",
    );
    expect(feed.error.get()).toBe("getLatest FAULT: no record for TWELVEDATA:NEO-USD");
  });
});

describe("useMorpheusDataFeed — canonical aggregated pair preference (C2)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Extract the `getLatest` pair argument from a JSON-RPC request body. */
  function pairFromBody(init: RequestInit | undefined): string {
    const body = JSON.parse(String(init?.body ?? "{}")) as { params?: unknown[] };
    const args = body.params?.[2] as Array<{ value?: string }> | undefined;
    return String(args?.[0]?.value ?? "");
  }

  function structForPrice(priceScaled: string, recordTs: string) {
    return {
      type: "Struct",
      value: [
        { type: "ByteString", value: "VFdFTFZFREFUQTpORU8tVVNE" },
        { type: "Integer", value: recordTs },
        { type: "Integer", value: priceScaled },
        { type: "Integer", value: recordTs },
        { type: "ByteString", value: "00" },
        { type: "Integer", value: "1" },
      ],
    };
  }

  it("reads the canonical AGG:<PAIR> record when present (no TWELVEDATA fallback call)", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const pair = pairFromBody(init);
      // Canonical record priced 3.000000; the per-provider record would FAULT —
      // a successful canonical read must short-circuit before reaching it.
      if (pair === "AGG:NEO-USD") {
        return rpcResponse({ state: "HALT", exception: null, stack: [structForPrice("3000000", "1781231101")] });
      }
      return rpcResponse({ state: "FAULT", exception: "pair not registered", stack: [] });
    });
    const feed = useMorpheusDataFeed({ network: "mainnet", rpcUrl: "https://rpc.test.local" });

    const quote = await feed.getPriceWithMeta("NEO");

    expect(quote.price).toBe(3);
    const pairsTried = fetchMock.mock.calls.map((c) => pairFromBody(c[1] as RequestInit));
    expect(pairsTried).toContain("AGG:NEO-USD");
    expect(pairsTried).not.toContain("TWELVEDATA:NEO-USD");
  });

  it("falls back to TWELVEDATA:<PAIR> when the canonical record is absent (backward compatible)", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const pair = pairFromBody(init);
      if (pair === "AGG:NEO-USD") {
        return rpcResponse({ state: "FAULT", exception: "pair not registered", stack: [] });
      }
      // Per-provider record priced 2.185000.
      return rpcResponse({ state: "HALT", exception: null, stack: [structForPrice("2185000", "1781231101")] });
    });
    const feed = useMorpheusDataFeed({ network: "mainnet", rpcUrl: "https://rpc.test.local" });

    const quote = await feed.getPriceWithMeta("NEO");

    expect(quote.price).toBe(2.185);
    const pairsTried = fetchMock.mock.calls.map((c) => pairFromBody(c[1] as RequestInit));
    expect(pairsTried).toEqual(["AGG:NEO-USD", "TWELVEDATA:NEO-USD"]);
  });

  it("honours a caller-supplied source-prefixed asset verbatim (no canonical attempt)", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const pair = pairFromBody(init);
      if (pair === "TWELVEDATA:NEO-USD") {
        return rpcResponse({ state: "HALT", exception: null, stack: [structForPrice("2185000", "1781231101")] });
      }
      return rpcResponse({ state: "FAULT", exception: "pair not registered", stack: [] });
    });
    const feed = useMorpheusDataFeed({ network: "mainnet", rpcUrl: "https://rpc.test.local" });

    const quote = await feed.getPriceWithMeta("TWELVEDATA:NEO-USD");

    expect(quote.price).toBe(2.185);
    const pairsTried = fetchMock.mock.calls.map((c) => pairFromBody(c[1] as RequestInit));
    expect(pairsTried).toEqual(["TWELVEDATA:NEO-USD"]);
  });
});

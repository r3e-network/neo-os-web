import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "../react";
import { createObservable } from "../react/context";
import { EXTERNAL_INTEGRATIONS, getNetwork } from "../constants/rpc";
import {
  PRICE_SCALE_DECIMALS,
  MAX_CATALOG_PAIRS,
  STALE_THRESHOLD_SECONDS,
  catalogSymbol,
  classifyFeedError,
  exactPriceQuote,
  feedKeys,
  formatRelativeAge,
  launchAssetSymbol,
  usePriceConsole,
} from "../../oracle-price-console/src/hooks/usePriceConsole";
import { messages } from "../../oracle-price-console/src/locale/messages";

/**
 * Build the hook the way main.tsx does: on a framework whose
 * app.oracle.dataFeed lane is configured with the network-specific deployed
 * MorpheusDataFeed contract + RPC endpoint. Reads go through the framework
 * reader and hit the (stubbed) global fetch.
 */
function buildPriceConsole() {
  const network = getNetwork();
  const integration = EXTERNAL_INTEGRATIONS[network];
  const framework = createMiniAppFramework(
    { services: { chain: { address: createObservable<string | null>(null) } }, t } as never,
    {
      appId: "miniapp-oracle-price-console",
      oracle: {
        dataFeed: {
          rpcUrl: integration.rpcUrl,
          contractHash: integration.contracts.morpheusDatafeed,
          network,
        },
      },
    },
  );
  return usePriceConsole({ app: framework, t });
}

type LocalizedMessage = { en: string; zh: string };
const appMessages = messages as Record<string, LocalizedMessage>;

function t(key: string, params: Record<string, string | number> = {}) {
  let text = appMessages[key]?.en ?? key;
  for (const [param, value] of Object.entries(params)) {
    text = text.replace(`{${param}}`, String(value));
  }
  return text;
}

/**
 * Real-node fixture shape (captured from api.n3index.dev/mainnet getLatest):
 * Struct [pair, dataTimestamp, price, recordTimestamp, signature, flag].
 */
function struct(dataTs: number, priceInt: string, recordTs = dataTs) {
  return {
    type: "Struct",
    value: [
      { type: "ByteString", value: "VFdFTFZFREFUQTpORU8tVVNE" },
      { type: "Integer", value: String(dataTs) },
      { type: "Integer", value: priceInt },
      { type: "Integer", value: String(recordTs) },
      { type: "ByteString", value: "00" },
      { type: "Integer", value: "0" },
    ],
  };
}

function rpcResponse(result: unknown) {
  return { ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id: 1, result }) };
}

describe("oracle-price-console freshness + error helpers", () => {
  it("formats relative ages across boundaries", () => {
    expect(formatRelativeAge(10, t)).toBe("just now");
    expect(formatRelativeAge(120, t)).toBe("2m ago");
    expect(formatRelativeAge(3 * 3600, t)).toBe("3h ago");
    expect(formatRelativeAge(94 * 86400, t)).toBe("94d ago");
  });

  it("maps raw faults to stable user-facing keys (never the raw text)", () => {
    expect(classifyFeedError("MorpheusDataFeed not deployed on testnet")).toBe(
      "errorFeedNotDeployed",
    );
    expect(classifyFeedError("getLatest: request timed out")).toBe("errorFeedTimeout");
    expect(classifyFeedError("getLatest FAULT: no data")).toBe("errorFeedFault");
    expect(classifyFeedError("TypeError: Failed to fetch")).toBe("errorFeedNetwork");
    expect(classifyFeedError("something weird")).toBe("errorFeedGeneric");
  });

  it("every classified error key resolves in the locale", () => {
    for (const raw of ["not deployed", "timed out", "FAULT", "Failed to fetch", "?"]) {
      const key = classifyFeedError(raw);
      expect(appMessages[key]?.en, key).toBeTruthy();
      expect(appMessages[key]?.zh, key).toBeTruthy();
    }
  });

  it("parses only bounded USD catalog pairs and strips provider prefixes", () => {
    expect(catalogSymbol("AGG:NEO-USD")).toBe("NEO");
    expect(catalogSymbol("TWELVEDATA:GAS-USD")).toBe("GAS");
    expect(catalogSymbol("BTC-USD")).toBe("BTC");
    expect(catalogSymbol("TWELVEDATA:NEO-EUR")).toBeNull();
    expect(catalogSymbol("AGG:NEO-USD-extra")).toBeNull();
    expect(catalogSymbol("AGG:-USD")).toBeNull();
    expect(catalogSymbol({ pair: "NEO-USD" })).toBeNull();
  });

  it("builds exact aggregate and provider keys for a validated symbol", () => {
    expect(feedKeys(" neo ")).toEqual({
      aggregate: "AGG:NEO-USD",
      provider: "TWELVEDATA:NEO-USD",
    });
    expect(() => feedKeys("NEO/USD")).toThrow("asset is required");
  });

  it("normalizes exact USD launch keys without relabeling another quote currency", () => {
    expect(launchAssetSymbol("neo")).toBe("NEO");
    expect(launchAssetSymbol("NEO/USD")).toBe("NEO");
    expect(launchAssetSymbol("AGG:NEO-USD")).toBe("NEO");
    expect(launchAssetSymbol("TWELVEDATA:GAS-USD")).toBe("GAS");
    expect(launchAssetSymbol("NEO-EUR")).toBe("");
    expect(launchAssetSymbol("AGG:NEO-USD-extra")).toBe("");
  });

  it("accepts only exact six-decimal positive quotes with safe integer timestamps", () => {
    expect(PRICE_SCALE_DECIMALS).toBe(6);
    expect(exactPriceQuote({
      price: 1.984001,
      dataTimestamp: 1_781_231_000,
      recordTimestamp: 1_781_231_001,
    })).toEqual({
      price: 1.984001,
      dataTimestamp: 1_781_231_000,
      recordTimestamp: 1_781_231_001,
    });
    expect(exactPriceQuote({ price: "1.984001", dataTimestamp: 1, recordTimestamp: 1 })).toBeNull();
    expect(exactPriceQuote({ price: 1.9840001, dataTimestamp: 1, recordTimestamp: 1 })).toBeNull();
    expect(exactPriceQuote({ price: Number.POSITIVE_INFINITY, dataTimestamp: 1, recordTimestamp: 1 })).toBeNull();
    expect(exactPriceQuote({ price: Number.MAX_SAFE_INTEGER, dataTimestamp: 1, recordTimestamp: 1 })).toBeNull();
    expect(exactPriceQuote({ price: 1, dataTimestamp: "1", recordTimestamp: 1.5 })).toEqual({
      price: 1,
      dataTimestamp: 0,
      recordTimestamp: 0,
    });
    expect(exactPriceQuote({ price: 1, dataTimestamp: Number.MAX_SAFE_INTEGER, recordTimestamp: 1 })).toEqual({
      price: 1,
      dataTimestamp: 0,
      recordTimestamp: 1,
    });
  });
});

describe("usePriceConsole — freshness from feed timestamp", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("labels a recent read as fresh", async () => {
    const now = 1_781_231_101_000; // ms
    vi.setSystemTime(now);
    const nowSec = Math.floor(now / 1000);
    fetchMock.mockResolvedValue(
      rpcResponse({ state: "HALT", exception: null, stack: [struct(nowSec - 30, "2185000")] }),
    );
    const price = buildPriceConsole();
    const result = await price.fetchPrice();
    expect(result.success).toBe(true);
    expect(price.freshness.get()).toBe("fresh");
    expect(price.freshnessLabel.get()).toContain("Fresh");
  });

  it("labels a feed frozen past the threshold as stale (not 'Fresh')", async () => {
    const now = 1_781_231_101_000;
    vi.setSystemTime(now);
    const nowSec = Math.floor(now / 1000);
    const oldTs = nowSec - (STALE_THRESHOLD_SECONDS + 94 * 86400);
    fetchMock.mockResolvedValue(
      rpcResponse({ state: "HALT", exception: null, stack: [struct(oldTs, "2185000")] }),
    );
    const price = buildPriceConsole();
    await price.fetchPrice();
    expect(price.freshness.get()).toBe("stale");
    const label = price.freshnessLabel.get();
    expect(label).toContain("Stale");
    expect(label).not.toContain("Fresh");
  });

  it("rejects a resolved price of 0 as no data, never a successful fresh $0.0000", async () => {
    const now = 1_781_231_101_000;
    vi.setSystemTime(now);
    const nowSec = Math.floor(now / 1000);
    // HALT with a recent timestamp but a zero price — an uninitialized/unpriced
    // pair. This must NOT render as a fresh, valid feed read.
    fetchMock.mockResolvedValue(
      rpcResponse({ state: "HALT", exception: null, stack: [struct(nowSec - 30, "0")] }),
    );
    const price = buildPriceConsole();
    const result = await price.fetchPrice();
    expect(result.success).toBe(false);
    expect(price.freshness.get()).toBe("idle");
    expect(price.freshnessLabel.get()).not.toContain("Fresh");
    // The read has SETTLED (fetchPrice completed) with a zero/absent quote.
    // `priceDisplay` is now the ONE reading for both the PlayArea and the shell
    // chrome (the display-only `priceStatDisplay` twin is gone), so a settled
    // empty resolves to a real "unavailable" reading — never a fabricated $0,
    // and NOT the pending "Awaiting read" copy, which now means only "still in
    // flight". The old empty-string assertion described the pre-pendingKey twin.
    expect(price.priceDisplay.get()).toBe(t("priceUnavailable"));
    // The point of this guard: a zero read must never surface as a real price,
    // and never as a plausible $0.
    expect(price.priceDisplay.get()).not.toMatch(/\$/);
    expect(price.priceDisplay.get()).not.toBe(t("priceSignalIdle"));
    expect(price.freshnessTimestamp.get()).toBe("");
    expect(price.errorMsg.get()).toBe(t("errorFeedFault"));
  });

  it("surfaces a localized error (not the raw fault) on a feed FAULT", async () => {
    fetchMock.mockResolvedValue(
      rpcResponse({ state: "FAULT", exception: "no data for pair", stack: [] }),
    );
    const price = buildPriceConsole();
    const result = await price.fetchPrice();
    expect(result.success).toBe(false);
    expect(price.errorMsg.get()).toBe(t("errorFeedFault"));
    expect(price.errorMsg.get()).not.toMatch(/FAULT/);
  });

  it("keeps a positive price visibly unverified when both timestamps are missing", async () => {
    const app = {
      oracle: {
        dataFeed: {
          price: vi.fn(async () => ({ price: 2.185, dataTimestamp: 0, recordTimestamp: 0 })),
          listPairs: vi.fn(async () => []),
        },
      },
    } as never;
    const price = usePriceConsole({ app, t });

    await price.fetchPrice();

    expect(price.priceDisplay.get()).toBe("$2.185");
    expect(price.freshness.get()).toBe("stale");
    expect(price.freshnessLabel.get()).toContain("unverified");
    expect(price.freshnessLabel.get()).not.toContain("Fresh");
    expect(price.sourceFreshness.get()).toBe("stale");
    expect(price.sourceFreshnessLabel.get()).toContain("unavailable");
  });

  it("discloses an old market-source timestamp even when the on-chain write is fresh", async () => {
    const now = 1_781_231_101_000;
    vi.setSystemTime(now);
    const nowSec = Math.floor(now / 1000);
    const app = {
      oracle: {
        dataFeed: {
          price: vi.fn(async () => ({
            price: 2.185,
            dataTimestamp: nowSec - (STALE_THRESHOLD_SECONDS + 86_400),
            recordTimestamp: nowSec - 20,
          })),
          listPairs: vi.fn(async () => []),
        },
      },
    } as never;
    const price = usePriceConsole({ app, t });

    await price.fetchPrice();

    expect(price.freshness.get()).toBe("fresh");
    expect(price.sourceFreshness.get()).toBe("stale");
    expect(price.sourceFreshnessLabel.get()).toContain("Market source is stale");
    expect(price.sourceTimestampDisplay.get()).not.toBe("");
  });

  it("treats an implausibly future timestamp as invalid rather than fresh", async () => {
    const now = 1_781_231_101_000;
    vi.setSystemTime(now);
    const app = {
      oracle: {
        dataFeed: {
          price: vi.fn(async () => ({
            price: 2.185,
            dataTimestamp: Math.floor(now / 1000),
            recordTimestamp: Math.floor(now / 1000) + 3600,
          })),
          listPairs: vi.fn(async () => []),
        },
      },
    } as never;
    const price = usePriceConsole({ app, t });

    await price.fetchPrice();

    expect(price.freshness.get()).toBe("stale");
    expect(price.freshnessLabel.get()).toContain("ahead of local time");
  });

  it("invalidates the old quote immediately and ignores a late response after pair switch", async () => {
    let resolveNeo!: (value: { price: number; dataTimestamp: number; recordTimestamp: number }) => void;
    const neoRead = new Promise<{ price: number; dataTimestamp: number; recordTimestamp: number }>((resolve) => {
      resolveNeo = resolve;
    });
    const nowSec = Math.floor(Date.now() / 1000);
    const readPrice = vi.fn(async (symbol: string) => symbol.includes("NEO")
      ? neoRead
      : { price: 1.04, dataTimestamp: nowSec, recordTimestamp: nowSec });
    const app = {
      oracle: { dataFeed: { price: readPrice, listPairs: vi.fn(async () => []) } },
    } as never;
    const price = usePriceConsole({ app, t });

    const oldRead = price.fetchPrice();
    expect(price.selectAsset("GAS")).toBe(true);
    // The old pair's price is gone the instant the pair changes; the new pair's
    // read has not settled, so the reading is UNREAD — `priceDisplay` holds
    // `undefined` (the shell's pendingKey trigger) and the view shimmers rather
    // than showing the pair the visitor just left. Distinct from a settled-empty
    // "unavailable" reading.
    expect(price.priceDisplay.get()).toBeUndefined();
    expect(price.priceSettled.get()).toBe(false);
    const currentRead = await price.fetchPrice();
    resolveNeo({ price: 9.99, dataTimestamp: nowSec, recordTimestamp: nowSec });
    const ignoredRead = await oldRead;

    expect(currentRead.success).toBe(true);
    expect(ignoredRead).toMatchObject({ success: false, ignored: true });
    expect(price.asset.get()).toBe("GAS");
    expect(price.priceDisplay.get()).toBe("$1.04");
    expect(readPrice.mock.calls.filter((call) => String(call[0]).includes("NEO"))).toHaveLength(1);
  });

  it("clears a previously verified quote when the next read fails", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const readPrice = vi.fn()
      .mockResolvedValueOnce({ price: 2.185, dataTimestamp: nowSec, recordTimestamp: nowSec })
      .mockRejectedValueOnce(new Error("network request failed"));
    const app = {
      oracle: { dataFeed: { price: readPrice, listPairs: vi.fn(async () => []) } },
    } as never;
    const price = usePriceConsole({ app, t });

    await price.fetchPrice();
    expect(price.priceDisplay.get()).toBe("$2.185");
    await price.fetchPrice();

    // A stale-but-real $2.185 must not survive a failed re-read, and must not
    // be replaced by a fabricated zero either. The re-read SETTLED (it failed),
    // so `priceDisplay` — the one reading the chrome also binds — resolves to a
    // real "unavailable" reading, not the pending "Awaiting read" copy.
    expect(price.priceDisplay.get()).toBe(t("priceUnavailable"));
    expect(price.priceDisplay.get()).not.toMatch(/\$/);
    expect(price.priceDisplay.get()).not.toBe(t("priceSignalIdle"));
    // The read completed (it failed), so the console is settled: the view shows
    // honest zero-state copy, not a shimmer that would imply work in progress.
    expect(price.priceSettled.get()).toBe(true);
    expect(price.freshness.get()).toBe("idle");
    expect(price.errorMsg.get()).toBe(t("errorFeedNetwork"));
  });

  it("reactively expires a once-fresh quote at the one-hour boundary", async () => {
    vi.useFakeTimers();
    const now = 1_781_231_101_000;
    vi.setSystemTime(now);
    const nowSec = Math.floor(now / 1000);
    const app = {
      oracle: {
        dataFeed: {
          price: vi.fn(async () => ({ price: 2.185, dataTimestamp: nowSec, recordTimestamp: nowSec })),
          listPairs: vi.fn(async () => []),
        },
      },
    } as never;
    const price = usePriceConsole({ app, t });
    await price.fetchPrice();
    expect(price.freshness.get()).toBe("fresh");

    await vi.advanceTimersByTimeAsync(STALE_THRESHOLD_SECONDS * 1000 + 50);

    expect(price.freshness.get()).toBe("stale");
    price.cleanup();
  });

  it("binds the successful result to the exact aggregate key and canonical contract", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    fetchMock.mockResolvedValue(
      rpcResponse({ state: "HALT", exception: null, stack: [struct(nowSec, "1984001")] }),
    );
    const price = buildPriceConsole();

    await price.fetchPrice();

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const network = getNetwork();
    expect(request.params[0]).toBe(EXTERNAL_INTEGRATIONS[network].contracts.morpheusDatafeed);
    expect(request.params[1]).toBe("getLatest");
    expect(request.params[2]).toEqual([{ type: "String", value: "AGG:NEO-USD" }]);
    expect(price.feedKey.get()).toBe("AGG:NEO-USD");
    expect(price.feedRoute.get()).toBe("aggregate");
    // Display trimming must never cost precision: six significant decimals from
    // the feed survive intact. Only the zeros the contract scale pads on go.
    expect(price.priceDisplay.get()).toBe("$1.984001");
  });

  it("falls back to the exact provider key when the aggregate record is absent", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    fetchMock
      .mockResolvedValueOnce(rpcResponse({ state: "FAULT", exception: "missing", stack: [] }))
      .mockResolvedValueOnce(
        rpcResponse({ state: "HALT", exception: null, stack: [struct(nowSec - 12, "1064600", nowSec - 7)] }),
      );
    const price = buildPriceConsole();

    const result = await price.fetchPrice();

    expect(result.success).toBe(true);
    const requests = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(requests.map((request) => request.params[2][0].value)).toEqual([
      "AGG:NEO-USD",
      "TWELVEDATA:NEO-USD",
    ]);
    expect(price.feedKey.get()).toBe("TWELVEDATA:NEO-USD");
    expect(price.feedRoute.get()).toBe("provider");
    expect(price.sourceLabel.get()).toContain("TwelveData fallback");
  });

  it("prefers a timestamp-bound provider record over an unverified aggregate candidate", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const readPrice = vi.fn(async (key: string) => key.startsWith("AGG:")
      ? { price: 2.2, dataTimestamp: 0, recordTimestamp: 0 }
      : { price: 2.1, dataTimestamp: nowSec - 20, recordTimestamp: nowSec - 10 });
    const app = {
      oracle: { dataFeed: { price: readPrice, listPairs: vi.fn(async () => []) } },
    } as never;
    const price = usePriceConsole({ app, t });

    await price.fetchPrice();

    expect(readPrice.mock.calls.map((call) => call[0])).toEqual([
      "AGG:NEO-USD",
      "TWELVEDATA:NEO-USD",
    ]);
    expect(price.priceDisplay.get()).toBe("$2.10");
    expect(price.feedRoute.get()).toBe("provider");
    expect(price.freshness.get()).toBe("fresh");
  });

  it("normalizes the pair catalog, ignores non-USD entries, and keeps stable defaults first", async () => {
    const app = {
      oracle: {
        dataFeed: {
          price: vi.fn(),
          listPairs: vi.fn(async () => [
            "AGG:NEO-USD",
            "TWELVEDATA:ETH-USD",
            "CHAINLINK:ETH-USD",
            "TWELVEDATA:NEO-EUR",
            "malformed",
          ]),
        },
      },
    } as never;
    const price = usePriceConsole({ app, t });

    await price.loadPairs();

    expect(price.availablePairs.get()).toEqual(["NEO", "GAS", "BTC", "ETH"]);
  });

  it("bounds an oversized on-chain pair catalog before it reaches product state", async () => {
    const app = {
      oracle: {
        dataFeed: {
          price: vi.fn(),
          listPairs: vi.fn(async () => Array.from(
            { length: MAX_CATALOG_PAIRS + 80 },
            (_item, index) => `SOURCE:A${index}-USD`,
          )),
        },
      },
    } as never;
    const price = usePriceConsole({ app, t });

    await price.loadPairs();

    expect(price.availablePairs.get().length).toBeLessThanOrEqual(MAX_CATALOG_PAIRS);
    expect(price.availablePairs.get().slice(0, 3)).toEqual(["NEO", "GAS", "BTC"]);
  });

  // The pendingKey migration collapsed the display-only `priceStatDisplay` twin
  // into the ONE `priceDisplay` observable the manifest now binds. This pins the
  // three phases apart at the source, so the twin can never be reinvented and
  // the shell's stat/sidebar bindings can never publish a void or a fabricated
  // $0. If any branch regresses to "" or "$0.00" this fails loudly.
  it("resolves priceDisplay through three honest phases: unread, quote, settled-empty", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const readPrice = vi.fn()
      .mockResolvedValueOnce({ price: 2.185, dataTimestamp: nowSec, recordTimestamp: nowSec })
      .mockResolvedValueOnce({ price: 0, dataTimestamp: nowSec, recordTimestamp: nowSec });
    const app = {
      oracle: { dataFeed: { price: readPrice, listPairs: vi.fn(async () => []) } },
    } as never;
    const price = usePriceConsole({ app, t });

    // 1) UNREAD — no read has settled. `undefined` is the shell's pendingKey
    //    trigger, and it is never "" (a void the chrome would print) nor a $0.
    expect(price.priceDisplay.get()).toBeUndefined();
    expect(price.priceSettled.get()).toBe(false);

    // 2) SETTLED with a usable quote — the real price.
    await price.fetchPrice();
    expect(price.priceDisplay.get()).toBe("$2.185");

    // 3) SETTLED but empty (a zero read) — a real "unavailable" reading that is
    //    NOT the unread `undefined` and does NOT borrow the pending copy.
    await price.fetchPrice();
    expect(price.priceSettled.get()).toBe(true);
    expect(price.priceDisplay.get()).toBe(t("priceUnavailable"));
    expect(price.priceDisplay.get()).not.toBe(t("priceSignalIdle"));
    expect(price.priceDisplay.get()).not.toMatch(/\$/);
  });
});

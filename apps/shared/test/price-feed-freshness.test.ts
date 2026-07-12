import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRICE_STALE_AFTER_MS,
  clearPriceCache,
  getPrices,
} from "../utils/price";
import { BLOCKCHAIN_CONSTANTS } from "../constants";
import { fetchTreasuryData } from "../../neo-treasury/src/utils/treasury";

/**
 * Oracle price-feed consumer-seam findings:
 *  - getPrices() must read the on-chain MorpheusDataFeed via getPriceWithMeta and
 *    honor the record's freshness. The feed keeps returning HALT with its last
 *    value even when updates stopped months ago, so an unbounded read would
 *    render a frozen price as a live "Live synced" USD total.
 *  - An on-chain record older than the staleness window must NOT be presented as
 *    a fresh USD total: getPrices() returns null and fetchTreasuryData() reports
 *    totalUsd=null (rendered as "—") plus the priceFeedDown warning.
 *  - A record that is delayed but still in-window renders the USD total while
 *    flagging priceStale=true so the dedicated quote status is amber; the
 *    independent native-balance freshness signal remains live.
 */

const PRICE_SCALE = 1_000_000;
const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;

// getLatest Struct shape captured from the live mainnet feed:
// [pair, dataTimestamp, price, recordTimestamp, signature, flag]. Timestamps are
// epoch SECONDS; price is the integer descaled by 10^6.
function datafeedStruct(priceUsd: number, recordTsSec: number) {
  return {
    type: "Struct",
    value: [
      { type: "ByteString", value: "VFdFTFZFREFUQTpORU8tVVNE" },
      { type: "Integer", value: String(recordTsSec) },
      { type: "Integer", value: String(Math.round(priceUsd * PRICE_SCALE)) },
      { type: "Integer", value: String(recordTsSec) },
      { type: "ByteString", value: "00" },
      { type: "Integer", value: "1" },
    ],
  };
}

/**
 * Routes the single global fetch mock: the datafeed read uses JSON-RPC
 * `invokefunction` (getLatest), treasury balances use `getnep17balances`. The
 * datafeed record timestamp (epoch seconds) is the freshness lever under test.
 */
function installRpcMock(recordTsSec: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: unknown[];
      };
      if (body.method === "invokefunction") {
        // NEO @ 10, GAS @ 5; same record timestamp for both legs.
        const pairArg = (body.params?.[2] as Array<{ value?: string }> | undefined)?.[0]?.value ?? "";
        const isGas = String(pairArg).includes("GAS");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: {
              state: "HALT",
              exception: null,
              stack: [datafeedStruct(isGas ? 5 : 10, recordTsSec)],
            },
          }),
        } as unknown as Response;
      }
      // getnep17balances — every watched wallet holds 1 NEO so totals are non-zero.
      return {
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: { balance: [{ assethash: NEO_HASH, amount: "1" }] },
        }),
      } as unknown as Response;
    }),
  );
}

describe("oracle price feed freshness (getPrices)", () => {
  beforeEach(() => {
    clearPriceCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    clearPriceCache();
  });

  it("returns a priced quote when the on-chain record is fresh", async () => {
    const now = 1_781_231_101_000;
    vi.setSystemTime(now);
    installRpcMock(Math.floor(now / 1000) - 30);

    const prices = await getPrices();
    expect(prices).not.toBeNull();
    expect(prices!.usd?.neo).toBe(10);
    expect(prices!.usd?.gas).toBe(5);
    // updatedAt mirrors the on-chain record time, not wall-clock now.
    expect(prices!.feedRecordTimestamp).toBe((Math.floor(now / 1000) - 30) * 1000);
    expect(prices!.updatedAt).toBe(prices!.feedRecordTimestamp);
  });

  it("returns null (not a fresh-looking USD total) for a feed frozen past the window", async () => {
    const now = 1_781_231_101_000;
    vi.setSystemTime(now);
    // Record well past the 1-hour staleness window (e.g. months-frozen feed).
    const frozenSec = Math.floor(now / 1000) - Math.floor(PRICE_STALE_AFTER_MS / 1000) - 94 * 86400;
    installRpcMock(frozenSec);

    const prices = await getPrices();
    expect(prices).toBeNull();
  });
});

describe("neo-treasury honors price-feed freshness", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    clearPriceCache();
  });

  beforeEach(() => {
    clearPriceCache();
  });

  it("drives totalUsd=null (rendered as —) when the on-chain record is stale", async () => {
    const now = 1_781_231_101_000;
    vi.setSystemTime(now);
    const frozenSec = Math.floor(now / 1000) - Math.floor(PRICE_STALE_AFTER_MS / 1000) - 86400;
    installRpcMock(frozenSec);

    const data = await fetchTreasuryData();

    // Balances still resolve (wallets hold NEO) ...
    expect(data.totalNeo).toBeGreaterThan(0);
    // ... but the USD total is NOT presented as a fresh number: it's null so the
    // hero renders "—" + the priceFeedDown warning, not a frozen price as live.
    expect(data.totalUsd).toBeNull();
    expect(data.prices).toBeNull();
    // priceStale is reserved for the delayed-but-in-window case; a null feed uses
    // the dedicated "price feed unavailable" path instead.
    expect(data.priceStale).toBe(false);
  });

  it("renders the USD total but flags priceStale for a delayed (in-window) record", async () => {
    const now = 1_781_231_101_000;
    vi.setSystemTime(now);
    // 15 minutes old: within the 1-hour window (so usable) but past the 5-minute
    // "fresh" threshold, so the quote status is delayed while balances remain live.
    const delayedSec = Math.floor(now / 1000) - 15 * 60;
    installRpcMock(delayedSec);

    const data = await fetchTreasuryData();

    expect(data.totalUsd).not.toBeNull();
    expect(data.totalUsd).toBeGreaterThan(0);
    expect(data.priceStale).toBe(true);
  });
});

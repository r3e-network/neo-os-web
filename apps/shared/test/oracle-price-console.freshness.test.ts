import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STALE_THRESHOLD_SECONDS,
  classifyFeedError,
  formatRelativeAge,
  usePriceConsole,
} from "../../oracle-price-console/src/hooks/usePriceConsole";
import { messages } from "../../oracle-price-console/src/locale/messages";

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
function struct(dataTs: number, priceInt: string) {
  return {
    type: "Struct",
    value: [
      { type: "ByteString", value: "VFdFTFZFREFUQTpORU8tVVNE" },
      { type: "Integer", value: String(dataTs) },
      { type: "Integer", value: priceInt },
      { type: "Integer", value: String(dataTs) },
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
    const price = usePriceConsole({ t });
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
    const price = usePriceConsole({ t });
    await price.fetchPrice();
    expect(price.freshness.get()).toBe("stale");
    const label = price.freshnessLabel.get();
    expect(label).toContain("Stale");
    expect(label).not.toContain("Fresh");
  });

  it("treats a resolved price of 0 as no data (idle), never a fresh $0.0000", async () => {
    const now = 1_781_231_101_000;
    vi.setSystemTime(now);
    const nowSec = Math.floor(now / 1000);
    // HALT with a recent timestamp but a zero price — an uninitialized/unpriced
    // pair. This must NOT render as a fresh, valid feed read.
    fetchMock.mockResolvedValue(
      rpcResponse({ state: "HALT", exception: null, stack: [struct(nowSec - 30, "0")] }),
    );
    const price = usePriceConsole({ t });
    const result = await price.fetchPrice();
    expect(result.success).toBe(true);
    expect(price.freshness.get()).toBe("idle");
    expect(price.freshnessLabel.get()).not.toContain("Fresh");
    expect(price.priceDisplay.get()).toBe(t("notAvailable"));
    expect(price.freshnessTimestamp.get()).toBe("");
  });

  it("surfaces a localized error (not the raw fault) on a feed FAULT", async () => {
    fetchMock.mockResolvedValue(
      rpcResponse({ state: "FAULT", exception: "no data for pair", stack: [] }),
    );
    const price = usePriceConsole({ t });
    const result = await price.fetchPrice();
    expect(result.success).toBe(false);
    expect(price.errorMsg.get()).toBe(t("errorFeedFault"));
    expect(price.errorMsg.get()).not.toMatch(/FAULT/);
  });
});

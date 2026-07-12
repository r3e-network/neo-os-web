import { beforeEach, describe, expect, it, vi } from "vitest";

const feedMocks = vi.hoisted(() => ({
  getPriceWithMeta: vi.fn(),
}));

vi.mock("@shared/composables/useMorpheusDataFeed", () => ({
  useMorpheusDataFeed: () => ({
    getPrice: vi.fn(),
    getPriceWithMeta: feedMocks.getPriceWithMeta,
  }),
}));

import {
  FRESH_PRICE_MAX_AGE_SECONDS,
  useAutomationCopilot,
} from "../../automation-copilot/src/composables/useAutomationCopilot";

function t(key: string) {
  return key;
}

describe("Automation Copilot feed freshness", () => {
  beforeEach(() => {
    feedMocks.getPriceWithMeta.mockReset();
  });

  it("accepts a positive quote with a fresh source timestamp", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    feedMocks.getPriceWithMeta.mockResolvedValue({
      price: 19.67,
      dataTimestamp: nowSeconds - 60,
      recordTimestamp: nowSeconds - 30,
    });
    const copilot = useAutomationCopilot({ t });

    await expect(copilot.fetchCurrentPrice()).resolves.toEqual({ success: true });

    expect(copilot.latestPrice.get()).toBe(19.67);
    expect(copilot.priceFreshnessState.get()).toBe("fresh");
    expect(copilot.lastError.get()).toBe("");
  });

  it("keeps a stale quote visible for diagnosis but blocks it as registration evidence", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    feedMocks.getPriceWithMeta.mockResolvedValue({
      price: 1.966,
      dataTimestamp: nowSeconds - FRESH_PRICE_MAX_AGE_SECONDS - 1,
      recordTimestamp: nowSeconds,
    });
    const copilot = useAutomationCopilot({ t });

    await expect(copilot.fetchCurrentPrice()).rejects.toThrow("priceStale");

    expect(copilot.latestPrice.get()).toBe(1.966);
    expect(copilot.priceFreshnessState.get()).toBe("stale");
    expect(copilot.lastError.get()).toBe("priceStale");
    expect(copilot.apiStatus.get()).toBe("priceStale");
  });

  it("rejects zero-valued records instead of presenting them as a market price", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    feedMocks.getPriceWithMeta.mockResolvedValue({
      price: 0,
      dataTimestamp: nowSeconds,
      recordTimestamp: nowSeconds,
    });
    const copilot = useAutomationCopilot({ t });

    await expect(copilot.fetchCurrentPrice()).rejects.toThrow("priceInvalid");

    expect(copilot.latestPrice.get()).toBeNull();
    expect(copilot.priceFreshnessState.get()).toBe("unloaded");
  });
});

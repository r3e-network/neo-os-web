import { describe, expect, it, vi, beforeEach } from "vitest";

import { createObservable } from "../react/context";
import { EventBus } from "../services/EventBus";

// Drive the on-chain feed from the test: each leg returns a price + dataTimestamp
// (epoch seconds). A far-past timestamp exercises the staleness guard.
const feedState = {
  prices: { NEO: 2.182, GAS: 1.101 } as Record<string, number>,
  dataTimestamp: Math.floor(Date.now() / 1000), // fresh by default
};

vi.mock("@shared/composables/useMorpheusDataFeed", () => ({
  useMorpheusDataFeed: () => ({
    network: "mainnet",
    error: createObservable<string | null>(null),
    getPrice: vi.fn(async (asset: string) => feedState.prices[asset.toUpperCase()] ?? 0),
    getPriceWithMeta: vi.fn(async (asset: string) => ({
      price: feedState.prices[asset.toUpperCase()] ?? 0,
      dataTimestamp: feedState.dataTimestamp,
      recordTimestamp: feedState.dataTimestamp,
    })),
    listPairs: vi.fn(async () => ["NEO", "GAS"]),
  }),
}));

import { useSwapEngine } from "../../neo-swap/src/hooks/useSwapEngine";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function t(key: string, params?: Record<string, string | number>) {
  if (!params) return key;
  return `${key}:${JSON.stringify(params)}`;
}

function makeChain(opts: { router?: string | null; address?: string } = {}) {
  const invoke = vi.fn(async () => ({ txid: "0xswap", success: true }));
  return {
    address: createObservable(opts.address ?? ALICE),
    contractAddress: createObservable<string | null>(opts.router ?? null),
    isConnected: createObservable(Boolean(opts.address ?? ALICE)),
    ensureWallet: vi.fn(async () => opts.address ?? ALICE),
    invoke,
  } as never;
}

function makeBalance(neo: number, gas: number) {
  return {
    getNeoBalance: vi.fn(async () => neo),
    getGasBalance: vi.fn(async () => gas),
  } as never;
}

function setup(opts: { router?: string | null; address?: string; neo?: number; gas?: number } = {}) {
  const chain = makeChain(opts);
  const balance = makeBalance(opts.neo ?? 100, opts.gas ?? 50);
  const swap = useSwapEngine({ chain, balance, eventBus: new EventBus(), t });
  return { swap, chain };
}

beforeEach(() => {
  feedState.prices = { NEO: 2.182, GAS: 1.101 };
  feedState.dataTimestamp = Math.floor(Date.now() / 1000);
});

describe("useSwapEngine — honest router state", () => {
  it("cannot swap and labels the CTA when no router is deployed", async () => {
    const { swap } = setup({ router: null });
    await swap.loadAll();
    swap.setFromAmount("2");

    expect(swap.routerAvailable.get()).toBe(false);
    expect(swap.canSwap.get()).toBe(false);
    expect(swap.swapButtonText.get()).toBe("swapRouterUnavailable");
  });

  it("executeSwap throws the router-unavailable message instead of half-running", async () => {
    const { swap } = setup({ router: null });
    await swap.loadAll();
    swap.setFromAmount("2");
    // canSwap is false, so executeSwap returns early without touching the wallet.
    await swap.executeSwap();
    // No throw, no invoke — the CTA is disabled in the UI via canSwap.
    expect(swap.canSwap.get()).toBe(false);
  });

  it("labels the CTA to connect when the wallet is disconnected (router present)", async () => {
    const { swap } = setup({ router: "0xrouter", address: "" });
    await swap.loadAll();
    expect(swap.walletConnected.get()).toBe(false);
    expect(swap.swapButtonText.get()).toBe("connectWallet");
  });
});

describe("useSwapEngine — staleness guard", () => {
  it("flags a stale rate and blocks the swap when the feed is older than 10 minutes", async () => {
    feedState.dataTimestamp = Math.floor(Date.now() / 1000) - 20 * 60; // 20 min old
    const { swap } = setup({ router: "0xrouter" });
    await swap.loadAll();
    swap.setFromAmount("2");

    expect(swap.rateStale.get()).toBe(true);
    expect(swap.rateAsOf.get()).not.toBe("");
    expect(swap.canSwap.get()).toBe(false);
    expect(swap.swapButtonText.get()).toBe("rateStale");
  });

  it("treats a fresh rate as tradable (router present)", async () => {
    const { swap } = setup({ router: "0xrouter" });
    await swap.loadAll();
    swap.setFromAmount("2");

    expect(swap.rateStale.get()).toBe(false);
    expect(swap.canSwap.get()).toBe(true);
  });
});

describe("useSwapEngine — output quantization + slippage floor", () => {
  it("quantizes a NEO output to a whole number (0 decimals)", async () => {
    // GAS → NEO: rate = 1.101 / 2.182 ≈ 0.5046. 100 GAS → ~50.46 NEO → floored 50.
    const { swap } = setup({ router: "0xrouter", neo: 0, gas: 100 });
    await swap.loadAll();
    // Flip to GAS → NEO.
    swap.swapTokens();
    await Promise.resolve();
    swap.setFromAmount("100");

    // toAmount must be a whole NEO number — no fractional part.
    expect(swap.toAmount.get()).not.toContain(".");
  });

  it("computes minReceived in integer base units (BigInt 995/1000)", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 100, gas: 0 });
    await swap.loadAll();
    swap.setFromAmount("10"); // NEO → GAS
    // 10 NEO * (2.182/1.101) ≈ 19.818 GAS → minReceived = 19.818 * 0.995.
    const min = parseFloat(swap.minReceived.get());
    expect(min).toBeGreaterThan(0);
    expect(min).toBeLessThan(parseFloat(swap.toAmount.get()));
  });

  it("does not collapse a tiny output to a zero slippage floor", async () => {
    // A tiny GAS output (2 base units) would underflow float scientific
    // notation if minReceived were computed via .toString(). The BigInt floor
    // keeps 1 base unit instead of rounding the whole thing to "0".
    const { swap } = setup({ router: "0xrouter", neo: 100, gas: 0 });
    await swap.loadAll();
    // The receiving token is GAS (8 decimals). 0.00000002 GAS = 2 base units.
    swap.toAmount.set("0.00000002");
    // minReceived = floor(2 * 995 / 1000) = 1 base unit = "0.00000001", not "0".
    expect(swap.minReceived.get()).toBe("0.00000001");
  });
});

describe("useSwapEngine — MAX headroom", () => {
  it("reserves GAS fee headroom when MAX-ing a GAS balance", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 0, gas: 5 });
    await swap.loadAll();
    // Flip so GAS is the from-token.
    swap.swapTokens();
    await Promise.resolve();
    swap.setMaxAmount();
    // 5 GAS − 0.1 headroom = 4.9.
    expect(parseFloat(swap.fromAmount.get())).toBeCloseTo(4.9, 6);
  });

  it("floors MAX to a whole number for NEO (indivisible)", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 7, gas: 0 });
    await swap.loadAll();
    swap.setMaxAmount();
    expect(swap.fromAmount.get()).toBe("7");
    expect(swap.fromAmount.get()).not.toContain(".");
  });
});

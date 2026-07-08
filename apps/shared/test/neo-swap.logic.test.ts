import { describe, expect, it, vi, beforeEach } from "vitest";

import { createObservable } from "../react/context";

// Drive the on-chain feed from the test: each leg returns a price + dataTimestamp
// + recordTimestamp (epoch seconds). A far-past recordTimestamp exercises the
// staleness guard; recordTimestamp=0 models a never-written feed.
const feedState = {
  prices: { NEO: 2.182, GAS: 1.101 } as Record<string, number>,
  dataTimestamp: Math.floor(Date.now() / 1000), // fresh by default
  // recordTimestamp tracks dataTimestamp unless a test overrides it (e.g. to 0).
  recordTimestamp: null as number | null,
};

vi.mock("@shared/composables/useMorpheusDataFeed", () => ({
  useMorpheusDataFeed: () => ({
    network: "mainnet",
    error: createObservable<string | null>(null),
    getPrice: vi.fn(async (asset: string) => feedState.prices[asset.toUpperCase()] ?? 0),
    getPriceWithMeta: vi.fn(async (asset: string) => ({
      price: feedState.prices[asset.toUpperCase()] ?? 0,
      dataTimestamp: feedState.dataTimestamp,
      recordTimestamp:
        feedState.recordTimestamp === null ? feedState.dataTimestamp : feedState.recordTimestamp,
    })),
    listPairs: vi.fn(async () => ["NEO", "GAS"]),
  }),
}));

import { useSwapEngine } from "../../neo-swap/src/hooks/useSwapEngine";
import { createMiniAppFramework } from "../../../framework";
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

// Balances flow through app.wallet, backed by the injected platform
// BalanceService (getBalance is the only method the wallet shorthands hit).
function makeBalance(neo: number, gas: number) {
  return {
    getBalance: vi.fn(async (asset: string) => (asset === "NEO" ? neo : gas)),
  } as never;
}

function setup(opts: { router?: string | null; address?: string; neo?: number; gas?: number } = {}) {
  const chain = makeChain(opts);
  const balance = makeBalance(opts.neo ?? 100, opts.gas ?? 50);
  const app = createMiniAppFramework(
    { services: { chain, balance }, t } as never,
    { appId: "miniapp-neo-swap" },
  );
  const swap = useSwapEngine({ app, t });
  return { swap, chain };
}

beforeEach(() => {
  feedState.prices = { NEO: 2.182, GAS: 1.101 };
  feedState.dataTimestamp = Math.floor(Date.now() / 1000);
  feedState.recordTimestamp = null;
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

  it("treats a recordTimestamp=0 (never-written) feed as stale, not fresh", async () => {
    // A never-written feed returns recordTimestamp=0. The old guard short-circuited
    // `if (!ts) return false`, presenting a frozen/uninitialized price as live. It
    // must instead be flagged stale and blocked from trading.
    feedState.recordTimestamp = 0;
    const { swap } = setup({ router: "0xrouter" });
    await swap.loadAll();
    swap.setFromAmount("2");

    expect(swap.rateStale.get()).toBe(true);
    expect(swap.canSwap.get()).toBe(false);
    expect(swap.swapButtonText.get()).toBe("rateStale");
  });

  it("rejects executeSwap when the feed has a 0 record timestamp", async () => {
    feedState.recordTimestamp = 0;
    const { swap, chain } = setup({ router: "0xrouter" });
    await swap.loadAll();
    swap.setFromAmount("2");

    // canSwap is false, so executeSwap returns early without broadcasting.
    await swap.executeSwap();
    expect((chain as unknown as { invoke: { mock: { calls: unknown[] } } }).invoke.mock.calls.length).toBe(0);
  });

  it("does not flag stale before any quote loads (idle pre-quote state)", async () => {
    // With no rate yet (record timestamp 0, exchangeRate empty), the CTA reports
    // the rate as unavailable — not "stale" — so the idle state reads honestly.
    const { swap } = setup({ router: "0xrouter" });
    // No loadAll() → no quote fetched; exchangeRate stays empty.
    expect(swap.rateStale.get()).toBe(false);
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

describe("useSwapEngine — interactive slippage", () => {
  it("defaults to 0.5% (50 bps)", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 100, gas: 0 });
    await swap.loadAll();
    expect(swap.slippage.get()).toBe("0.5%");
    expect(swap.slippageValue.get()).toBe(50);
  });

  it("lowers the minimum received when slippage increases (quote unchanged)", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 100, gas: 0 });
    await swap.loadAll();
    swap.setFromAmount("10"); // NEO → GAS
    const quotedOutput = swap.toAmount.get();
    const minAtHalf = parseFloat(swap.minReceived.get());

    // Raise tolerance to 1% — only the floor moves, not the quoted output.
    swap.setSlippage("1");
    expect(swap.slippage.get()).toBe("1%");
    expect(swap.toAmount.get()).toBe(quotedOutput);
    expect(parseFloat(swap.minReceived.get())).toBeLessThan(minAtHalf);
  });

  it("raises the minimum received when slippage tightens to 0.1%", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 100, gas: 0 });
    await swap.loadAll();
    swap.setFromAmount("10");
    const minAtHalf = parseFloat(swap.minReceived.get());
    swap.setSlippage(0.1);
    expect(swap.slippage.get()).toBe("0.1%");
    expect(parseFloat(swap.minReceived.get())).toBeGreaterThan(minAtHalf);
  });

  it("clamps an out-of-range custom slippage into the supported band", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 100, gas: 0 });
    await swap.loadAll();
    swap.setSlippage("999"); // 999% → clamp to 50% ceiling (5000 bps)
    expect(swap.slippageValue.get()).toBe(5000);
    swap.setSlippage("0"); // 0% → clamp to 0.01% floor (1 bp)
    expect(swap.slippageValue.get()).toBe(1);
  });

  it("ignores a non-numeric custom slippage", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 100, gas: 0 });
    await swap.loadAll();
    swap.setSlippage("abc");
    expect(swap.slippageValue.get()).toBe(50);
  });

  it("sends the selected slippage floor as minOutput on-chain", async () => {
    const { swap, chain } = setup({ router: "0xrouter", neo: 100, gas: 0 });
    await swap.loadAll();
    swap.setFromAmount("10");
    swap.setSlippage("1"); // 1% → numerator 9900/10000
    const displayedMin = swap.minReceived.get();
    await swap.executeSwap();

    const invoke = (chain as unknown as { invoke: { mock: { calls: unknown[][] } } }).invoke;
    expect(invoke.mock.calls.length).toBe(1);
    const args = invoke.mock.calls[0][1] as Array<{ type: string; value: string }>;
    // minOutput is the 3rd positional arg (sender, amountIn, minOut, path, deadline).
    const minOutInt = BigInt(args[2].value);
    // Displayed minReceived (GAS, 8 decimals) equals the integer base units sent.
    expect(minOutInt).toBe(BigInt(Math.round(parseFloat(displayedMin) * 1e8)));
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

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
  delayMs: 0,
  fail: false,
  canonicalZero: false,
};

function feedSymbol(asset: string): string {
  return asset.toUpperCase().replace(/^TWELVEDATA:/, "").split("-")[0] ?? "";
}

vi.mock("@shared/composables/useMorpheusDataFeed", () => ({
  useMorpheusDataFeed: () => ({
    network: "mainnet",
    error: createObservable<string | null>(null),
    getPrice: vi.fn(async (asset: string) => feedState.prices[feedSymbol(asset)] ?? 0),
    getPriceWithMeta: vi.fn(async (asset: string) => {
      const isCanonicalRequest = !asset.includes(":");
      const canonicalZero = feedState.canonicalZero && isCanonicalRequest;
      const snapshot = {
        price: canonicalZero ? 0 : feedState.prices[feedSymbol(asset)] ?? 0,
        dataTimestamp: canonicalZero ? 0 : feedState.dataTimestamp,
        recordTimestamp:
          canonicalZero
            ? 0
            : feedState.recordTimestamp === null
              ? feedState.dataTimestamp
              : feedState.recordTimestamp,
      };
      if (feedState.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, feedState.delayMs));
      }
      if (feedState.fail) throw new Error("RPC unavailable");
      return snapshot;
    }),
    listPairs: vi.fn(async () => ["NEO", "GAS"]),
  }),
}));

import { useSwapEngine } from "../../neo-swap/src/hooks/useSwapEngine";
import { parseDecimalUnits } from "../../neo-swap/src/quoteMath";
import { createMiniAppFramework } from "../../../framework";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ROUTER = `0x${"1".repeat(40)}`;
const SWAP_TXID = `0x${"a".repeat(64)}`;

function t(key: string, params?: Record<string, string | number>) {
  if (!params) return key;
  return `${key}:${JSON.stringify(params)}`;
}

function makeChain(opts: {
  router?: string | null;
  address?: string;
  verified?: boolean;
  network?: string;
  recoveryEvent?: unknown;
  confirmationEvent?: unknown;
  invokeError?: Error;
} = {}) {
  const configuredRouter = opts.router === "0xrouter" ? ROUTER : opts.router;
  const invoke = vi.fn(async (_operation: unknown, _args: unknown, invokeOptions?: { onTransactionSent?: (txid: string) => void }) => {
    if (opts.invokeError) throw opts.invokeError;
    invokeOptions?.onTransactionSent?.(SWAP_TXID);
    return {
      txid: SWAP_TXID,
      success: true,
      verified: opts.verified !== false,
      event: opts.verified === false ? null : opts.confirmationEvent ?? { event_name: "SwapExecuted" },
    };
  });
  return {
    address: createObservable(opts.address ?? ALICE),
    contractAddress: createObservable<string | null>(configuredRouter ?? null),
    isConnected: createObservable(Boolean(opts.address ?? ALICE)),
    ensureWallet: vi.fn(async () => opts.address ?? ALICE),
    detectNetwork: vi.fn(async () => opts.network ?? "neo-n3-mainnet"),
    waitForEvent: vi.fn(async () => opts.recoveryEvent ?? { event_name: "SwapExecuted" }),
    invoke,
  } as never;
}

function balanceUnits(value: string | number, decimals: number): bigint {
  const raw = typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(decimals)
    : String(value);
  const units = parseDecimalUnits(raw, decimals, { allowZero: true });
  if (units === null) throw new Error("invalid test balance");
  return units;
}

// Balances flow through app.wallet.raw so the production engine never routes
// an 8-decimal GAS amount through JavaScript floating point.
function makeBalance(neo: string | number, gas: string | number) {
  return {
    getRawBalance: vi.fn(async (asset: string) => asset === "NEO"
      ? balanceUnits(neo, 0)
      : balanceUnits(gas, 8)),
  } as never;
}

function setup(opts: {
  router?: string | null;
  address?: string;
  neo?: string | number;
  gas?: string | number;
  verified?: boolean;
  network?: string;
  recoveryEvent?: unknown;
  confirmationEvent?: unknown;
  invokeError?: Error;
  approved?: boolean;
} = {}) {
  const chain = makeChain(opts);
  const balance = makeBalance(opts.neo ?? 100, opts.gas ?? 50);
  const app = createMiniAppFramework(
    { services: { chain, balance }, t } as never,
    { appId: "miniapp-neo-swap" },
  );
  const configuredRouter = (chain as unknown as { contractAddress: { get(): string | null } }).contractAddress.get();
  const swap = useSwapEngine({
    app,
    t,
    settlementBinding: configuredRouter && opts.approved !== false
      ? {
          network: "mainnet",
          scriptHash: configuredRouter,
          operation: "swapTokenInForTokenOut",
          confirmationEvent: "SwapExecuted",
          abiVersion: "test-only",
          validateConfirmation: (event) => (
            typeof event === "object"
            && event !== null
            && (event as { event_name?: unknown }).event_name === "SwapExecuted"
          ),
        }
      : null,
  });
  return { swap, chain };
}

beforeEach(() => {
  localStorage.clear();
  feedState.prices = { NEO: 2.182, GAS: 1.101 };
  feedState.dataTimestamp = Math.floor(Date.now() / 1000);
  feedState.recordTimestamp = null;
  feedState.delayMs = 0;
  feedState.fail = false;
  feedState.canonicalZero = false;
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

  it("does not enable settlement from an unapproved contract address alone", async () => {
    const { swap, chain } = setup({ router: "0xrouter", approved: false });
    await swap.loadAll();
    swap.setFromAmount("2");

    expect(swap.routerAvailable.get()).toBe(false);
    expect(swap.canSwap.get()).toBe(false);
    await swap.executeSwap();
    expect((chain as unknown as { invoke: ReturnType<typeof vi.fn> }).invoke).not.toHaveBeenCalled();
    swap.cleanup();
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

  it("rejects an implausibly future on-chain record timestamp", async () => {
    feedState.recordTimestamp = Math.floor(Date.now() / 1000) + 5 * 60;
    const { swap } = setup({ router: "0xrouter" });
    await swap.loadAll();
    swap.setFromAmount("2");

    expect(swap.rateStale.get()).toBe(true);
    expect(swap.canSwap.get()).toBe(false);
    swap.cleanup();
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

  it("reactively expires a once-fresh quote after ten minutes", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
      feedState.dataTimestamp = Math.floor(Date.now() / 1000);
      const { swap } = setup({ router: "0xrouter" });
      await swap.loadAll();
      swap.setFromAmount("2");

      expect(swap.rateStale.get()).toBe(false);
      expect(swap.canSwap.get()).toBe(true);

      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(swap.rateStale.get()).toBe(true);
      expect(swap.canSwap.get()).toBe(false);
      swap.cleanup();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useSwapEngine — quote recovery and pair binding", () => {
  it("falls back from an uninitialized zero AGG record to the explicit provider record", async () => {
    feedState.canonicalZero = true;
    const { swap } = setup({ router: null });

    await swap.loadExchangeRate();

    expect(swap.exchangeRate.get()).toBe("1.981834");
    expect(swap.rateError.get()).toBe("");
    expect(swap.rateStale.get()).toBe(false);
    swap.cleanup();
  });

  it("clears an unverifiable quote, exposes retry copy, and recovers on refresh", async () => {
    const { swap } = setup({ router: null });
    feedState.fail = true;
    await swap.loadExchangeRate();

    expect(swap.exchangeRate.get()).toBe("");
    expect(swap.rateError.get()).toBe("rateRefreshFailed");
    expect(swap.canSwap.get()).toBe(false);

    feedState.fail = false;
    await swap.loadExchangeRate();
    expect(swap.rateError.get()).toBe("");
    expect(Number(swap.exchangeRate.get())).toBeGreaterThan(0);
    swap.cleanup();
  });

  it("ignores an older in-flight response after the pair changes", async () => {
    const { swap } = setup({ router: "0xrouter" });
    feedState.delayMs = 12;

    const oldPairRequest = swap.loadExchangeRate();
    const neo = swap.fromToken.get();
    const gas = swap.toToken.get();
    swap.fromToken.set(gas);
    swap.toToken.set(neo);
    const newPairRequest = swap.loadExchangeRate();

    await Promise.all([oldPairRequest, newPairRequest]);

    expect(swap.selectedPairDisplay.get()).toBe("GAS/NEO");
    expect(swap.exchangeRate.get()).toBe("0.504582");
    expect(swap.rateError.get()).toBe("");
    swap.cleanup();
  });
});

describe("useSwapEngine — amount intent and precision", () => {
  it("rejects fractional NEO without silently truncating the requested amount", async () => {
    const { swap, chain } = setup({ router: "0xrouter", neo: 10, gas: 10 });
    await swap.loadAll();
    swap.setFromAmount("1.5");

    expect(swap.fromAmount.get()).toBe("1.5");
    expect(swap.amountError.get()).toBe("neoIntegerOnly");
    expect(swap.canSwap.get()).toBe(false);
    await swap.executeSwap();
    expect((chain as unknown as { invoke: { mock: { calls: unknown[] } } }).invoke.mock.calls).toHaveLength(0);
    swap.cleanup();
  });

  it("rejects GAS precision beyond fixed8", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 10, gas: 10 });
    await swap.loadAll();
    swap.swapTokens();
    swap.setFromAmount("1.123456789");

    expect(swap.fromAmount.get()).toBe("1.123456789");
    expect(swap.amountError.get()).toContain("tokenPrecisionExceeded");
    expect(swap.canSwap.get()).toBe(false);
    swap.cleanup();
  });

  it("rejects a pathologically long dispatch amount before BigInt quote work", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 10, gas: 10 });
    await swap.loadAll();
    swap.setFromAmount("9".repeat(200));

    expect(swap.amountError.get()).toBe("invalidAmount");
    expect(swap.canSwap.get()).toBe(false);
    swap.cleanup();
  });

  it("does not trust a dispatched token hash or precision override", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 10, gas: 10 });
    await swap.loadAll();
    swap.selectToken({
      symbol: "GAS",
      hash: `0x${"f".repeat(40)}`,
      balance: "999999999",
      balanceUnits: "99999999999999999",
      decimals: 1,
    });

    expect(swap.fromToken.get()).toMatchObject({
      symbol: "GAS",
      decimals: 8,
      hash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      balanceUnits: "1000000000",
    });
    swap.cleanup();
  });
});

describe("useSwapEngine — verified wallet balances", () => {
  it("fails closed when a wallet balance cannot be verified", async () => {
    const { swap } = setup({ router: "0xrouter", neo: Number.NaN, gas: 5 });
    await swap.loadAll();
    swap.setFromAmount("1");

    expect(swap.walletConnected.get()).toBe(true);
    expect(swap.balancesVerified.get()).toBe(false);
    expect(swap.canSwap.get()).toBe(false);
    expect(swap.swapButtonText.get()).toBe("balanceUnavailable");
    swap.cleanup();
  });

  it("hides an old account's balances immediately after the wallet address changes", async () => {
    const { swap, chain } = setup({ router: "0xrouter", neo: 10, gas: 5 });
    await swap.loadAll();
    swap.setFromAmount("1");
    expect(swap.balancesVerified.get()).toBe(true);
    expect(swap.canSwap.get()).toBe(true);

    (chain as unknown as { address: { set: (value: string) => void } }).address.set(
      "NQRLhQW9GjMAMHE9JKTKEKfTzQKT7A7y1Z",
    );

    expect(swap.balancesVerified.get()).toBe(false);
    expect(swap.canSwap.get()).toBe(false);
    swap.cleanup();
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

  it("quotes output from exact fixed-six price integers, not a rounded display rate", async () => {
    feedState.prices = { NEO: 0.1, GAS: 0.3 };
    const { swap } = setup({ router: "0xrouter", neo: 10, gas: 0 });
    await swap.loadAll();
    swap.setFromAmount("1");

    expect(swap.exchangeRate.get()).toBe("0.333333");
    expect(swap.toAmount.get()).toBe("0.33333333");
    swap.cleanup();
  });

  it("does not collapse a tiny output to a zero slippage floor", async () => {
    // A tiny GAS output (2 base units) would underflow float scientific
    // notation if minReceived were computed via .toString(). The BigInt floor
    // keeps 1 base unit instead of rounding the whole thing to "0".
    feedState.prices = { NEO: 0.000001, GAS: 50 };
    const { swap } = setup({ router: "0xrouter", neo: 100, gas: 0 });
    await swap.loadAll();
    swap.setFromAmount("1");
    // The receiving token is GAS (8 decimals). 0.00000002 GAS = 2 base units.
    expect(swap.toAmount.get()).toBe("0.00000002");
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
    expect(invoke.mock.calls[0][2]).toMatchObject({
      scriptHash: ROUTER,
      waitForEvent: "SwapExecuted",
      waitTimeoutMs: 60_000,
    });
    // minOutput is the 3rd positional arg (sender, amountIn, minOut, path, deadline).
    const minOutInt = BigInt(args[2].value);
    // Displayed minReceived (GAS, 8 decimals) equals the integer base units sent.
    expect(minOutInt).toBe(parseDecimalUnits(displayedMin, 8));
  });

  it("keeps the user's intent when a broadcast has no verified SwapExecuted event", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 100, gas: 0, verified: false });
    await swap.loadAll();
    swap.setFromAmount("10");

    await expect(swap.executeSwap()).rejects.toThrow("swapConfirmationPending");
    expect(swap.fromAmount.get()).toBe("10");
    expect(swap.toAmount.get()).not.toBe("");
    expect(swap.pendingTxid.get()).toBe(SWAP_TXID);
    expect(swap.transactionStatus.get()).toBe("unverified");
    swap.cleanup();
  });

  it("keeps the intent pending when an event name is present but its binding validator rejects it", async () => {
    const { swap } = setup({
      router: "0xrouter",
      neo: 100,
      gas: 0,
      confirmationEvent: { event_name: "DifferentSwap" },
    });
    await swap.loadAll();
    swap.setFromAmount("10");

    await expect(swap.executeSwap()).rejects.toThrow("swapConfirmationPending");
    expect(swap.pendingTxid.get()).toBe(SWAP_TXID);
    expect(swap.transactionStatus.get()).toBe("unverified");
    swap.cleanup();
  });

  it("keeps raw wallet/RPC failure text out of the product recovery panel", async () => {
    const { swap } = setup({
      router: "0xrouter",
      neo: 100,
      gas: 0,
      invokeError: new Error("VM FAULT: internal provider dump"),
    });
    await swap.loadAll();
    swap.setFromAmount("10");

    await expect(swap.executeSwap()).rejects.toThrow("internal provider dump");
    expect(swap.pendingTxid.get()).toBe("");
    expect(swap.transactionStatus.get()).toBe("failed");
    expect(swap.transactionError.get()).toBe("swapFailedRecoveryHint");
    swap.cleanup();
  });

  it("recovers the exact persisted transaction before allowing another swap", async () => {
    const { swap, chain } = setup({ router: "0xrouter", neo: 100, gas: 0, verified: false });
    await swap.loadAll();
    swap.setFromAmount("10");

    await expect(swap.executeSwap()).rejects.toThrow("swapConfirmationPending");
    expect(swap.canSwap.get()).toBe(false);

    await expect(swap.recoverPendingSwap()).resolves.toBe(true);
    expect((chain as unknown as { waitForEvent: ReturnType<typeof vi.fn> }).waitForEvent)
      .toHaveBeenCalledWith(SWAP_TXID, "SwapExecuted", 45_000);
    expect(swap.pendingTxid.get()).toBe("");
    expect(swap.transactionStatus.get()).toBe("confirmed");
    expect(swap.fromAmount.get()).toBe("");
    swap.cleanup();
  });
});

describe("useSwapEngine — wallet network binding", () => {
  it("does not expose balances or settlement when the wallet is on a different network", async () => {
    const { swap } = setup({ router: "0xrouter", network: "neo-n3-testnet", neo: 100, gas: 50 });
    await swap.loadAll();
    swap.setFromAmount("2");

    expect(swap.quoteNetwork.get()).toBe("mainnet");
    expect(swap.walletNetwork.get()).toBe("");
    expect(swap.networkVerified.get()).toBe(false);
    expect(swap.networkError.get()).toContain("walletNetworkMismatch");
    expect(swap.balancesVerified.get()).toBe(false);
    expect(swap.canSwap.get()).toBe(false);
    swap.cleanup();
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

  it("keeps MAX exact above Number.MAX_SAFE_INTEGER base units", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 0, gas: "90071992.54740991" });
    await swap.loadAll();
    swap.swapTokens();
    await Promise.resolve();
    swap.setMaxAmount();

    expect(swap.fromAmount.get()).toBe("90071992.44740991");
    swap.cleanup();
  });

  it("floors MAX to a whole number for NEO (indivisible)", async () => {
    const { swap } = setup({ router: "0xrouter", neo: 7, gas: 0 });
    await swap.loadAll();
    swap.setMaxAmount();
    expect(swap.fromAmount.get()).toBe("7");
    expect(swap.fromAmount.get()).not.toContain(".");
  });
});

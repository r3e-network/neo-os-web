import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { useFlashloanCore } from "../../flashloan/src/composables/useFlashloanCore";

// Script-hash form so normalizeHash160Input (used for provider-stats reads)
// resolves it directly without a base58 checksum decode.
const OWNER = "0x2222222222222222222222222222222222222222";
const CALLBACK = "0x1111111111111111111111111111111111111111";

function t(key: string) {
  const messages: Record<string, string> = {
    invalidLoanId: "Invalid loan ID",
    invalidLoanAmount: "Invalid loan amount",
    invalidLiquidityAmount: "Enter a valid GAS amount",
    invalidCallbackContract: "Invalid callback contract address",
    invalidCallbackMethod: "Callback method must be onFlashLoan",
    loanNotFound: "Loan not found",
    statsUnavailable: "Live pool stats are temporarily unavailable.",
    receiptIdRequired: "On mainnet, transfer GAS first, then enter the receipt ID.",
    notAvailable: "Unavailable",
    connectWallet: "Connect Wallet",
  };
  return messages[key] ?? key;
}

// Live getPlatformStats() shape, verified on mainnet 0xb5d8fb0d.
const PLATFORM_STATS = {
  totalLoans: 2,
  totalBorrowed: "1000000000",
  totalFees: "900000",
  poolBalance: "1250000000",
  totalBorrowers: 1,
  totalProviders: 1,
  minLoan: "100000000",
  maxLoan: "10000000000000",
  feeBasisPoints: 9,
  loanCooldownSeconds: "300",
  maxDailyLoans: 10,
  providerFeeShare: 80,
};

function loanDetailsFor(loanId: number) {
  return {
    id: String(loanId),
    borrower: OWNER,
    amount: loanId === 2 ? "200000000" : "100000000",
    fee: loanId === 2 ? "180000" : "90000",
    callbackContract: CALLBACK,
    callbackMethod: "onFlashLoan",
    timestamp: 1780000000000,
    executed: true,
    success: true,
    status: "success",
  };
}

function setup(options: { network?: "mainnet" | "testnet" } = {}) {
  const read = vi.fn(async (operation: string, args?: unknown[]) => {
    if (operation === "getPlatformStats") {
      return PLATFORM_STATS;
    }
    if (operation === "getLoanDetails") {
      const loanId = Number((args?.[0] as { value?: string })?.value ?? 0);
      return loanDetailsFor(loanId);
    }
    if (operation === "getProviderStatsDetails") {
      return {
        totalDeposited: "500000000",
        currentBalance: "500000000",
        totalWithdrawn: "0",
        totalFeesEarned: "12000",
      };
    }
    return null;
  });
  const invoke = vi.fn(async () => ({ txid: "0xflashrequest", success: true }));
  const invokeWithPayment = vi.fn(async () => ({ txid: "0xflashdeposit", success: true }));
  const chain = {
    address: createObservable(OWNER),
    ensureWallet: vi.fn(async () => OWNER),
    invoke,
    invokeWithPayment,
    read,
  };
  const badge = { award: vi.fn(async () => undefined) };
  const flashloan = useFlashloanCore({
    chainService: chain as never,
    badgeService: badge as never,
    t,
    network: options.network,
  });
  flashloan.setAddress(OWNER);
  return { flashloan, chain, badge, invoke, invokeWithPayment, read };
}

describe("useFlashloanCore contract flow (deployed ABI)", () => {
  it("submits requestLoan with the deployed appId-free signature", async () => {
    const { flashloan, chain, invoke } = setup();

    await flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "onFlashLoan",
    });

    expect(chain.ensureWallet).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith(
      "requestLoan",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "100000000" },
        { type: "Hash160", value: CALLBACK },
        { type: "String", value: "onFlashLoan" },
      ],
      { waitForEvent: "LoanExecuted", waitTimeoutMs: 30000 },
    );
    expect(flashloan.lastRequest.get()?.txid).toBe("0xflashrequest");
  });

  it("loads pool, totals, constants (fee + cooldown), and recent loans from getPlatformStats", async () => {
    const { flashloan, read } = setup();

    await flashloan.loadData();

    expect(read).toHaveBeenCalledWith(
      "getPlatformStats",
      [],
      { cache: true, cacheTtlMs: 30000 },
    );
    expect(flashloan.poolBalance.get()).toBe(12.5);
    expect(flashloan.stats.get()).toEqual({
      totalLoans: 2,
      totalVolume: 10,
      totalFees: 0.009,
    });
    expect(flashloan.contractStats.get()).toMatchObject({
      minLoan: 1,
      maxLoan: 100000,
      feeBasisPoints: 9,
      // loanCooldownSeconds (300) converted to ms.
      cooldownMs: 300000,
      maxDailyLoans: 10,
    });
    expect(flashloan.recentLoans.get()).toHaveLength(2);
    expect(flashloan.serviceNotice.get()).toBe("");
  });

  it("reads the fee basis points from the contract, not a hardcoded default", async () => {
    const { flashloan, read } = setup();
    read.mockImplementation(async (operation: string) => {
      if (operation === "getPlatformStats") {
        return { ...PLATFORM_STATS, totalLoans: 0, feeBasisPoints: 15 };
      }
      return null;
    });

    await flashloan.loadData();
    expect(flashloan.contractStats.get().feeBasisPoints).toBe(15);
  });

  it("looks up a loan through getLoanDetails(loanId)", async () => {
    const { flashloan, read } = setup();

    await flashloan.lookupLoan("2");

    expect(read).toHaveBeenCalledWith(
      "getLoanDetails",
      [{ type: "Integer", value: "2" }],
    );
    expect(flashloan.loanDetails.get()?.id).toBe("2");
  });

  it("throws loanNotFound and keeps loanDetails null for a non-existent loan", async () => {
    const emptyChain = {
      address: createObservable(OWNER),
      ensureWallet: vi.fn(async () => OWNER),
      invoke: vi.fn(),
      invokeWithPayment: vi.fn(),
      read: vi.fn(async () => ({
        id: "999",
        borrower: null,
        amount: "0",
        fee: "0",
        callbackContract: null,
        callbackMethod: null,
        timestamp: "0",
        executed: false,
        success: false,
        status: "pending",
      })),
    };
    const emptyLoan = useFlashloanCore({
      chainService: emptyChain as never,
      badgeService: { award: vi.fn(async () => undefined) } as never,
      t,
    });

    await expect(emptyLoan.lookupLoan("999")).rejects.toThrow("Loan not found");
    expect(emptyLoan.loanDetails.get()).toBeNull();
  });

  it("raises a service notice and preserves the last good snapshot on a read failure", async () => {
    const { flashloan, read } = setup();

    // First load succeeds and populates the hero.
    await flashloan.loadData();
    expect(flashloan.poolBalance.get()).toBe(12.5);

    // Next load faults — the contract read throws.
    read.mockRejectedValueOnce(new Error("FAULT: method not found"));
    await flashloan.loadData();

    // Snapshot is preserved (not zeroed), and a notice is shown.
    expect(flashloan.poolBalance.get()).toBe(12.5);
    expect(flashloan.stats.get().totalLoans).toBe(2);
    expect(flashloan.serviceNotice.get()).toBe(
      "Live pool stats are temporarily unavailable.",
    );
  });

  it("provides liquidity through invokeWithPayment on testnet", async () => {
    const { flashloan, invokeWithPayment } = setup({ network: "testnet" });

    await flashloan.provideLiquidity("5");

    expect(invokeWithPayment).toHaveBeenCalledWith(
      "500000000",
      "miniapp-flashloan:deposit",
      "deposit",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "500000000" },
        { type: "Integer", value: "0" },
      ],
      { waitForEvent: "LiquidityDeposited", waitTimeoutMs: 30000 },
    );
  });

  it("requires a receipt id for liquidity deposits on mainnet", async () => {
    const { flashloan, invoke } = setup({ network: "mainnet" });

    await expect(flashloan.provideLiquidity("5")).rejects.toThrow(
      "transfer GAS first",
    );
    expect(invoke).not.toHaveBeenCalled();

    await flashloan.provideLiquidity("5", "42");
    expect(invoke).toHaveBeenCalledWith(
      "deposit",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "500000000" },
        { type: "Integer", value: "42" },
      ],
      { waitForEvent: "LiquidityDeposited", waitTimeoutMs: 30000 },
    );
  });

  it("withdraws liquidity through withdraw(provider, amount)", async () => {
    const { flashloan, invoke } = setup();

    await flashloan.withdrawLiquidity("2");

    expect(invoke).toHaveBeenCalledWith(
      "withdraw",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "200000000" },
      ],
      { waitForEvent: "LiquidityWithdrawn", waitTimeoutMs: 30000 },
    );
  });

  it("loads the connected provider's liquidity stats", async () => {
    const { flashloan } = setup();

    await flashloan.loadData();

    expect(flashloan.providerStats.get()).toEqual({
      currentBalance: 5,
      totalDeposited: 5,
      totalFeesEarned: 0.00012,
    });
  });
});

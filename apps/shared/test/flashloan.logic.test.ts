import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import { addressToScriptHash } from "../utils/neo";
import { useFlashloanCore } from "../../flashloan/src/composables/useFlashloanCore";

// Script-hash form so normalizeHash160Input (used for provider-stats reads)
// resolves it directly without a base58 checksum decode.
const OWNER = "0x2222222222222222222222222222222222222222";
const CALLBACK = "0x1111111111111111111111111111111111111111";
const CONTRACT = "0xde8e595d8d3c293731db499367ee2a768e1e458b";
const MAIN_CONTRACT = "0xb5d8fb0dc2319edc4be3104304b4136b925df6e4";
const REQUEST_TX = `0x${"a".repeat(64)}`;
const DEPOSIT_TX = `0x${"b".repeat(64)}`;
const WITHDRAW_TX = `0x${"c".repeat(64)}`;
const PAYMENT_TX = `0x${"d".repeat(64)}`;
const OTHER_TX = `0x${"9".repeat(64)}`;
const OTHER_OWNER = "0x3333333333333333333333333333333333333333";
const BASE58_OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BASE58_OWNER_HASH = addressToScriptHash(BASE58_OWNER);

function reverseHash(value: string) {
  const hex = value.replace(/^0x/, "");
  return `0x${hex.match(/.{2}/g)?.reverse().join("") ?? ""}`;
}

afterEach(() => localStorage.clear());

function t(key: string) {
  const messages: Record<string, string> = {
    invalidLoanId: "Invalid loan ID",
    invalidLoanAmount: "Invalid loan amount",
    invalidLiquidityAmount: "Enter a valid GAS amount",
    invalidCallbackContract: "Invalid callback contract address",
    invalidCallbackMethod: "Enter a valid callback method",
    loanNotFound: "Loan not found",
    statsUnavailable: "Live pool stats are temporarily unavailable.",
    walletDataUnavailable: "walletDataUnavailable",
    receiptIdRequired: "On mainnet, transfer GAS first, then enter the receipt ID.",
    contractUnavailable: "Contract unavailable",
    contractPaused: "Contract paused",
    loanExceedsPool: "Loan exceeds pool",
    loanExceedsEligibility: "Loan exceeds eligibility",
    borrowerCooldown: "Borrower cooldown",
    dailyLimitReached: "Daily limit reached",
    loanConfirmationPending: "loanConfirmationPending",
    loanConfirmationReview: "loanConfirmationReview",
    liquidityConfirmationPending: "liquidityConfirmationPending",
    liquidityConfirmationReview: "liquidityConfirmationReview",
    liquidityResumeRequired: "liquidityResumeRequired",
    liquidityResumeUnavailable: "liquidityResumeUnavailable",
    recoveryWalletMismatch: "recoveryWalletMismatch",
    chainContextMismatch: "chainContextMismatch",
    recoveryStorageUnavailable: "recoveryStorageUnavailable",
    pendingContextMismatch: "pendingContextMismatch",
    eventMismatch: "eventMismatch",
    readbackMismatch: "readbackMismatch",
    paymentHubUnavailable: "paymentHubUnavailable",
    loanTransactionFault: "loanTransactionFault",
    liquidityTransactionFault: "liquidityTransactionFault",
    liquidityPaymentPending: "liquidityPaymentPending",
    liquidityActionUnavailable: "liquidityActionUnavailable",
    withdrawExceedsBalance: "withdrawExceedsBalance",
    actionInProgress: "actionInProgress",
    otherFinancialActionPending: "otherFinancialActionPending",
    walletContextChanged: "walletContextChanged",
    transactionIdMismatch: "transactionIdMismatch",
    recoveredActionNotReplayed: "recoveredActionNotReplayed",
    notAvailable: "Unavailable",
    connectWallet: "Connect Wallet",
  };
  return messages[key] ?? key;
}

/** Wrap a mock chain in the MiniApp framework SDK the composable now consumes. */
function makeApp(chain: unknown, network: "mainnet" | "testnet") {
  return createMiniAppFramework(
    { services: { chain }, t, launchContext: { network } } as never,
    { appId: "miniapp-flashloan" },
  );
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

function setup(options: {
  network?: "mainnet" | "testnet";
  mainnetPaymentHub?: boolean;
  transactionOutcome?: { state: "halt" | "fault" | "unknown"; event: unknown | null };
  paymentOutcome?: { state: "halt" | "fault" | "unknown"; event: unknown | null };
} = {}) {
  const effectiveNetwork = options.network === "testnet" ? "testnet" : "mainnet";
  const platformStats = { ...PLATFORM_STATS };
  let providerBalance = 500000000n;
  let providerTotalDeposited = 500000000n;
  let providerTotalWithdrawn = 0n;
  const loans = new Map<number, ReturnType<typeof loanDetailsFor>>([
    [1, loanDetailsFor(1)],
    [2, loanDetailsFor(2)],
  ]);
  const events: Record<string, unknown[]> = {
    LoanExecuted: [],
    LiquidityDeposited: [],
    LiquidityWithdrawn: [],
  };
  const read = vi.fn(async (operation: string, args?: unknown[]) => {
    if (operation === "getPlatformStats") {
      return { ...platformStats };
    }
    if (operation === "isPaused") {
      return false;
    }
    if (operation === "paymentHub") {
      return options.mainnetPaymentHub ? "0x3333333333333333333333333333333333333333" : "0x0000000000000000000000000000000000000000";
    }
    if (operation === "getBorrowerEligibility") {
      return {
        canBorrow: true,
        maxAvailableLoan: String(platformStats.poolBalance),
        cooldownRemaining: "0",
        dailyLoansRemaining: "10",
      };
    }
    if (operation === "getLoanDetails") {
      const loanId = Number((args?.[0] as { value?: string })?.value ?? 0);
      return loans.get(loanId) ?? loanDetailsFor(loanId);
    }
    if (operation === "getProviderStatsDetails") {
      return {
        totalDeposited: providerTotalDeposited.toString(),
        currentBalance: providerBalance.toString(),
        totalWithdrawn: providerTotalWithdrawn.toString(),
        totalFeesEarned: "12000",
      };
    }
    return null;
  });
  const invoke = vi.fn(async (operation: string, args?: unknown[], rawOptions?: unknown) => {
    const invokeOptions = rawOptions as { onTransactionSent?: (txid: string) => void } | undefined;
    if (operation === "requestLoan") {
      invokeOptions?.onTransactionSent?.(REQUEST_TX);
      platformStats.totalLoans += 1;
      platformStats.totalBorrowed = String(BigInt(platformStats.totalBorrowed) + 100000000n);
      platformStats.totalFees = String(BigInt(platformStats.totalFees) + 90000n);
      platformStats.poolBalance = String(BigInt(platformStats.poolBalance) + 90000n);
      const loanId = platformStats.totalLoans;
      loans.set(loanId, {
        ...loanDetailsFor(loanId),
        amount: String((args?.[1] as { value?: string })?.value ?? "100000000"),
        callbackMethod: String((args?.[3] as { value?: string })?.value ?? "execute"),
      });
      const event = {
        tx_hash: REQUEST_TX,
        state: [
          { value: String(loanId) },
          { value: OWNER },
          { value: String((args?.[1] as { value?: string })?.value ?? "100000000") },
          { value: "90000" },
          { value: true },
        ],
      };
      events.LoanExecuted.unshift(event);
      return { txid: REQUEST_TX, success: true, verified: true, event };
    }
    if (operation === "deposit") {
      invokeOptions?.onTransactionSent?.(DEPOSIT_TX);
      const amount = BigInt(String((args?.[1] as { value?: string })?.value ?? "0"));
      providerBalance += amount;
      providerTotalDeposited += amount;
      const event = {
        tx_hash: DEPOSIT_TX,
        state: [{ value: OWNER }, { value: amount.toString() }, { value: providerTotalDeposited.toString() }],
      };
      events.LiquidityDeposited.unshift(event);
      return { txid: DEPOSIT_TX, success: true, verified: true, event };
    }
    if (operation === "withdraw") {
      invokeOptions?.onTransactionSent?.(WITHDRAW_TX);
      const amount = BigInt(String((args?.[1] as { value?: string })?.value ?? "0"));
      providerBalance -= amount;
      providerTotalWithdrawn += amount;
      const event = {
        tx_hash: WITHDRAW_TX,
        state: [{ value: OWNER }, { value: amount.toString() }, { value: providerBalance.toString() }],
      };
      events.LiquidityWithdrawn.unshift(event);
      return { txid: WITHDRAW_TX, success: true, verified: true, event };
    }
    return { txid: REQUEST_TX, success: true, verified: true };
  });
  const invokeWithPayment = vi.fn(async (...args: unknown[]) => {
    const callArgs = args[3] as Array<{ value?: string }>;
    const invokeOptions = args[4] as {
      onPaymentSent?: (txid: string) => void;
      onTransactionSent?: (txid: string) => void;
    } | undefined;
    invokeOptions?.onPaymentSent?.(PAYMENT_TX);
    invokeOptions?.onTransactionSent?.(DEPOSIT_TX);
    const amount = BigInt(String(callArgs?.[1]?.value ?? "0"));
    providerBalance += amount;
    providerTotalDeposited += amount;
    const event = {
      tx_hash: DEPOSIT_TX,
      state: [{ value: OWNER }, { value: amount.toString() }, { value: providerTotalDeposited.toString() }],
    };
    events.LiquidityDeposited.unshift(event);
    return { txid: DEPOSIT_TX, success: true, verified: true, event };
  });
  const chain = {
    address: createObservable(OWNER),
    contractAddress: createObservable(effectiveNetwork === "testnet" ? CONTRACT : MAIN_CONTRACT),
    detectNetwork: vi.fn(async () => effectiveNetwork),
    ensureWallet: vi.fn(async () => OWNER),
    invoke,
    invokeWithPayment,
    read,
    listEvents: vi.fn(async (eventName: string) => events[eventName] ?? []),
  };
  const badge = { award: vi.fn(async () => undefined) };
  const app = makeApp(chain, effectiveNetwork);
  const transactionOutcomeReader = vi.fn(async () => (
    options.transactionOutcome ?? { state: "unknown" as const, event: null }
  ));
  const paymentOutcomeReader = vi.fn(async () => (
    options.paymentOutcome ?? { state: "halt" as const, event: { state: [] } }
  ));
  const flashloan = useFlashloanCore({
    app,
    badgeService: badge as never,
    t,
    network: options.network,
    transactionOutcomeReader,
    paymentOutcomeReader,
  });
  flashloan.setAddress(OWNER);
  return {
    flashloan,
    app,
    chain,
    badge,
    invoke,
    invokeWithPayment,
    read,
    events,
    platformStats,
    transactionOutcomeReader,
    paymentOutcomeReader,
  };
}

describe("useFlashloanCore contract flow (deployed ABI)", () => {
  it("submits requestLoan with the deployed appId-free signature", async () => {
    const { flashloan, chain, invoke } = setup();

    await flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    });

    expect(chain.ensureWallet).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith(
      "requestLoan",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "100000000" },
        { type: "Hash160", value: CALLBACK },
        { type: "String", value: "execute" },
      ],
      expect.objectContaining({
        waitForEvent: "LoanExecuted",
        waitTimeoutMs: 30000,
        onTransactionSent: expect.any(Function),
      }),
    );
    expect(flashloan.lastRequest.get()?.txid).toBe(REQUEST_TX);
  });

  it("normalizes a base58 wallet through the canonical Hash160 builder", async () => {
    const { flashloan, app, chain, invoke } = setup({ network: "testnet" });
    chain.address.set(BASE58_OWNER);
    chain.ensureWallet.mockResolvedValue(BASE58_OWNER);
    flashloan.setAddress(BASE58_OWNER);
    invoke.mockImplementationOnce(async (_operation, _args, options) => {
      options?.onTransactionSent?.(REQUEST_TX);
      return { txid: REQUEST_TX, success: true, verified: false };
    });
    vi.spyOn(app.chain, "waitForState").mockResolvedValue(null);

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("loanConfirmationPending");

    expect(invoke.mock.calls[0]?.[1]?.[0]).toEqual({
      type: "Hash160",
      value: BASE58_OWNER_HASH,
    });
  });

  it("persists an unconfirmed request and blocks a duplicate flash loan", async () => {
    const { flashloan, app, invoke } = setup();
    invoke.mockImplementation(async (_operation: string, _args: unknown[], options?: { onTransactionSent?: (txid: string) => void }) => {
      const txid = `0x${"e".repeat(64)}`;
      options?.onTransactionSent?.(txid);
      return { txid, success: true, verified: false };
    });
    vi.spyOn(app.chain, "waitForState").mockResolvedValue(null);

    const request = {
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    };

    await expect(flashloan.requestLoan(request)).rejects.toThrow("loanConfirmationPending");
    expect(flashloan.pendingRequestTxid.get()).toBe(`0x${"e".repeat(64)}`);
    expect(invoke).toHaveBeenCalledTimes(1);

    await expect(flashloan.requestLoan(request)).rejects.toThrow("loanConfirmationPending");
    expect(invoke).toHaveBeenCalledTimes(1);

    const date = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60 * 1000);
    await expect(flashloan.requestLoan(request)).rejects.toThrow("loanConfirmationReview");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(flashloan.pendingRequestTxid.get()).toBe(`0x${"e".repeat(64)}`);
    date.mockRestore();
  });

  it("serializes every financial action before any wallet or chain await", async () => {
    const { flashloan, invoke, invokeWithPayment } = setup({ network: "testnet" });
    const originalInvoke = invoke.getMockImplementation()!;
    let releaseInvoke!: () => void;
    const invokeGate = new Promise<void>((resolve) => {
      releaseInvoke = resolve;
    });
    invoke.mockImplementationOnce(async (...args: Parameters<typeof originalInvoke>) => {
      await invokeGate;
      return originalInvoke(...args);
    });

    const request = flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    });
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));

    await expect(flashloan.provideLiquidity("1")).rejects.toThrow("actionInProgress");
    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(flashloan.writeOperation.get()).toBe("request");

    releaseInvoke();
    await request;
    expect(flashloan.writeOperation.get()).toBe("");
    expect(flashloan.isLoading.get()).toBe(false);
  });

  it("blocks a different financial flow while a prior tx remains unresolved", async () => {
    const { flashloan, app, invoke, invokeWithPayment } = setup({ network: "testnet" });
    invoke.mockImplementationOnce(async (_operation, _args, options) => {
      const sent = options as { onTransactionSent?: (txid: string) => void };
      sent.onTransactionSent?.(REQUEST_TX);
      return { txid: REQUEST_TX, success: true, verified: false };
    });
    vi.spyOn(app.chain, "waitForState").mockResolvedValue(null);

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("loanConfirmationPending");
    await expect(flashloan.provideLiquidity("1")).rejects.toThrow(
      "otherFinancialActionPending",
    );

    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(flashloan.pendingRequestTxid.get()).toBe(REQUEST_TX);
  });

  it("rejects malformed loan amounts before wallet submission", async () => {
    const { flashloan, chain, invoke } = setup();

    await expect(
      flashloan.requestLoan({
        amount: "1abc",
        callbackContract: CALLBACK,
        callbackMethod: "execute",
      }),
    ).rejects.toThrow("Invalid loan amount");

    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("accepts the deployed dynamic callback name and rejects malformed method identifiers", async () => {
    const { flashloan, invoke } = setup({ network: "testnet" });

    await flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    });
    expect(invoke.mock.calls[0]?.[1]?.[3]).toEqual({ type: "String", value: "execute" });

    const second = setup({ network: "testnet" });
    await expect(second.flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute();destroy",
    })).rejects.toThrow("Enter a valid callback method");
    expect(second.invoke).not.toHaveBeenCalled();
  });

  it("fails closed when the live pool cannot cover the requested principal", async () => {
    const { flashloan, platformStats, invoke } = setup({ network: "testnet" });
    platformStats.poolBalance = "50000000";

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("Loan exceeds pool");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("fails closed while the deployed contract is paused", async () => {
    const { flashloan, read, invoke } = setup({ network: "testnet" });
    const originalRead = read.getMockImplementation()!;
    read.mockImplementation(async (operation: string, args?: unknown[]) =>
      operation === "isPaused" ? true : originalRead(operation, args));

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("Contract paused");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not treat a malformed pause state as an unpaused contract", async () => {
    const { flashloan, read, invoke } = setup({ network: "testnet" });
    const originalRead = read.getMockImplementation()!;
    read.mockImplementation(async (operation: string, args?: unknown[]) =>
      operation === "isPaused" ? "unknown" : originalRead(operation, args));

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("Live pool stats are temporarily unavailable");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("requires the exact tx-bound event as well as the matching loan readback", async () => {
    const { flashloan, app, invoke, events } = setup({ network: "testnet" });
    const originalInvoke = invoke.getMockImplementation()!;
    invoke.mockImplementation(async (...args: Parameters<typeof originalInvoke>) => {
      const result = await originalInvoke(...args);
      events.LoanExecuted = [];
      return {
        ...result,
        event: {
          tx_hash: REQUEST_TX,
          state: [
            { value: "3" },
            { value: `0x${"9".repeat(40)}` },
            { value: "100000000" },
            { value: "90000" },
            { value: true },
          ],
        },
      };
    });
    vi.spyOn(app.chain, "waitForState").mockResolvedValue(null);

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("eventMismatch");
    expect(flashloan.lastRequest.get()).toBeNull();
    expect(flashloan.pendingRequestTxid.get()).toBe(REQUEST_TX);
  });

  it("locks the first broadcast when wallet callbacks and the result disagree on txid", async () => {
    const { flashloan, invoke } = setup({ network: "testnet" });
    invoke.mockImplementationOnce(async (_operation, _args, rawOptions) => {
      const options = rawOptions as { onTransactionSent?: (txid: string) => void };
      options.onTransactionSent?.(REQUEST_TX);
      return { txid: OTHER_TX, success: true, verified: false };
    });

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("transactionIdMismatch");

    expect(flashloan.pendingRequestTxid.get()).toBe(REQUEST_TX);
    expect(flashloan.lastRequest.get()).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("reports a recovered prior loan without replaying the new click", async () => {
    const { flashloan, app, invoke, events, platformStats } = setup({ network: "testnet" });
    const originalInvoke = invoke.getMockImplementation()!;
    invoke.mockImplementationOnce(async (...args: Parameters<typeof originalInvoke>) => {
      const result = await originalInvoke(...args);
      events.LoanExecuted = [];
      return { ...result, event: undefined, verified: false };
    });
    vi.spyOn(app.chain, "waitForState").mockResolvedValue(null);
    const request = {
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    };

    await expect(flashloan.requestLoan(request)).rejects.toThrow("loanConfirmationPending");
    const loanId = Number(platformStats.totalLoans);
    events.LoanExecuted.push({
      tx_hash: REQUEST_TX,
      state: [
        { value: String(loanId) },
        { value: OWNER },
        { value: "100000000" },
        { value: "90000" },
        { value: true },
      ],
    });

    await expect(flashloan.requestLoan(request)).rejects.toThrow("recoveredActionNotReplayed");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(flashloan.pendingRequestTxid.get()).toBe("");
    expect(flashloan.lastRequest.get()?.loanId).toBe(String(loanId));
  });

  it("accepts exact tx-bound account evidence in Neo chain byte order", async () => {
    const { flashloan, invoke, read } = setup({ network: "testnet" });
    const originalInvoke = invoke.getMockImplementation()!;
    const originalRead = read.getMockImplementation()!;
    invoke.mockImplementationOnce(async (...args: Parameters<typeof originalInvoke>) => {
      const result = await originalInvoke(...args);
      const event = result.event as { tx_hash: string; state: Array<{ value: unknown }> };
      return {
        ...result,
        event: {
          ...event,
          tx_hash: REQUEST_TX.slice(2),
          state: event.state.map((slot, index) => (
            index === 1 ? { value: reverseHash(OWNER) } : slot
          )),
        },
      };
    });
    read.mockImplementation(async (operation: string, args?: unknown[], options?: unknown) => {
      const value = await originalRead(operation, args, options);
      if (operation !== "getLoanDetails") return value;
      return {
        ...(value as Record<string, unknown>),
        borrower: reverseHash(OWNER),
        callbackContract: reverseHash(CALLBACK),
      };
    });

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).resolves.toMatchObject({ verified: true });
    expect(flashloan.lastRequest.get()?.txid).toBe(REQUEST_TX);
  });

  it("loads pool, totals, constants (fee + cooldown), and recent loans from getPlatformStats", async () => {
    const { flashloan, read } = setup();

    await flashloan.loadData();

    expect(read).toHaveBeenCalledWith(
      "getPlatformStats",
      [],
      { cache: true, cacheTtlMs: 30000, scriptHash: MAIN_CONTRACT },
    );
    expect(flashloan.poolBalance.get()).toBe(12.5);
    expect(flashloan.stats.get()).toEqual({
      totalLoans: 2,
      totalVolume: 10,
      totalVolumeFixed8: "1000000000",
      totalFees: 0.009,
      totalFeesFixed8: "900000",
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
      if (operation === "isPaused") return false;
      return null;
    });

    await flashloan.loadData();
    expect(flashloan.contractStats.get().feeBasisPoints).toBe(15);
  });

  it("looks up a loan through getLoanDetails(loanId)", async () => {
    const { flashloan, read } = setup();

    await flashloan.lookupLoan("2");

    // The framework's readRaw forwards an (undefined) options slot positionally;
    // the operation + Integer arg are unchanged.
    expect(read).toHaveBeenCalledWith(
      "getLoanDetails",
      [{ type: "Integer", value: "2" }],
      undefined,
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
      app: makeApp(emptyChain),
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
      ],
      expect.objectContaining({
        waitForEvent: "LiquidityDeposited",
        waitTimeoutMs: 30000,
        onPaymentSent: expect.any(Function),
        onTransactionSent: expect.any(Function),
      }),
    );
  });

  it("binds a deposit event to the provider's lifetime totals before confirming", async () => {
    const { flashloan, invokeWithPayment } = setup({ network: "testnet" });
    const originalInvoke = invokeWithPayment.getMockImplementation()!;
    invokeWithPayment.mockImplementationOnce(async (...args: Parameters<typeof originalInvoke>) => {
      const result = await originalInvoke(...args);
      const event = result.event as { tx_hash: string; state: Array<{ value: unknown }> };
      return {
        ...result,
        event: {
          ...event,
          state: event.state.map((slot, index) => (
            index === 2 ? { value: "100000000" } : slot
          )),
        },
      };
    });

    await expect(flashloan.provideLiquidity("1")).rejects.toThrow("readbackMismatch");
    expect(flashloan.pendingLiquidityTxid.get()).toBe(DEPOSIT_TX);
  });

  it("persists an unconfirmed liquidity change and blocks duplicate funding", async () => {
    const { flashloan, app, invokeWithPayment } = setup({ network: "testnet" });
    invokeWithPayment.mockImplementation(async (...args: unknown[]) => {
      const options = args[4] as { onTransactionSent?: (txid: string) => void } | undefined;
      const txid = `0x${"f".repeat(64)}`;
      options?.onTransactionSent?.(txid);
      return { txid, success: true, verified: false };
    });
    vi.spyOn(app.chain, "waitForState").mockResolvedValue(null);

    await expect(flashloan.provideLiquidity("1")).rejects.toThrow("liquidityConfirmationPending");
    expect(flashloan.pendingLiquidityTxid.get()).toBe(`0x${"f".repeat(64)}`);
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);

    await expect(flashloan.provideLiquidity("1")).rejects.toThrow("liquidityConfirmationPending");
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
  });

  it("rejects over-precision liquidity deposits before wallet submission", async () => {
    const { flashloan, chain, invokeWithPayment } = setup({ network: "testnet" });

    await expect(
      flashloan.provideLiquidity("5.000000001"),
    ).rejects.toThrow("Enter a valid GAS amount");

    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(invokeWithPayment).not.toHaveBeenCalled();
  });

  it("requires a receipt id for liquidity deposits on mainnet", async () => {
    const { flashloan, invoke } = setup({ network: "mainnet", mainnetPaymentHub: true });

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
      expect.objectContaining({
        waitForEvent: "LiquidityDeposited",
        waitTimeoutMs: 30000,
        onTransactionSent: expect.any(Function),
      }),
    );
  });

  it("defaults a missing launch-network hint to mainnet and blocks its unconfigured PaymentHub", async () => {
    const { flashloan, invoke, invokeWithPayment } = setup();

    await expect(flashloan.provideLiquidity("1")).rejects.toThrow("paymentHubUnavailable");
    expect(invoke).not.toHaveBeenCalled();
    expect(invokeWithPayment).not.toHaveBeenCalled();
  });

  it("resumes a broadcast testnet prepayment without sending GAS twice", async () => {
    const { flashloan, invoke, invokeWithPayment } = setup({ network: "testnet" });
    invokeWithPayment.mockImplementationOnce(async (...args: unknown[]) => {
      const options = args[4] as { onPaymentSent?: (txid: string) => void };
      options.onPaymentSent?.(PAYMENT_TX);
      throw new Error("deposit call unavailable");
    });

    await expect(flashloan.provideLiquidity("1")).rejects.toThrow("liquidityResumeRequired");
    expect(flashloan.pendingLiquidityStage.get()).toBe("resume");
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);

    await flashloan.resumePendingLiquidity();
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(
      "deposit",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "100000000" },
      ],
      expect.objectContaining({
        waitForEvent: "LiquidityDeposited",
        onTransactionSent: expect.any(Function),
      }),
    );
    expect(flashloan.pendingLiquidityTxid.get()).toBe("");
  });

  it("recovers the deposit txid from a post-prepayment host error envelope", async () => {
    const { flashloan, invokeWithPayment } = setup({ network: "testnet" });
    invokeWithPayment.mockImplementationOnce(async () => {
      const error = new Error("deposit landed but consume failed") as Error & { depositTxid: string };
      error.depositTxid = PAYMENT_TX;
      throw error;
    });

    await expect(flashloan.provideLiquidity("1")).rejects.toThrow("liquidityResumeRequired");
    expect(flashloan.pendingLiquidityTxid.get()).toBe(PAYMENT_TX);
    expect(flashloan.pendingLiquidityStage.get()).toBe("resume");
  });

  it("locks the first prepayment when the host reports conflicting payment txids", async () => {
    const { flashloan, invokeWithPayment } = setup({ network: "testnet" });
    invokeWithPayment.mockImplementationOnce(async (...args: unknown[]) => {
      const options = args[4] as { onPaymentSent?: (txid: string) => void };
      options.onPaymentSent?.(PAYMENT_TX);
      options.onPaymentSent?.(OTHER_TX);
      throw new Error("conflicting payment callbacks");
    });

    await expect(flashloan.provideLiquidity("1")).rejects.toThrow("transactionIdMismatch");
    expect(flashloan.pendingLiquidityTxid.get()).toBe(PAYMENT_TX);
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
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
      expect.objectContaining({
        waitForEvent: "LiquidityWithdrawn",
        waitTimeoutMs: 30000,
        onTransactionSent: expect.any(Function),
      }),
    );
  });

  it("rejects malformed liquidity withdrawals before wallet submission", async () => {
    const { flashloan, chain, invoke } = setup();

    await expect(flashloan.withdrawLiquidity("2abc")).rejects.toThrow(
      "Enter a valid GAS amount",
    );

    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects a withdrawal above the confirmed provider balance", async () => {
    const { flashloan, invoke } = setup();

    await expect(flashloan.withdrawLiquidity("6")).rejects.toThrow("withdrawExceedsBalance");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("loads the connected provider's liquidity stats", async () => {
    const { flashloan } = setup();

    await flashloan.loadData();

    expect(flashloan.providerStats.get()).toEqual({
      currentBalance: 5,
      currentBalanceFixed8: "500000000",
      totalDeposited: 5,
      totalDepositedFixed8: "500000000",
      totalFeesEarned: 0.00012,
      totalFeesEarnedFixed8: "12000",
    });
  });

  it("clears stale wallet balances when an account-scoped refresh fails", async () => {
    const { flashloan, read } = setup();
    await flashloan.loadData();
    expect(flashloan.providerStats.get().currentBalance).toBe(5);
    const originalRead = read.getMockImplementation()!;
    read.mockImplementation(async (operation: string, args?: unknown[], options?: unknown) => {
      if (operation === "getProviderStatsDetails") throw new Error("account read unavailable");
      return originalRead(operation, args, options);
    });

    await flashloan.loadData();

    expect(flashloan.providerStats.get().currentBalanceFixed8).toBe("0");
    expect(flashloan.serviceNotice.get()).toBe("walletDataUnavailable");
  });

  it("does not let a slow prior-wallet read overwrite the active wallet", async () => {
    const { flashloan, chain, read } = setup();
    const originalRead = read.getMockImplementation()!;
    let markOldStarted!: () => void;
    let releaseOld!: () => void;
    const oldStarted = new Promise<void>((resolve) => { markOldStarted = resolve; });
    const oldGate = new Promise<void>((resolve) => { releaseOld = resolve; });
    read.mockImplementation(async (operation: string, args?: unknown[], options?: unknown) => {
      if (operation === "getProviderStatsDetails") {
        const provider = String((args?.[0] as { value?: unknown })?.value ?? "");
        if (provider === OWNER) {
          markOldStarted();
          await oldGate;
          return {
            currentBalance: "100000000",
            totalDeposited: "100000000",
            totalWithdrawn: "0",
            totalFeesEarned: "0",
          };
        }
        if (provider === OTHER_OWNER) {
          return {
            currentBalance: "900000000",
            totalDeposited: "900000000",
            totalWithdrawn: "0",
            totalFeesEarned: "0",
          };
        }
      }
      return originalRead(operation, args, options);
    });

    const olderLoad = flashloan.loadData();
    await oldStarted;
    chain.address.set(OTHER_OWNER);
    flashloan.setAddress(OTHER_OWNER);
    await flashloan.loadData();
    releaseOld();
    await olderLoad;

    expect(flashloan.providerStats.get().currentBalanceFixed8).toBe("900000000");
    expect(flashloan.providerStats.get().currentBalance).toBe(9);
  });

  it("keeps only the newest loan lookup when reads finish out of order", async () => {
    const { flashloan, read } = setup();
    const originalRead = read.getMockImplementation()!;
    let markFirstStarted!: () => void;
    let releaseFirst!: () => void;
    const firstStarted = new Promise<void>((resolve) => { markFirstStarted = resolve; });
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    read.mockImplementation(async (operation: string, args?: unknown[], options?: unknown) => {
      if (operation === "getLoanDetails") {
        const id = Number((args?.[0] as { value?: unknown })?.value ?? 0);
        if (id === 1) {
          markFirstStarted();
          await firstGate;
          throw new Error("stale lookup failure");
        }
      }
      return originalRead(operation, args, options);
    });

    const firstLookup = flashloan.lookupLoan("1");
    await firstStarted;
    await flashloan.lookupLoan("2");
    releaseFirst();
    await firstLookup;

    expect(flashloan.loanDetails.get()?.id).toBe("2");
    expect(flashloan.isLookupLoading.get()).toBe(false);
  });

  it("blocks writes when the wallet-detected network differs from the launch network", async () => {
    const { flashloan, chain, invoke } = setup({ network: "testnet" });
    chain.detectNetwork.mockResolvedValue("mainnet");

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("chainContextMismatch");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rechecks the network and contract after the wallet prompt", async () => {
    const { flashloan, chain, invoke } = setup({ network: "testnet" });
    chain.detectNetwork
      .mockResolvedValueOnce("testnet")
      .mockResolvedValueOnce("mainnet");

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("chainContextMismatch");

    expect(chain.ensureWallet).toHaveBeenCalledTimes(1);
    expect(chain.detectNetwork).toHaveBeenCalledTimes(2);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects a wallet identity change between review and invocation", async () => {
    const { flashloan, chain, invoke } = setup({ network: "testnet" });
    chain.ensureWallet.mockResolvedValueOnce(OTHER_OWNER);

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("walletContextChanged");

    expect(chain.ensureWallet).toHaveBeenCalledTimes(1);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not open the wallet when durable recovery storage cannot round-trip", async () => {
    const { flashloan, app, chain, invoke } = setup({ network: "testnet" });
    vi.spyOn(app.storage.local, "set").mockImplementation(() => {});

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("recoveryStorageUnavailable");
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("also verifies recovery-probe deletion before opening the wallet", async () => {
    const { flashloan, app, chain, invoke } = setup({ network: "testnet" });
    vi.spyOn(app.storage.local, "delete").mockImplementation(() => undefined);

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("recoveryStorageUnavailable");
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("serializes wallet connection with every financial action", async () => {
    const { flashloan, chain, invoke } = setup({ network: "testnet" });
    let finishConnect: ((address: string) => void) | undefined;
    chain.ensureWallet.mockImplementationOnce(() => new Promise<string>((resolve) => {
      finishConnect = resolve;
    }));

    const connect = flashloan.connect();
    await vi.waitFor(() => expect(chain.ensureWallet).toHaveBeenCalledTimes(1));
    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("actionInProgress");
    expect(invoke).not.toHaveBeenCalled();

    finishConnect?.(OWNER);
    await expect(connect).resolves.toBe(OWNER);
  });

  it("clears an atomic loan pending lock only after the exact tx is proven FAULT", async () => {
    const { flashloan, invoke, transactionOutcomeReader } = setup({
      network: "testnet",
      transactionOutcome: { state: "fault", event: null },
    });
    invoke.mockImplementationOnce(async (_operation, _args, rawOptions) => {
      const options = rawOptions as { onTransactionSent?: (txid: string) => void };
      options.onTransactionSent?.(REQUEST_TX);
      return { txid: REQUEST_TX, success: false, verified: false };
    });

    await expect(flashloan.requestLoan({
      amount: "1",
      callbackContract: CALLBACK,
      callbackMethod: "execute",
    })).rejects.toThrow("loanTransactionFault");
    expect(transactionOutcomeReader).toHaveBeenCalledWith(
      "testnet",
      REQUEST_TX,
      "LoanExecuted",
      CONTRACT,
    );
    expect(flashloan.pendingRequestTxid.get()).toBe("");
  });

  it("keeps an unverified prepayment locked and never sends GAS twice", async () => {
    const { flashloan, invokeWithPayment, paymentOutcomeReader } = setup({
      network: "testnet",
      paymentOutcome: { state: "unknown", event: null },
    });
    invokeWithPayment.mockImplementationOnce(async (...args: unknown[]) => {
      const options = args[4] as { onPaymentSent?: (txid: string) => void };
      options.onPaymentSent?.(PAYMENT_TX);
      throw new Error("consume unavailable");
    });

    await expect(flashloan.provideLiquidity("1")).rejects.toThrow("liquidityPaymentPending");
    expect(flashloan.pendingLiquidityStage.get()).toBe("payment-pending");
    await expect(flashloan.provideLiquidity("1")).rejects.toThrow("liquidityConfirmationPending");
    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
    expect(paymentOutcomeReader).toHaveBeenCalled();
  });

  it("keeps large liquidity amounts exact as Fixed8 strings without Number coercion", async () => {
    const { flashloan, platformStats, invokeWithPayment } = setup({ network: "testnet" });
    platformStats.poolBalance = "9999999999999999";

    await flashloan.provideLiquidity("90071992.54740991");
    expect(invokeWithPayment).toHaveBeenCalledWith(
      "9007199254740991",
      "miniapp-flashloan:deposit",
      "deposit",
      expect.any(Array),
      expect.any(Object),
    );
  });

  it("rejects a partially numeric lookup id instead of coercing it", async () => {
    const { flashloan, read } = setup();
    await expect(flashloan.lookupLoan("1abc")).rejects.toThrow("Invalid loan ID");
    expect(read).not.toHaveBeenCalledWith("getLoanDetails", expect.anything(), expect.anything());
  });

  it("rejects malformed loan booleans instead of displaying a believable pending state", async () => {
    const { flashloan, read } = setup();
    const originalRead = read.getMockImplementation()!;
    read.mockImplementation(async (operation: string, args?: unknown[]) => {
      if (operation === "getLoanDetails") {
        return { ...loanDetailsFor(2), executed: "unknown" };
      }
      return originalRead(operation, args);
    });

    await expect(flashloan.lookupLoan("2")).rejects.toThrow("Invalid loan executed chain value");
  });
});

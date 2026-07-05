/**
 * useFlashloanCore — Domain logic for the Flash Loan miniapp.
 *
 * Wired against the DEPLOYED MiniAppFlashLoan contract (verified live on both
 * networks, mainnet 0xb5d8fb0d / testnet 0xde8e595d). Its ABI is appId-free:
 *   - requestLoan(borrower, amount, callbackContract, callbackMethod) -> Integer
 *   - getLoanDetails(loanId) -> Map   /   getLoan(loanId) -> Array
 *   - getPlatformStats() -> Map  (totalLoans/totalBorrowed/totalFees/poolBalance/
 *     minLoan/maxLoan/feeBasisPoints/loanCooldownSeconds/maxDailyLoans/...)
 *   - getPoolBalance() -> Integer  /  getFlashLoanConstants() -> Map
 *   - getBorrowerEligibility(borrower) -> Map (cooldownRemaining/dailyLoansRemaining)
 *   - deposit(depositor, amount, receiptId)  /  withdraw(provider, amount)
 *   - getProviderStatsDetails(provider) -> Map
 *
 * The contract is frozen; this module adapts to it. A read failure raises a
 * serviceNotice and preserves the last good snapshot rather than presenting
 * fabricated zeros as fact.
 */

import { createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { ContractArg } from "@shared/services/ChainService";
import type { MiniAppLaunchNetwork } from "@shared/utils/launch-params";
import {
  formatAddress,
  formatGas,
  fromFixed8,
  parsePositiveFixed8,
  toSafeNumber,
} from "@shared/utils/format";
import { addressToScriptHash } from "@shared/utils/neo";

const APP_ID = "miniapp-flashloan";
const CALLBACK_METHOD = "onFlashLoan";
const FLASH_FEE_BPS = 9;
const DEPOSIT_MEMO = `${APP_ID}:deposit`;
const DEFAULT_CONTRACT_STATS = {
  minLoan: 1,
  maxLoan: 100_000,
  feeBasisPoints: FLASH_FEE_BPS,
  cooldownMs: 300_000,
  maxDailyLoans: 10,
  // Percent of each loan fee paid to liquidity providers (the rest is protocol
  // revenue). Read from the contract; default mirrors the deployed constant.
  providerFeeShare: 80,
};

type LoanStatus = "pending" | "success" | "failed";

type LoanDetails = {
  id: string;
  borrower: string;
  amount: string;
  fee: string;
  callbackContract: string;
  callbackMethod: string;
  timestamp: string;
  status: LoanStatus;
};

type ExecutedLoan = {
  id: number;
  amount: number;
  fee: number;
  status: "success" | "failed";
  timestamp: string;
};

type FlashContractStats = typeof DEFAULT_CONTRACT_STATS;

type FlashLoanRequestResult = {
  txid: string;
  amount: string;
  fee: string;
  borrower: string;
  callbackContract: string;
  callbackMethod: string;
};

type ProviderStats = {
  currentBalance: number;
  totalDeposited: number;
  totalFeesEarned: number;
};

const EMPTY_PROVIDER_STATS: ProviderStats = {
  currentBalance: 0,
  totalDeposited: 0,
  totalFeesEarned: 0,
};

export interface UseFlashloanCoreOptions {
  /** MiniApp framework SDK from ctx.framework (chain reads/invokes + arg builders) */
  app: MiniAppFramework;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Launch network (mainnet requires an explicit deposit receipt id) */
  network?: MiniAppLaunchNetwork | null;
}

export function useFlashloanCore({
  app,
  badgeService,
  t,
  network,
}: UseFlashloanCoreOptions) {
  const poolBalance = createObservable(0);
  const loanDetails = createObservable<LoanDetails | null>(null);
  const stats = createObservable({ totalLoans: 0, totalVolume: 0, totalFees: 0 });
  const contractStats = createObservable<FlashContractStats>(DEFAULT_CONTRACT_STATS);
  const recentLoans = createObservable<ExecutedLoan[]>([]);
  const lastRequest = createObservable<FlashLoanRequestResult | null>(null);
  const providerStats = createObservable<ProviderStats>(EMPTY_PROVIDER_STATS);
  const isLoading = createObservable(false);
  const validationError = createObservable<string | null>(null);
  const serviceNotice = createObservable("");
  const address = createObservable("");

  const isMainnet = network === "mainnet";

  // -- Helpers --------------------------------------------------------------

  const toNumber = toSafeNumber;

  const normalizeHash160Input = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const withoutPrefix = trimmed.replace(/^0x/i, "");
    if (/^[0-9a-fA-F]{40}$/.test(withoutPrefix)) {
      return `0x${withoutPrefix.toLowerCase()}`;
    }
    return addressToScriptHash(trimmed);
  };

  const fixed8ToDisplay = (value: unknown, decimals = 4) => formatGas(String(value ?? "0"), decimals);

  const fixed8ToDecimal = (value: unknown) => fromFixed8(String(value ?? "0"));

  const estimateFeeFixed8 = (amount: string) => {
    const raw = BigInt(parsePositiveFixed8(amount) ?? "0");
    return ((raw * BigInt(FLASH_FEE_BPS)) / 10_000n).toString();
  };

  // GAS→base-unit scaling stays on parsePositiveFixed8 (NOT app.amount.gasToFixed8):
  // it returns null on invalid/over-precision input, which the null-based
  // validators (validateLoanRequest / validateLiquidityAmount) depend on to
  // surface localized t(...) messages. The framework helper throws a different,
  // non-localized message, so swapping would change the observable validation
  // semantics. The scaler is ×1e8, identical to gasToFixed8.
  const parseGasAmountFixed8 = (amount: string): string | null =>
    parsePositiveFixed8(amount);

  const formatTimestamp = (value: unknown) => {
    const ts = toNumber(value);
    if (!ts) return t("notAvailable");
    const ms = ts > 1_000_000_000_000 ? ts : ts * 1000;
    return new Intl.DateTimeFormat(undefined).format(new Date(ms));
  };

  const asRecord = (value: unknown): Record<string, unknown> => {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  };

  // The deployed contract exposes both getLoanDetails (Map) and getLoan (Array).
  // We read the Map form (named fields) for clarity, but stay tolerant of an
  // Array payload so a legacy node response still parses.
  const normalizeLoanPayload = (raw: unknown): Record<string, unknown> => {
    if (Array.isArray(raw)) {
      return {
        borrower: raw[0],
        amount: raw[1],
        fee: raw[2],
        callbackContract: raw[3],
        callbackMethod: raw[4],
        timestamp: raw[5],
        executed: raw[6],
        success: raw[7],
      };
    }
    return asRecord(raw);
  };

  const buildLoanDetails = (raw: unknown, loanId: number): LoanDetails | null => {
    const parsed = normalizeLoanPayload(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const borrower = String(parsed.borrower || "");
    const amount = String(parsed.amount || "0");
    const fee = String(parsed.fee || "0");
    const callbackContract = String(parsed.callbackContract || "");
    const callbackMethod = String(parsed.callbackMethod || "");
    const timestamp = toNumber(parsed.timestamp);
    const executed = Boolean(parsed.executed);
    const success = Boolean(parsed.success);

    const isEmpty = toNumber(amount) === 0 && toNumber(fee) === 0 && !callbackMethod && !timestamp;
    if (isEmpty) return null;

    const statusValue: LoanStatus = executed ? (success ? "success" : "failed") : "pending";

    return {
      id: String(loanId),
      borrower: formatAddress(borrower) || t("notAvailable"),
      amount: fixed8ToDisplay(amount),
      fee: fixed8ToDisplay(fee),
      callbackContract: formatAddress(callbackContract) || t("notAvailable"),
      callbackMethod: callbackMethod || t("notAvailable"),
      timestamp: formatTimestamp(timestamp),
      status: statusValue,
    };
  };

  const validateLoanId = (id: string): string | null => {
    const num = parseInt(id, 10);
    if (isNaN(num) || num <= 0) {
      return t("invalidLoanId");
    }
    return null;
  };

  const validateLoanRequest = (data: {
    amount: string;
    callbackContract: string;
    callbackMethod: string;
  }): string | null => {
    const amountFixed8 = parseGasAmountFixed8(data.amount);
    if (!amountFixed8) {
      return t("invalidLoanAmount");
    }
    const amountNum = fromFixed8(amountFixed8);
    const { minLoan, maxLoan } = contractStats.get();
    if (amountNum < minLoan) {
      return t("loanAmountBelowMin", { min: minLoan.toLocaleString() });
    }
    if (amountNum > maxLoan) {
      return t("loanAmountAboveMax", { max: maxLoan.toLocaleString() });
    }
    if (!data.callbackContract || data.callbackContract.trim().length < 34) {
      return t("invalidCallbackContract");
    }
    if (!normalizeHash160Input(data.callbackContract)) {
      return t("invalidCallbackContract");
    }
    if (data.callbackMethod !== CALLBACK_METHOD) {
      return t("invalidCallbackMethod");
    }
    return null;
  };

  const validateLiquidityAmount = (amount: string): string | null => {
    if (!parseGasAmountFixed8(amount)) {
      return t("invalidLiquidityAmount");
    }
    return null;
  };

  const loanArgs = (loanId: number): ContractArg[] => [
    app.chain.arg.integer(loanId) as ContractArg,
  ];

  // -- Data loading (via FlashLoan contract) --------------------------------

  const applyPlatformStats = (rawStats: Record<string, unknown>) => {
    const totalLoans = toNumber(rawStats.totalLoans);
    const totalVolume = fixed8ToDecimal(rawStats.totalBorrowed);
    const totalFees = fixed8ToDecimal(rawStats.totalFees);
    const pool = fixed8ToDecimal(rawStats.poolBalance);

    poolBalance.set(pool);
    stats.set({ totalLoans, totalVolume, totalFees });
    contractStats.set({
      minLoan: fixed8ToDecimal(rawStats.minLoan) || DEFAULT_CONTRACT_STATS.minLoan,
      maxLoan: fixed8ToDecimal(rawStats.maxLoan) || DEFAULT_CONTRACT_STATS.maxLoan,
      // getPlatformStats uses feeBasisPoints; getFlashLoanConstants uses
      // feesBasisPoints. Accept either so the source of the fee is the chain.
      feeBasisPoints:
        toNumber(rawStats.feeBasisPoints ?? rawStats.feesBasisPoints) ||
        DEFAULT_CONTRACT_STATS.feeBasisPoints,
      // The deployed contract reports loanCooldownSeconds (seconds), not a
      // cooldownMs field. Convert to ms for the UI.
      cooldownMs:
        toNumber(rawStats.loanCooldownSeconds) * 1000 || DEFAULT_CONTRACT_STATS.cooldownMs,
      maxDailyLoans: toNumber(rawStats.maxDailyLoans) || DEFAULT_CONTRACT_STATS.maxDailyLoans,
      // providerFeeShare is a percent (0-100); 0 would be a non-sensical read,
      // so fall back to the deployed default when the field is absent/zero.
      providerFeeShare:
        toNumber(rawStats.providerFeeShare) || DEFAULT_CONTRACT_STATS.providerFeeShare,
    });

    return totalLoans;
  };

  const loadRecentLoans = async (totalLoans: number) => {
    const start = Math.max(1, totalLoans - 4);
    const ids: number[] = [];
    for (let id = totalLoans; id >= start; id -= 1) ids.push(id);

    const entries = await Promise.all(
      ids.map(async (id) =>
        buildLoanDetails(
          await app.chain.readRaw("getLoanDetails", loanArgs(id), {
            cache: true,
            cacheTtlMs: 30_000,
          }),
          id,
        ),
      ),
    );

    const loans: ExecutedLoan[] = [];
    ids.forEach((id, index) => {
      const entry = entries[index];
      if (!entry) return;
      loans.push({
        id,
        amount: Number.parseFloat(entry.amount) || 0,
        fee: Number.parseFloat(entry.fee) || 0,
        status: entry.status === "failed" ? "failed" : "success",
        timestamp: entry.timestamp,
      });
    });
    recentLoans.set(loans);
  };

  const loadLoanStats = async () => {
    const rawStats = asRecord(
      await app.chain.readRaw("getPlatformStats", [], {
        cache: true,
        cacheTtlMs: 30_000,
      }),
    );

    const totalLoans = applyPlatformStats(rawStats);
    await loadRecentLoans(totalLoans);
  };

  const loadProviderStats = async () => {
    const addr = address.get();
    if (!addr) {
      providerStats.set(EMPTY_PROVIDER_STATS);
      return;
    }
    const providerHash = normalizeHash160Input(addr);
    if (!providerHash) {
      providerStats.set(EMPTY_PROVIDER_STATS);
      return;
    }
    const raw = asRecord(
      await app.chain.readRaw("getProviderStatsDetails", [app.chain.arg.hash160(providerHash)], {
        cache: true,
        cacheTtlMs: 30_000,
      }),
    );
    providerStats.set({
      currentBalance: fixed8ToDecimal(raw.currentBalance),
      totalDeposited: fixed8ToDecimal(raw.totalDeposited),
      totalFeesEarned: fixed8ToDecimal(raw.totalFeesEarned),
    });
  };

  const loadData = async () => {
    try {
      await loadLoanStats();
      // Provider stats are wallet-scoped and best-effort; a failure here must
      // not blank the pool/stats hero.
      await loadProviderStats().catch(() => {});
      serviceNotice.set("");
    } catch (e) {
      // Preserve the last good snapshot — never present zeros as fact.
      console.warn(
        "[useFlashloanCore] loadData failed:",
        e instanceof Error ? e.message : String(e),
      );
      serviceNotice.set(t("statsUnavailable"));
    }
  };

  // -- Actions (via FlashLoan contract) -------------------------------------

  /**
   * Look up a loan by ID through getLoanDetails(loanId).
   */
  const lookupLoan = async (loanIdValue: string) => {
    const validation = validateLoanId(loanIdValue);
    if (validation) {
      validationError.set(validation);
      throw new Error(validation);
    }
    validationError.set(null);

    const loanId = Number(loanIdValue);
    isLoading.set(true);

    try {
      const parsed = await app.chain.readRaw("getLoanDetails", loanArgs(loanId));
      const details = buildLoanDetails(parsed, loanId);
      if (!details) {
        loanDetails.set(null);
        throw new Error(t("loanNotFound"));
      }

      loanDetails.set(details);
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Request a flash loan through
   * requestLoan(borrower, amount, callbackContract, "onFlashLoan").
   */
  const requestLoan = async (data: { amount: string; callbackContract: string; callbackMethod: string }) => {
    const validation = validateLoanRequest(data);
    if (validation) {
      validationError.set(validation);
      throw new Error(validation);
    }
    validationError.set(null);

    isLoading.set(true);

    try {
      const borrower = await app.chain.ensureWallet();
      const callbackContract = normalizeHash160Input(data.callbackContract);
      const amountFixed8 = parseGasAmountFixed8(data.amount);
      if (!amountFixed8) throw new Error(t("invalidLoanAmount"));
      const feeFixed8 = estimateFeeFixed8(data.amount);
      address.set(borrower);

      // borrower comes straight from ensureWallet() and is passed as a Hash160
      // value without conversion (unlike callbackContract, which is normalized
      // via normalizeHash160Input); keep it raw so the on-chain value is byte-
      // identical. callbackContract is already a normalized script hash, so the
      // arg builder returns it unchanged.
      const result = await app.chain.invoke(
        "requestLoan",
        [
          { type: "Hash160", value: borrower },
          app.chain.arg.integer(amountFixed8),
          app.chain.arg.hash160(callbackContract),
          app.chain.arg.string(CALLBACK_METHOD),
        ],
        { waitForEvent: "LoanExecuted", waitTimeoutMs: 30_000 },
      );

      lastRequest.set({
        txid: result.txid,
        amount: fixed8ToDisplay(amountFixed8),
        fee: fixed8ToDisplay(feeFixed8),
        borrower: formatAddress(borrower),
        callbackContract: formatAddress(callbackContract),
        callbackMethod: CALLBACK_METHOD,
      });

      // Award first-loan badge (fire-and-forget)
      if (stats.get().totalLoans === 0) {
        badgeService.award("first-flashloan", borrower).catch(() => {});
      }

      await loadData();
      return result;
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Provide liquidity to the pool via deposit(depositor, amount, receiptId).
   *
   * On testnet the GAS is bundled with the call through invokeWithPayment (the
   * memo creates the credit the contract consumes). On mainnet the host wallet
   * cannot bundle a settled prepaid transfer, so the caller pre-transfers GAS
   * with the deposit memo and supplies the resulting receipt id.
   */
  const provideLiquidity = async (amount: string, receiptId?: string) => {
    const validation = validateLiquidityAmount(amount);
    if (validation) {
      validationError.set(validation);
      throw new Error(validation);
    }
    validationError.set(null);

    isLoading.set(true);
    try {
      const provider = await app.chain.ensureWallet();
      address.set(provider);
      const amountFixed8 = parseGasAmountFixed8(amount);
      if (!amountFixed8) throw new Error(t("invalidLiquidityAmount"));

      let result: Awaited<ReturnType<typeof app.chain.invoke>>;
      if (isMainnet) {
        const normalizedReceiptId = String(receiptId ?? "").trim();
        if (!/^[1-9]\d*$/.test(normalizedReceiptId)) {
          throw new Error(t("receiptIdRequired"));
        }
        result = await app.chain.invoke(
          "deposit",
          [
            { type: "Hash160", value: provider },
            app.chain.arg.integer(amountFixed8),
            app.chain.arg.integer(normalizedReceiptId),
          ],
          { waitForEvent: "LiquidityDeposited", waitTimeoutMs: 30_000 },
        );
      } else {
        result = await app.chain.invokeWithPayment(
          amountFixed8,
          DEPOSIT_MEMO,
          "deposit",
          [
            { type: "Hash160", value: provider },
            app.chain.arg.integer(amountFixed8),
            app.chain.arg.integer("0"),
          ],
          { waitForEvent: "LiquidityDeposited", waitTimeoutMs: 30_000 },
        );
      }

      await loadData();
      return result;
    } finally {
      isLoading.set(false);
    }
  };

  /**
   * Withdraw previously deposited liquidity via withdraw(provider, amount).
   * A provider can only withdraw up to what they deposited (enforced on-chain).
   */
  const withdrawLiquidity = async (amount: string) => {
    const validation = validateLiquidityAmount(amount);
    if (validation) {
      validationError.set(validation);
      throw new Error(validation);
    }
    validationError.set(null);

    isLoading.set(true);
    try {
      const provider = await app.chain.ensureWallet();
      address.set(provider);
      const amountFixed8 = parseGasAmountFixed8(amount);
      if (!amountFixed8) throw new Error(t("invalidLiquidityAmount"));

      const result = await app.chain.invoke(
        "withdraw",
        [
          { type: "Hash160", value: provider },
          app.chain.arg.integer(amountFixed8),
        ],
        { waitForEvent: "LiquidityWithdrawn", waitTimeoutMs: 30_000 },
      );

      await loadData();
      return result;
    } finally {
      isLoading.set(false);
    }
  };

  return {
    // State
    address,
    poolBalance,
    loanDetails,
    stats,
    contractStats,
    recentLoans,
    lastRequest,
    providerStats,
    isLoading,
    validationError,
    serviceNotice,

    // Methods
    connect: async () => {
      const connected = await app.chain.ensureWallet();
      address.set(connected);
      return connected;
    },
    loadData,
    lookupLoan,
    requestLoan,
    provideLiquidity,
    withdrawLiquidity,

    /**
     * Set the wallet address. Called from main.ts to track the
     * connected wallet address from the platform's chain service.
     */
    setAddress: (addr: string) => { address.set(addr); },
  };
}

export type UseFlashloanCoreReturn = ReturnType<typeof useFlashloanCore>;

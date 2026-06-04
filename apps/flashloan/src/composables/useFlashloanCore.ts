/**
 * useFlashloanCore — Domain logic for the Flash Loan miniapp.
 *
 * The flash-loan contract owns pool state, loan lookup, stats, and atomic
 * request execution. Storage services are only for secondary indexing and must
 * not be used as the primary submit path.
 */

import { createObservable } from "@shared/react/context";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { formatAddress, formatGas, fromFixed8, toFixed8, toSafeNumber } from "@shared/utils/format";
import { addressToScriptHash } from "@shared/utils/neo";

const APP_ID = "miniapp-flashloan";
const CALLBACK_METHOD = "onFlashLoan";
const FLASH_FEE_BPS = 9;
const DEFAULT_CONTRACT_STATS = {
  minLoan: 1,
  maxLoan: 100_000,
  feeBasisPoints: FLASH_FEE_BPS,
  cooldownMs: 300_000,
  maxDailyLoans: 10,
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

export interface UseFlashloanCoreOptions {
  /** Shared chain service for contract reads and wallet invocations */
  chainService: ChainService;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useFlashloanCore({
  chainService,
  badgeService,
  t,
}: UseFlashloanCoreOptions) {
  const poolBalance = createObservable(0);
  const loanDetails = createObservable<LoanDetails | null>(null);
  const stats = createObservable({ totalLoans: 0, totalVolume: 0, totalFees: 0 });
  const contractStats = createObservable<FlashContractStats>(DEFAULT_CONTRACT_STATS);
  const recentLoans = createObservable<ExecutedLoan[]>([]);
  const lastRequest = createObservable<FlashLoanRequestResult | null>(null);
  const isLoading = createObservable(false);
  const validationError = createObservable<string | null>(null);
  const address = createObservable("");

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
    const raw = BigInt(toFixed8(amount) || "0");
    return ((raw * BigInt(FLASH_FEE_BPS)) / 10_000n).toString();
  };

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
    const amountNum = parseFloat(data.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return t("invalidLoanAmount");
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

  const statsArgs = (): ContractArg[] => [
    { type: "String", value: APP_ID },
  ];

  const loanArgs = (loanId: number): ContractArg[] => [
    { type: "String", value: APP_ID },
    { type: "Integer", value: String(loanId) },
  ];

  // -- Data loading (via FlashLoan contract) --------------------------------

  const loadLoanStats = async () => {
    try {
      const rawStats = asRecord(
        await chainService.read("getFlashLoanStats", statsArgs(), {
          cache: true,
          cacheTtlMs: 30_000,
        }),
      );

      const totalLoans = toNumber(rawStats.totalLoans);
      const totalVolume = fixed8ToDecimal(rawStats.totalBorrowed);
      const totalFees = fixed8ToDecimal(rawStats.totalFees);
      const pool = fixed8ToDecimal(rawStats.poolBalance);

      poolBalance.set(pool);
      stats.set({ totalLoans, totalVolume, totalFees });
      contractStats.set({
        minLoan: fixed8ToDecimal(rawStats.minLoan) || DEFAULT_CONTRACT_STATS.minLoan,
        maxLoan: fixed8ToDecimal(rawStats.maxLoan) || DEFAULT_CONTRACT_STATS.maxLoan,
        feeBasisPoints: toNumber(rawStats.feeBasisPoints) || DEFAULT_CONTRACT_STATS.feeBasisPoints,
        cooldownMs: toNumber(rawStats.cooldownMs) || DEFAULT_CONTRACT_STATS.cooldownMs,
        maxDailyLoans: toNumber(rawStats.maxDailyLoans) || DEFAULT_CONTRACT_STATS.maxDailyLoans,
      });

      const loans: ExecutedLoan[] = [];
      const start = Math.max(1, totalLoans - 4);
      for (let id = totalLoans; id >= start; id -= 1) {
        const entry = buildLoanDetails(
          await chainService.read("getFlashLoan", loanArgs(id), {
            cache: true,
            cacheTtlMs: 30_000,
          }),
          id,
        );
        if (!entry) continue;
        loans.push({
          id,
          amount: Number.parseFloat(entry.amount) || 0,
          fee: Number.parseFloat(entry.fee) || 0,
          status: entry.status === "failed" ? "failed" : "success",
          timestamp: entry.timestamp,
        });
      }
      recentLoans.set(loans);
    } catch (e) {
      console.warn("[useFlashloanCore] loadLoanStats failed:", e instanceof Error ? e.message : String(e));
      stats.set({ totalLoans: 0, totalVolume: 0, totalFees: 0 });
      contractStats.set(DEFAULT_CONTRACT_STATS);
      poolBalance.set(0);
      recentLoans.set([]);
    }
  };

  const loadData = async () => {
    try {
      await loadLoanStats();
    } catch (e) {
      console.warn("[useFlashloanCore] loadData failed:", e instanceof Error ? e.message : String(e));
    }
  };

  // -- Actions (via FlashLoan contract) -------------------------------------

  /**
   * Look up a loan by ID through getFlashLoan(appId, loanId).
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
      const parsed = await chainService.read("getFlashLoan", loanArgs(loanId));
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
   * Request a flash loan through requestFlashLoan(appId, borrower, amount,
   * callbackContract, "onFlashLoan").
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
      const borrower = await chainService.ensureWallet();
      const callbackContract = normalizeHash160Input(data.callbackContract);
      const amountFixed8 = toFixed8(data.amount);
      const feeFixed8 = estimateFeeFixed8(data.amount);
      address.set(borrower);

      const result: TxResult = await chainService.invoke(
        "requestFlashLoan",
        [
          { type: "String", value: APP_ID },
          { type: "Hash160", value: borrower },
          { type: "Integer", value: amountFixed8 },
          { type: "Hash160", value: callbackContract },
          { type: "String", value: CALLBACK_METHOD },
        ],
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

  return {
    // State
    address,
    poolBalance,
    loanDetails,
    stats,
    contractStats,
    recentLoans,
    lastRequest,
    isLoading,
    validationError,

    // Methods
    connect: async () => {
      const connected = await chainService.ensureWallet();
      address.set(connected);
      return connected;
    },
    loadData,
    lookupLoan,
    requestLoan,

    /**
     * Set the wallet address. Called from main.ts to track the
     * connected wallet address from the platform's chain service.
     */
    setAddress: (addr: string) => { address.set(addr); },
  };
}

export type UseFlashloanCoreReturn = ReturnType<typeof useFlashloanCore>;

/**
 * useFlashloanCore — Domain logic for the Flash Loan miniapp (OS Services)
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (PaymentProxy, StorageProxy, BadgeProxy) via edge functions,
 * so this file contains zero contract hashes, parameter encoding, or
 * event parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("getPoolBalance")
 *     chain.read("getLoan", [...])
 *     chain.invoke("requestLoan", [...])
 *     chain.listAllEvents("LoanExecuted")
 *
 *   AFTER (OS proxy):
 *     paymentService.getBalance()                 — pool balance
 *     storageService.get(`loan:${id}`)            — loan details
 *     storageService.list("loan:")                — loan history/stats
 *     paymentService.deposit(amount, memo)        — request loan
 *     badgeService.award(badgeId, user)           — achievement tracking
 */

import { ref } from "vue";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { formatNumber, formatAddress, formatGas, toFixed8, toSafeNumber } from "@shared/utils/format";

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

export interface UseFlashloanCoreOptions {
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useFlashloanCore({
  paymentService,
  storageService,
  badgeService,
  t,
}: UseFlashloanCoreOptions) {
  const poolBalance = ref(0);
  const loanDetails = ref<LoanDetails | null>(null);
  const stats = ref({ totalLoans: 0, totalVolume: 0, totalFees: 0 });
  const recentLoans = ref<ExecutedLoan[]>([]);
  const isLoading = ref(false);
  const validationError = ref<string | null>(null);
  const address = ref("");

  // -- Helpers --------------------------------------------------------------

  const toNumber = toSafeNumber;

  const formatTimestamp = (value: unknown) => {
    const ts = toNumber(value);
    if (!ts) return t("notAvailable");
    return new Intl.DateTimeFormat(undefined).format(new Date(ts * 1000));
  };

  const buildLoanDetails = (parsed: Record<string, unknown>, loanId: number): LoanDetails | null => {
    if (!parsed || typeof parsed !== "object") return null;

    const borrower = String(parsed.borrower || "");
    const amount = toNumber(parsed.amount);
    const fee = toNumber(parsed.fee);
    const callbackContract = String(parsed.callbackContract || "");
    const callbackMethod = String(parsed.callbackMethod || "");
    const timestamp = toNumber(parsed.timestamp);
    const executed = Boolean(parsed.executed);
    const success = Boolean(parsed.success);

    const isEmpty = amount === 0 && fee === 0 && !callbackMethod && !timestamp;
    if (isEmpty) return null;

    const statusValue: LoanStatus = executed ? (success ? "success" : "failed") : "pending";

    return {
      id: String(loanId),
      borrower: formatAddress(borrower) || t("notAvailable"),
      amount: formatGas(amount),
      fee: formatGas(fee),
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
    if (!data.callbackMethod || data.callbackMethod.trim().length === 0) {
      return t("invalidCallbackMethod");
    }
    return null;
  };

  // -- Data loading (via OS services) ---------------------------------------

  /**
   * Load pool balance via PaymentProxy.
   * The edge function handles the getPoolBalance contract read.
   */
  const loadPoolBalance = async () => {
    try {
      const result = await paymentService.getBalance();
      poolBalance.value = toNumber(result);
    } catch (e) {
      console.warn("[useFlashloanCore] loadPoolBalance failed:", e instanceof Error ? e.message : String(e));
      poolBalance.value = 0;
    }
  };

  /**
   * Load loan stats and recent loans via StorageProxy.
   * The edge function aggregates LoanExecuted events into storage entries.
   */
  const loadLoanStats = async () => {
    try {
      const raw = await storageService.list("loan:");
      if (!raw || typeof raw !== "object") {
        stats.value = { totalLoans: 0, totalVolume: 0, totalFees: 0 };
        recentLoans.value = [];
        return;
      }

      const loans: ExecutedLoan[] = [];
      for (const [, value] of Object.entries(raw)) {
        if (!value || typeof value !== "object") continue;
        const entry = value as Record<string, unknown>;
        const id = Number(entry.id || 0);
        if (!id) continue;
        loans.push({
          id,
          amount: toNumber(entry.amount),
          fee: toNumber(entry.fee),
          status: Boolean(entry.success) ? "success" : "failed",
          timestamp: String(entry.timestamp || ""),
        });
      }

      const totalVolume = loans.reduce((sum, loan) => sum + loan.amount, 0);
      const totalFees = loans.reduce((sum, loan) => sum + loan.fee, 0);

      stats.value = {
        totalLoans: loans.length,
        totalVolume,
        totalFees,
      };

      recentLoans.value = loans
        .slice()
        .sort((a, b) => {
          const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 10);
    } catch (e) {
      console.warn("[useFlashloanCore] loadLoanStats failed:", e instanceof Error ? e.message : String(e));
      stats.value = { totalLoans: 0, totalVolume: 0, totalFees: 0 };
      recentLoans.value = [];
    }
  };

  const loadData = async () => {
    isLoading.value = true;
    try {
      await Promise.all([loadPoolBalance(), loadLoanStats()]);
    } catch (e) {
      console.warn("[useFlashloanCore] loadData failed:", e instanceof Error ? e.message : String(e));
    } finally {
      isLoading.value = false;
    }
  };

  // -- Actions (via OS services) --------------------------------------------

  /**
   * Look up a loan by ID via StorageProxy.
   * The edge function reads the loan details from the contract.
   */
  const lookupLoan = async (loanIdValue: string) => {
    const validation = validateLoanId(loanIdValue);
    if (validation) {
      validationError.value = validation;
      throw new Error(validation);
    }
    validationError.value = null;

    const loanId = Number(loanIdValue);
    isLoading.value = true;

    try {
      const parsed = await storageService.get(`loan:${loanId}`);
      const details = buildLoanDetails(
        (parsed as Record<string, unknown>) || {},
        loanId,
      );
      if (!details) {
        loanDetails.value = null;
        throw new Error(t("loanNotFound"));
      }

      loanDetails.value = details;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Request a flash loan via PaymentProxy + StorageProxy.
   * The edge function handles wallet connection, parameter encoding,
   * and the requestLoan contract invocation.
   */
  const requestLoan = async (data: { amount: string; callbackContract: string; callbackMethod: string }) => {
    if (!address.value) {
      throw new Error(t("connectWallet"));
    }

    const validation = validateLoanRequest(data);
    if (validation) {
      validationError.value = validation;
      throw new Error(validation);
    }
    validationError.value = null;

    isLoading.value = true;

    try {
      // Request loan via StorageProxy — the edge function handles
      // the requestLoan contract invocation
      await storageService.set("loan:request", {
        borrower: address.value,
        amount: toFixed8(data.amount),
        callbackContract: data.callbackContract,
        callbackMethod: data.callbackMethod,
      });

      // Award first-loan badge (fire-and-forget)
      if (stats.value.totalLoans === 0) {
        badgeService.award("first-flashloan", address.value).catch(() => {});
      }

      await loadData();
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // State
    address,
    poolBalance,
    loanDetails,
    stats,
    recentLoans,
    isLoading,
    validationError,

    // Methods
    connect: async () => { /* wallet connection handled by platform */ },
    loadData,
    lookupLoan,
    requestLoan,

    /**
     * Set the wallet address. Called from main.ts to track the
     * connected wallet address from the platform's chain service.
     */
    setAddress: (addr: string) => { address.value = addr; },
  };
}

export type UseFlashloanCoreReturn = ReturnType<typeof useFlashloanCore>;

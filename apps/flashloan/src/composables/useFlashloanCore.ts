/**
 * useFlashloanCore — Domain logic for the Flash Loan miniapp
 *
 * Receives ChainService + EventBus from PlatformServices instead of
 * instantiating its own useContractInteraction / useStatusMessage / useEvents.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { formatNumber, formatAddress, formatGas, toFixed8 } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";

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
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useFlashloanCore({ chain, eventBus, t }: UseFlashloanCoreOptions) {
  const poolBalance = ref(0);
  const loanDetails = ref<LoanDetails | null>(null);
  const stats = ref({ totalLoans: 0, totalVolume: 0, totalFees: 0 });
  const recentLoans = ref<ExecutedLoan[]>([]);
  const isLoading = ref(false);
  const validationError = ref<string | null>(null);

  // -- Helpers --------------------------------------------------------------

  const toNumber = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const formatTimestamp = (value: unknown) => {
    const ts = toNumber(value);
    if (!ts) return t("notAvailable");
    return new Intl.DateTimeFormat(undefined).format(new Date(ts * 1000));
  };

  const toGas = (value: unknown): number => {
    const num = toNumber(value);
    return num / 100000000;
  };

  const buildLoanDetails = (parsed: unknown, loanId: number): LoanDetails | null => {
    if (!Array.isArray(parsed) || parsed.length < 8) return null;
    const [borrower, amount, fee, callbackContract, callbackMethod, timestamp, executed, success] = parsed;
    const amountRaw = toNumber(amount);
    const feeRaw = toNumber(fee);
    const callbackMethodText = String(callbackMethod || "");
    const isEmpty = amountRaw === 0 && feeRaw === 0 && !callbackMethodText && !toNumber(timestamp);
    if (isEmpty) return null;

    const executedFlag = Boolean(executed);
    const statusValue: LoanStatus = executedFlag ? (Boolean(success) ? "success" : "failed") : "pending";

    return {
      id: String(loanId),
      borrower: formatAddress(String(borrower || "")) || t("notAvailable"),
      amount: formatGas(amountRaw),
      fee: formatGas(feeRaw),
      callbackContract: formatAddress(String(callbackContract || "")) || t("notAvailable"),
      callbackMethod: callbackMethodText || t("notAvailable"),
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

  // -- Data loading ---------------------------------------------------------

  const loadPoolBalance = async () => {
    try {
      const result = await chain.read("getPoolBalance");
      poolBalance.value = toGas(result);
    } catch (e) {
      console.warn("[useFlashloanCore] loadPoolBalance failed:", e instanceof Error ? e.message : String(e));
      poolBalance.value = 0;
    }
  };

  const loadLoanStats = async () => {
    try {
      const executedEvents = await chain.listAllEvents("LoanExecuted");
      const loans: ExecutedLoan[] = executedEvents
        .map((evt: unknown) => {
          const evtRecord = evt as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
          const id = Number(values[0] || 0);
          const amount = toGas(values[2]);
          const fee = toGas(values[3]);
          const success = Boolean(values[4]);
          const timestamp = String(evtRecord.created_at || "");
          if (!id) return null;
          return {
            id,
            amount,
            fee,
            status: success ? "success" : "failed",
            timestamp,
          } as ExecutedLoan;
        })
        .filter(Boolean) as ExecutedLoan[];

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

  // -- Actions --------------------------------------------------------------

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
      const parsed = await chain.read(
        "getLoan",
        [{ type: "Integer", value: String(loanId) }],
      );
      const details = buildLoanDetails(parsed, loanId);
      if (!details) {
        loanDetails.value = null;
        throw new Error(t("loanNotFound"));
      }

      loanDetails.value = details;
      eventBus.emit("flashloan:lookup", { loanId });
    } finally {
      isLoading.value = false;
    }
  };

  const requestLoan = async (data: { amount: string; callbackContract: string; callbackMethod: string }) => {
    await chain.ensureWallet();

    if (!chain.address.value) {
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
      const amountInt = toFixed8(data.amount);

      await chain.invoke(
        "requestLoan",
        [
          { type: "Hash160", value: chain.address.value },
          { type: "Integer", value: amountInt },
          { type: "Hash160", value: data.callbackContract },
          { type: "String", value: data.callbackMethod },
        ],
      );

      eventBus.emit("flashloan:requested", { amount: data.amount });
      await loadData();
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // State
    address: chain.address,
    poolBalance,
    loanDetails,
    stats,
    recentLoans,
    isLoading,
    validationError,

    // Methods
    connect: () => chain.ensureWallet(),
    loadData,
    lookupLoan,
    requestLoan,
  };
}

export type UseFlashloanCoreReturn = ReturnType<typeof useFlashloanCore>;

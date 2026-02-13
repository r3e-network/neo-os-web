import { ref, computed } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatNumber, formatAddress, formatGas } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { useErrorHandler } from "@shared/composables/useErrorHandler";

const APP_ID = "miniapp-flashloan";

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

export function useFlashloanCore() {
  const { t } = createUseI18n(messages)();
  const { handleError, getUserMessage, canRetry } = useErrorHandler();
  const { address, connect, chainType, invokeRead, invokeContract, getContractAddress } = useWallet() as WalletSDK;
  const { list: listEvents } = useEvents();

  const contractAddress = ref<string | null>(null);
  const poolBalance = ref(0);
  const loanIdInput = ref("");
  const loanDetails = ref<LoanDetails | null>(null);
  const stats = ref({ totalLoans: 0, totalVolume: 0, totalFees: 0 });
  const recentLoans = ref<ExecutedLoan[]>([]);
  const isLoading = ref(false);
  const validationError = ref<string | null>(null);
  const lastOperation = ref<string | null>(null);

  const navTabs = computed(() => [
    { id: "main", icon: "wallet", label: t("main") },
    { id: "stats", icon: "chart", label: t("stats") },
    { id: "docs", icon: "book", label: t("docs") },
  ]);

  const ensureContractAddress = async () => {
    if (!requireNeoChain(chainType, t)) {
      throw new Error(t("wrongChain"));
    }
    if (!contractAddress.value) {
      contractAddress.value = await getContractAddress();
    }
    if (!contractAddress.value) throw new Error(t("error"));
    return contractAddress.value;
  };

  const toNumber = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const formatTimestamp = (value: unknown) => {
    const ts = toNumber(value);
    if (!ts) return t("notAvailable");
    return new Date(ts * 1000).toLocaleString();
  };

  const toFixed8 = (value: string | number): string => {
    const num = Number(value);
    if (Number.isNaN(num) || num <= 0) return "0";
    return Math.floor(num * 100000000).toString();
  };

  const toGas = (value: unknown): number => {
    const num = toNumber(value);
    return num / 100000000;
  };

  const listAllEvents = async (eventName: string) => {
    const events: unknown[] = [];
    let afterId: string | undefined;
    let hasMore = true;
    while (hasMore) {
      try {
        const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 50, after_id: afterId });
        events.push(...res.events);
        hasMore = Boolean(res.has_more && res.last_id);
        afterId = res.last_id || undefined;
      } catch (e: unknown) {
        handleError(e, { operation: "listEvents", metadata: { eventName } });
        break;
      }
    }
    return events;
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
      borrower: formatAddress(String(borrower || "")),
      amount: formatGas(amountRaw),
      fee: formatGas(feeRaw),
      callbackContract: formatAddress(String(callbackContract || "")),
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

  const fetchPoolBalance = async () => {
    try {
      const contract = await ensureContractAddress();
      const res = await invokeRead({ scriptHash: contract, operation: "getPoolBalance" });
      poolBalance.value = toGas(parseInvokeResult(res));
    } catch (e: unknown) {
      handleError(e, { operation: "fetchPoolBalance" });
      poolBalance.value = 0;
    }
  };

  const fetchLoanStats = async () => {
    try {
      const executedEvents = await listAllEvents("LoanExecuted");
      const loans: ExecutedLoan[] = executedEvents
        .map((evt) => {
          const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
          const id = Number(values[0] || 0);
          const amount = toGas(values[2]);
          const fee = toGas(values[3]);
          const success = Boolean(values[4]);
          const timestamp = String(evt.created_at || "");
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
    } catch (e: unknown) {
      handleError(e, { operation: "fetchLoanStats" });
      stats.value = { totalLoans: 0, totalVolume: 0, totalFees: 0 };
      recentLoans.value = [];
    }
  };

  const fetchData = async () => {
    try {
      await Promise.all([fetchPoolBalance(), fetchLoanStats()]);
    } catch (e: unknown) {
      handleError(e, { operation: "fetchData" });
    }
  };

  return {
    address,
    connect,
    chainType,
    contractAddress,
    poolBalance,
    loanIdInput,
    loanDetails,
    stats,
    recentLoans,
    isLoading,
    validationError,
    lastOperation,
    navTabs,
    ensureContractAddress,
    toNumber,
    formatTimestamp,
    toFixed8,
    toGas,
    listAllEvents,
    buildLoanDetails,
    validateLoanId,
    validateLoanRequest,
    fetchPoolBalance,
    fetchLoanStats,
    fetchData,
    handleError,
    getUserMessage,
    canRetry,
    invokeRead,
    invokeContract,
  };
}

import { ref, computed } from "vue";
import { useEvents, useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK, ContractEvent } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { formatNumber, formatAddress, formatGas, toFixed8 } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useStatusMessage } from "@shared/composables/useStatusMessage";

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
  const { setStatus } = useStatusMessage();
  const { chainType } = useWallet() as WalletSDK;
  const { list: listEvents } = useEvents();
  const {
    address,
    ensureWallet,
    contractAddress,
    ensureContractAddress,
    read,
    invokeDirectly,
  } = useContractInteraction({ appId: APP_ID, t });
  const { listAllEvents } = useAllEvents(listEvents, APP_ID, {
    onError: (error: unknown, eventName: string) => {
      handleError(error, { operation: "listEvents", metadata: { eventName } });
    },
  });

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

  const loadPoolBalance = async () => {
    isLoading.value = true;
    try {
      const contract = await ensureContractAddress();
      const result = await read("getPoolBalance", undefined, contract);
      poolBalance.value = toGas(result);
    } catch (e: unknown) {
      handleError(e, { operation: "loadPoolBalance" });
      setStatus(formatErrorMessage(e, t("error")), "error");
      poolBalance.value = 0;
    } finally {
      isLoading.value = false;
    }
  };

  const loadLoanStats = async () => {
    isLoading.value = true;
    try {
      const executedEvents = await listAllEvents("LoanExecuted");
      const loans: ExecutedLoan[] = executedEvents
        .map((evt: ContractEvent) => {
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
      handleError(e, { operation: "loadLoanStats" });
      setStatus(formatErrorMessage(e, t("error")), "error");
      stats.value = { totalLoans: 0, totalVolume: 0, totalFees: 0 };
      recentLoans.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const loadData = async () => {
    try {
      await Promise.all([loadPoolBalance(), loadLoanStats()]);
    } catch (e: unknown) {
      handleError(e, { operation: "loadData" });
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const lookupLoan = async (
    loanIdValue: string,
    setStatus: (msg: string, type: string) => void,
    setErrorStatus: (msg: string, type: string) => void
  ) => {
    const validation = validateLoanId(loanIdValue);
    if (validation) {
      validationError.value = validation;
      setStatus(validation, "error");
      return;
    }
    validationError.value = null;

    const loanId = Number(loanIdValue);
    lastOperation.value = "lookup";

    try {
      isLoading.value = true;
      const contract = await ensureContractAddress();

      try {
        const parsed = await read(
          "getLoan",
          [{ type: "Integer", value: String(loanId) }],
          contract,
        );
        const details = buildLoanDetails(parsed, loanId);
        if (!details) {
          loanDetails.value = null;
          setStatus(t("loanNotFound"), "error");
          return;
        }

        loanDetails.value = details;
        setStatus(t("loanStatusLoaded"), "success");
      } catch (e: unknown) {
        handleError(e, { operation: "lookupLoan", metadata: { loanId } });
        throw new Error(formatErrorMessage(e, t("error")));
      }
    } catch (e: unknown) {
      const userMsg = formatErrorMessage(e, t("error"));
      const retryable = canRetry(e);
      setStatus(userMsg, "error");
      if (retryable) {
        setErrorStatus(userMsg, "error");
      }
    } finally {
      isLoading.value = false;
    }
  };

  const requestLoan = async (
    data: { amount: string; callbackContract: string; callbackMethod: string },
    setStatus: (msg: string, type: string) => void,
    clearStatusFn: () => void,
    setErrorStatus: (msg: string, type: string) => void
  ) => {
    if (!address.value) {
      try {
        await ensureWallet();
      } catch (e: unknown) {
        handleError(e, { operation: "connectBeforeRequestLoan" });
        setStatus(formatErrorMessage(e, t("error")), "error");
        return;
      }
    }

    if (!address.value) {
      setStatus(t("connectWallet"), "error");
      return;
    }

    const validation = validateLoanRequest(data);
    if (validation) {
      validationError.value = validation;
      setStatus(validation, "error");
      return;
    }
    validationError.value = null;

    isLoading.value = true;
    clearStatusFn();
    lastOperation.value = "requestLoan";

    try {
      const contract = await ensureContractAddress();
      const amountInt = toFixed8(data.amount);

      await invokeDirectly(
        "requestLoan",
        [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: amountInt },
          { type: "Hash160", value: data.callbackContract },
          { type: "String", value: data.callbackMethod },
        ],
        contract,
      );

      setStatus(t("loanRequested"), "success");
      await loadData();
    } catch (e: unknown) {
      handleError(e, { operation: "requestLoan", metadata: { amount: data.amount } });
      const userMsg = formatErrorMessage(e, t("error"));
      const retryable = canRetry(e);
      setStatus(userMsg, "error");
      if (retryable) {
        setErrorStatus(userMsg, "error");
      }
    } finally {
      isLoading.value = false;
    }
  };

  return {
    address,
    connect: ensureWallet,
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
    loadPoolBalance,
    loadLoanStats,
    loadData,
    handleError,
    getUserMessage,
    canRetry,
    lookupLoan,
    requestLoan,
  };
}

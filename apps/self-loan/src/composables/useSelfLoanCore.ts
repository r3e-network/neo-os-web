import { ref, computed } from "vue";
import { formatNumber, parseGas, toFixedDecimals } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { useWalletBalanceReader } from "@shared/composables/useWalletBalanceReader";
import { messages } from "@/locale/messages";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

export type { StatusType, StatusMessage as Status } from "@shared/composables/useStatusMessage";
export type Terms = { ltvPercent: number; minDurationHours: number };
export type Loan = {
  borrowed: number;
  collateralLocked: number;
  active: boolean;
  id?: number | null;
  ltvPercent?: number;
};
export type LtvOption = { tier: number; percent: number; label: string; desc?: string };
export type PlatformStats = {
  ltvTier1Bps: number;
  ltvTier2Bps: number;
  ltvTier3Bps: number;
  minLoanDurationSeconds: number;
  platformFeeBps: number;
};

export const APP_ID = "miniapp-self-loan";

export function useSelfLoanCore() {
  const { t } = createUseI18n(messages)();
  const { handleError, getUserMessage, canRetry } = useErrorHandler();
  const { readBalance } = useWalletBalanceReader();
  const {
    address,
    ensureWallet,
    ensureContractAddress,
    read,
    invokeDirectly,
  } = useContractInteraction({ appId: APP_ID, t });

  const isLoading = ref(false);
  const neoBalance = ref(0);
  const platformStats = ref<PlatformStats>({
    ltvTier1Bps: 2000,
    ltvTier2Bps: 3000,
    ltvTier3Bps: 4000,
    minLoanDurationSeconds: 86400,
    platformFeeBps: 50,
  });
  const selectedTier = ref(1);

  const loan = ref<Loan>({ borrowed: 0, collateralLocked: 0, active: false });
  const collateralAmount = ref<string>("");
  const { status, setStatus, clearStatus } = useStatusMessage();

  const fmt = (n: number, d = 2) => formatNumber(n, d);
  const toNumber = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const ltvOptions = computed<LtvOption[]>(() => [
    {
      tier: 1,
      percent: Number((platformStats.value.ltvTier1Bps / 100).toFixed(1)),
      label: t("ltvTierConservative"),
      desc: t("ltvTierConservativeDesc"),
    },
    {
      tier: 2,
      percent: Number((platformStats.value.ltvTier2Bps / 100).toFixed(1)),
      label: t("ltvTierBalanced"),
      desc: t("ltvTierBalancedDesc"),
    },
    {
      tier: 3,
      percent: Number((platformStats.value.ltvTier3Bps / 100).toFixed(1)),
      label: t("ltvTierAggressive"),
      desc: t("ltvTierAggressiveDesc"),
    },
  ]);

  const selectedLtvPercent = computed(() => {
    const option = ltvOptions.value.find((entry) => entry.tier === selectedTier.value);
    return option?.percent ?? 20;
  });

  const minDurationHours = computed(() => Math.max(1, Math.round(platformStats.value.minLoanDurationSeconds / 3600)));
  const platformFeeBps = computed(() => platformStats.value.platformFeeBps);

  const borrowTerms = computed<Terms>(() => ({
    ltvPercent: selectedLtvPercent.value,
    minDurationHours: minDurationHours.value,
  }));

  const positionTerms = computed<Terms>(() => ({
    ltvPercent: loan.value.ltvPercent ?? selectedLtvPercent.value,
    minDurationHours: minDurationHours.value,
  }));

  const healthFactor = computed(() => {
    if (loan.value.borrowed === 0) return 999;
    return loan.value.collateralLocked / loan.value.borrowed;
  });

  const currentLTV = computed(() => {
    if (loan.value.collateralLocked === 0) return 0;
    return Math.round((loan.value.borrowed / loan.value.collateralLocked) * 100);
  });

  const collateralUtilization = computed(() => {
    const total = loan.value.collateralLocked + neoBalance.value;
    if (total === 0) return 0;
    return Math.round((loan.value.collateralLocked / total) * 100);
  });

  const validateCollateral = (amount: string, balance: number): string | null => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      return t("enterValidAmount");
    }
    if (!Number.isInteger(num)) {
      return t("neoMustBeInteger");
    }
    if (num > balance) {
      return t("insufficientNeo");
    }
    return null;
  };

  const readNeoBalance = async (): Promise<number> => {
    return readBalance("NEO", { decimals: 0 });
  };

  const loadLoanPosition = async (loanId: number) => {
    try {
      const contract = await ensureContractAddress();
      const parsed = await read(
        "GetLoanDetails",
        [{ type: "Integer", value: String(loanId) }],
        contract,
      );
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        loan.value = { borrowed: 0, collateralLocked: 0, active: false };
        return;
      }
      const data = parsed as Record<string, unknown>;
      const collateral = toNumber(data.collateral);
      const debt = parseGas(data.debt);
      const active = Boolean(data.active);
      const ltvBps = toNumber(data.ltvBps);
      const ltvPercent = ltvBps ? ltvBps / 100 : selectedLtvPercent.value;
      loan.value = {
        borrowed: active ? debt : 0,
        collateralLocked: active ? collateral : 0,
        active,
        id: loanId,
        ltvPercent,
      };
    } catch (e) {
      handleError(e, { operation: "loadLoanPosition", metadata: { loanId } });
      loan.value = { borrowed: 0, collateralLocked: 0, active: false };
    }
  };

  const loadPlatformStats = async () => {
    try {
      const contract = await ensureContractAddress();
      const parsed = await read("GetPlatformStats", undefined, contract);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const data = parsed as Record<string, unknown>;
        const feeBps = toNumber(data.platformFeeBps);
        platformStats.value = {
          ltvTier1Bps: toNumber(data.ltvTier1Bps) || platformStats.value.ltvTier1Bps,
          ltvTier2Bps: toNumber(data.ltvTier2Bps) || platformStats.value.ltvTier2Bps,
          ltvTier3Bps: toNumber(data.ltvTier3Bps) || platformStats.value.ltvTier3Bps,
          minLoanDurationSeconds: toNumber(data.minLoanDurationSeconds) || platformStats.value.minLoanDurationSeconds,
          platformFeeBps: feeBps > 0 ? feeBps : platformStats.value.platformFeeBps,
        };
      }
    } catch (e) {
      handleError(e, { operation: "loadPlatformStats" });
      // Non-critical: retain previous platform stats values
    }
  };

  const loadBalance = async () => {
    if (!address.value) return;
    try {
      neoBalance.value = await readNeoBalance();
    } catch (e) {
      handleError(e, { operation: "loadBalance" });
      // Non-critical: retain previous balance
    }
  };

  const takeLoan = async (onFetchData: () => Promise<void>, onError?: (e: unknown, retryable: boolean) => void) => {
    if (isLoading.value) return;

    const validation = validateCollateral(collateralAmount.value, neoBalance.value);
    if (validation) {
      setStatus(validation, "error");
      return validation;
    }

    const collateral = Number(toFixedDecimals(collateralAmount.value, 0));
    const ltvPercent = selectedLtvPercent.value;
    const feeBps = platformFeeBps.value;
    const grossBorrow = (collateral * ltvPercent) / 100;
    const feeAmount = (grossBorrow * feeBps) / 10000;
    const netBorrow = Math.max(grossBorrow - feeAmount, 0);

    if (!address.value) {
      try {
        await ensureWallet();
      } catch (e) {
        handleError(e, { operation: "connectBeforeTakeLoan" });
        setStatus(formatErrorMessage(e, t("error")), "error");
        return;
      }
    }

    if (!address.value) {
      setStatus(t("connectWallet"), "error");
      return;
    }

    isLoading.value = true;

    try {
      const selfLoanAddress = await ensureContractAddress();

      await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: selfLoanAddress },
          { type: "Integer", value: collateral },
          { type: "String", value: `${APP_ID}:collateral` },
        ],
        BLOCKCHAIN_CONSTANTS.NEO_HASH,
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      await invokeDirectly(
        "CreateLoan",
        [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: collateral },
          { type: "Integer", value: selectedTier.value },
        ],
        selfLoanAddress,
      );

      setStatus(t("loanApproved", { amount: fmt(netBorrow, 2), tokenGas: t("tokenGas") }), "success");
      collateralAmount.value = "";
      await onFetchData();
    } catch (e) {
      handleError(e, { operation: "takeLoan", metadata: { collateral, tier: selectedTier.value } });
      const userMsg = formatErrorMessage(e, t("error"));
      const retryable = canRetry(e);
      setStatus(userMsg, "error");
      onError?.(e, retryable);
    } finally {
      isLoading.value = false;
    }
  };

  return {
    address,
    connect: ensureWallet,
    isLoading,
    neoBalance,
    loan,
    collateralAmount,
    status,
    setStatus,
    clearStatus,
    selectedTier,
    ltvOptions,
    selectedLtvPercent,
    minDurationHours,
    platformFeeBps,
    borrowTerms,
    positionTerms,
    healthFactor,
    currentLTV,
    collateralUtilization,
    ensureContractAddress,
    validateCollateral,
    readNeoBalance,
    loadLoanPosition,
    loadPlatformStats,
    loadBalance,
    takeLoan,
    fmt,
    t,
    handleError,
    getUserMessage,
    canRetry,
    APP_ID,
  };
}

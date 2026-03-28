/**
 * useGasSponsorApp — Domain logic for Gas Sponsor miniapp
 *
 * Encapsulates gas sponsorship, donate, and send logic.
 * Receives ChainService + EventBus from PlatformServices.
 *
 * Replaces the legacy pattern that wired useContractInteraction + useWallet
 * directly. Now uses ChainService for GAS transfers and EventBus for
 * cross-component notifications.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { useGasSponsor as useGasSponsorSDK } from "@shared/utils/wallet-sdk";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const SPONSOR_POOL_ADDRESS = "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK";
const ELIGIBILITY_THRESHOLD = 0.1;

export interface UseGasSponsorAppOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useGasSponsorApp({ chain, eventBus, t }: UseGasSponsorAppOptions) {
  const { isRequestingSponsorship: isRequesting, checkEligibility, requestSponsorship: apiRequest } = useGasSponsorSDK();

  const userAddress = ref("");
  const gasBalance = ref("0");
  const usedQuota = ref("0");
  const dailyLimit = ref("0.1");
  const resetsAt = ref("");
  const loading = ref(true);
  const requestAmount = ref("0.01");

  // Donate/Send state
  const donateAmount = ref("0.1");
  const sendAmount = ref("0.1");
  const recipientAddress = ref("");
  const isDonating = ref(false);
  const isSending = ref(false);

  // -- Computed --
  const isEligible = computed(() => parseFloat(gasBalance.value) < ELIGIBILITY_THRESHOLD);
  const remainingQuota = computed(() => Math.max(0, parseFloat(dailyLimit.value) - parseFloat(usedQuota.value)));
  const fuelLevelPercent = computed(() => {
    const balance = parseFloat(gasBalance.value);
    return Math.min((balance / ELIGIBILITY_THRESHOLD) * 100, 100);
  });
  const maxRequestAmount = computed(() => remainingQuota.value.toFixed(4));
  const quickAmounts = computed(() => [0.001, 0.005, 0.01, 0.05]);
  const quotaPercent = computed(() => {
    const limit = parseFloat(dailyLimit.value);
    const used = parseFloat(usedQuota.value);
    return limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  });
  const resetTime = computed(() => {
    if (!resetsAt.value) return t("notAvailable");
    const now = Date.now();
    const reset = new Date(resetsAt.value).getTime();
    const diff = reset - now;
    if (diff <= 0) return t("now");
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}${t("hoursShort")} ${minutes}${t("minutesShort")}`;
  });

  // -- Display values for manifest --
  const tankLevelDisplay = computed(() => `${Math.round(fuelLevelPercent.value)}%`);
  const gasBalanceDisplay = computed(() => gasBalance.value);
  const remainingQuotaDisplay = computed(() => remainingQuota.value.toFixed(4));
  const eligibleDisplay = computed(() => isEligible.value ? t("eligible") : t("notEligible"));

  // -- Helpers --

  /**
   * Scale a display-unit GAS amount to Fixed8 base units.
   * E.g. "0.1" -> "10000000"
   */
  const toFixed8 = (displayAmount: string): string => {
    const parsed = parseFloat(displayAmount);
    if (!Number.isFinite(parsed)) return "0";
    return String(Math.round(parsed * 1e8));
  };

  // -- Actions --
  const loadUserData = async () => {
    loading.value = true;
    try {
      await chain.ensureWallet();
      userAddress.value = chain.address.value || "";

      const statusData = await checkEligibility();
      gasBalance.value = statusData.gas_balance;
      usedQuota.value = statusData.used_today;
      dailyLimit.value = statusData.daily_limit;
      resetsAt.value = statusData.resets_at;
      eventBus.emit("userData:loaded", {});
    } catch (e) {
      eventBus.emit("userData:error", { message: formatErrorMessage(e, t("loadFailed")) });
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const requestSponsorship = async () => {
    if (!isEligible.value || remainingQuota.value <= 0) return;

    const amount = parseFloat(requestAmount.value);
    if (Number.isNaN(amount) || amount <= 0 || amount > remainingQuota.value) {
      throw new Error(t("invalidAmount"));
    }

    try {
      const result = await apiRequest(requestAmount.value);
      eventBus.emit("sponsorship:requested", { id: result.request_id });
      requestAmount.value = "0.01";
      await loadUserData();
      return result;
    } catch (e) {
      eventBus.emit("sponsorship:error", { message: formatErrorMessage(e, t("requestFailed")) });
      throw e;
    }
  };

  const handleDonate = async () => {
    if (isDonating.value) return;
    const amount = parseFloat(donateAmount.value);
    if (Number.isNaN(amount) || amount <= 0) {
      throw new Error(t("invalidAmount"));
    }
    isDonating.value = true;
    try {
      await chain.ensureWallet();
      const sender = chain.address.value as string;
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: sender },
          { type: "Hash160", value: SPONSOR_POOL_ADDRESS },
          { type: "Integer", value: toFixed8(donateAmount.value) },
          { type: "String", value: "" },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );
      eventBus.emit("donate:success", {});
      donateAmount.value = "0.1";
      await loadUserData();
    } catch (e) {
      eventBus.emit("donate:error", { message: formatErrorMessage(e, t("loadFailed")) });
      throw e;
    } finally {
      isDonating.value = false;
    }
  };

  const handleSend = async () => {
    if (isSending.value) return;
    if (!recipientAddress.value || recipientAddress.value.length < 30) {
      throw new Error(t("invalidAddress"));
    }
    const amount = parseFloat(sendAmount.value);
    if (Number.isNaN(amount) || amount <= 0) {
      throw new Error(t("invalidAmount"));
    }
    isSending.value = true;
    try {
      await chain.ensureWallet();
      const sender = chain.address.value as string;
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: sender },
          { type: "Hash160", value: recipientAddress.value },
          { type: "Integer", value: toFixed8(sendAmount.value) },
          { type: "String", value: "" },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );
      eventBus.emit("send:success", {});
      sendAmount.value = "0.1";
      recipientAddress.value = "";
      await loadUserData();
    } catch (e) {
      eventBus.emit("send:error", { message: formatErrorMessage(e, t("loadFailed")) });
      throw e;
    } finally {
      isSending.value = false;
    }
  };

  const loadAll = loadUserData;

  return {
    // -- State --
    userAddress,
    gasBalance,
    usedQuota,
    dailyLimit,
    resetsAt,
    loading,
    requestAmount,
    donateAmount,
    sendAmount,
    recipientAddress,
    isDonating,
    isSending,
    isRequesting,

    // -- Computed --
    isEligible,
    remainingQuota,
    fuelLevelPercent,
    maxRequestAmount,
    quickAmounts,
    quotaPercent,
    resetTime,

    // -- Display --
    tankLevelDisplay,
    gasBalanceDisplay,
    remainingQuotaDisplay,
    eligibleDisplay,

    // -- Actions --
    loadUserData,
    requestSponsorship,
    handleDonate,
    handleSend,
    loadAll,
  };
}

export type UseGasSponsorAppReturn = ReturnType<typeof useGasSponsorApp>;

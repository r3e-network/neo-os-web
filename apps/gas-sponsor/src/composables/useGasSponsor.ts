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

import { createObservable, createDerived, refToObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
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
  const gasSponsorSDK = useGasSponsorSDK();
  const isRequesting = refToObservable(gasSponsorSDK.isRequestingSponsorship);
  const { checkEligibility, requestSponsorship: apiRequest } = gasSponsorSDK;

  const userAddress = createObservable("");
  const gasBalance = createObservable("0");
  const usedQuota = createObservable("0");
  const dailyLimit = createObservable("0.1");
  const resetsAt = createObservable("");
  const loading = createObservable(true);
  const requestAmount = createObservable("0.01");

  // Donate/Send state
  const donateAmount = createObservable("0.1");
  const sendAmount = createObservable("0.1");
  const recipientAddress = createObservable("");
  const isDonating = createObservable(false);
  const isSending = createObservable(false);

  // -- Computed --
  const isEligible = createDerived(() => parseFloat(gasBalance.get()) < ELIGIBILITY_THRESHOLD, []);
  const remainingQuota = createDerived(() => Math.max(0, parseFloat(dailyLimit.get()) - parseFloat(usedQuota.get())), []);
  const fuelLevelPercent = createDerived(() => {
    const balance = parseFloat(gasBalance.get());
    return Math.min((balance / ELIGIBILITY_THRESHOLD) * 100, 100);
  }, []);
  const maxRequestAmount = createDerived(() => remainingQuota.get().toFixed(4), []);
  const quickAmounts = createDerived(() => [0.001, 0.005, 0.01, 0.05], []);
  const quotaPercent = createDerived(() => {
    const limit = parseFloat(dailyLimit.get());
    const used = parseFloat(usedQuota.get());
    return limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  }, []);
  const resetTime = createDerived(() => {
    if (!resetsAt.get()) return t("notAvailable");
    const now = Date.now();
    const reset = new Date(resetsAt.get()).getTime();
    const diff = reset - now;
    if (diff <= 0) return t("now");
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}${t("hoursShort")} ${minutes}${t("minutesShort")}`;
  }, []);

  // -- Display values for manifest --
  const tankLevelDisplay = createDerived(() => `${Math.round(fuelLevelPercent.get())}%`, []);
  const gasBalanceDisplay = createDerived(() => gasBalance.get(), []);
  const remainingQuotaDisplay = createDerived(() => remainingQuota.get().toFixed(4), []);
  const eligibleDisplay = createDerived(() => isEligible.get() ? t("eligible") : t("notEligible"), []);

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
    loading.set(true);
    try {
      await chain.ensureWallet();
      userAddress.set(chain.address.get() || "");

      const statusData = await checkEligibility();
      gasBalance.set(statusData.gas_balance);
      usedQuota.set(statusData.used_today);
      dailyLimit.set(statusData.daily_limit);
      resetsAt.set(statusData.resets_at);
      eventBus.emit("userData:loaded", {});
    } catch (e) {
      eventBus.emit("userData:error", { message: formatErrorMessage(e, t("loadFailed")) });
      throw e;
    } finally {
      loading.set(false);
    }
  };

  const requestSponsorship = async () => {
    if (!isEligible.get() || remainingQuota.get() <= 0) return;

    const amount = parseFloat(requestAmount.get());
    if (Number.isNaN(amount) || amount <= 0 || amount > remainingQuota.get()) {
      throw new Error(t("invalidAmount"));
    }

    try {
      const result = await apiRequest(requestAmount.get());
      eventBus.emit("sponsorship:requested", { id: result.request_id });
      requestAmount.set("0.01");
      await loadUserData();
      return result;
    } catch (e) {
      eventBus.emit("sponsorship:error", { message: formatErrorMessage(e, t("requestFailed")) });
      throw e;
    }
  };

  const handleDonate = async () => {
    if (isDonating.get()) return;
    const amount = parseFloat(donateAmount.get());
    if (Number.isNaN(amount) || amount <= 0) {
      throw new Error(t("invalidAmount"));
    }
    isDonating.set(true);
    try {
      await chain.ensureWallet();
      const sender = chain.address.get() as string;
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: sender },
          { type: "Hash160", value: SPONSOR_POOL_ADDRESS },
          { type: "Integer", value: toFixed8(donateAmount.get()) },
          { type: "String", value: "" },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );
      eventBus.emit("donate:success", {});
      donateAmount.set("0.1");
      await loadUserData();
    } catch (e) {
      eventBus.emit("donate:error", { message: formatErrorMessage(e, t("loadFailed")) });
      throw e;
    } finally {
      isDonating.set(false);
    }
  };

  const handleSend = async () => {
    if (isSending.get()) return;
    if (!recipientAddress.get() || recipientAddress.get().length < 30) {
      throw new Error(t("invalidAddress"));
    }
    const amount = parseFloat(sendAmount.get());
    if (Number.isNaN(amount) || amount <= 0) {
      throw new Error(t("invalidAmount"));
    }
    isSending.set(true);
    try {
      await chain.ensureWallet();
      const sender = chain.address.get() as string;
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: sender },
          { type: "Hash160", value: recipientAddress.get() },
          { type: "Integer", value: toFixed8(sendAmount.get()) },
          { type: "String", value: "" },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );
      eventBus.emit("send:success", {});
      sendAmount.set("0.1");
      recipientAddress.set("");
      await loadUserData();
    } catch (e) {
      eventBus.emit("send:error", { message: formatErrorMessage(e, t("loadFailed")) });
      throw e;
    } finally {
      isSending.set(false);
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

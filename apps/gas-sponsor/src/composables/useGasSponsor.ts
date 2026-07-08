/**
 * useGasSponsorApp — Domain logic for Gas Sponsor miniapp
 *
 * Encapsulates gas sponsorship (platform API), donate, and send logic.
 *
 * The sponsorship eligibility/quota/tank come from the platform HTTP API
 * (VITE_PLATFORM_API). That API is optional and can be unreachable; when it is,
 * the SDK silently returns a fabricated zero balance. This module never presents
 * those zeros as fact — it raises an honest service-unavailable notice and falls
 * back to the REAL on-chain GAS balance (read via app.wallet) to gate the
 * donate/send "pay it forward" transfers, which are pure on-chain GAS
 * transfers and work independently of the API.
 */

import { createObservable, createDerived, refToObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type { MiniAppLaunchNetwork } from "@shared/utils/launch-params";
import { useGasSponsor as useGasSponsorSDK } from "@shared/utils/wallet-sdk";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

// Per-network donation pool destination. Donations are pure GAS transfers; the
// pool wallet differs by network so testnet GAS never lands on the mainnet pool.
const SPONSOR_POOL_ADDRESS: Record<"mainnet" | "testnet", string> = {
  mainnet: "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK",
  testnet: "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK",
};

const ELIGIBILITY_THRESHOLD = 0.1;

// Whether the platform HTTP API is configured at all. Mirrors the SDK's own
// `PLATFORM_API = import.meta.env?.VITE_PLATFORM_API || ""` check so we can tell
// "API not configured" apart from "wallet has a real zero balance".
const PLATFORM_API_CONFIGURED = Boolean(import.meta.env?.VITE_PLATFORM_API);

export interface UseGasSponsorAppOptions {
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
  network?: MiniAppLaunchNetwork | null;
}

export function useGasSponsorApp({ app, t, network }: UseGasSponsorAppOptions) {
  // framework-exempt: gas-sponsor sponsorship HTTP API lives in wallet-sdk;
  // it moves only when wallet-sdk moves into the framework (out of campaign
  // scope — plan §3.6).
  const gasSponsorSDK = useGasSponsorSDK();

  // GAS→base-unit scaling uses the framework's null-on-invalid scaler (S6):
  // null (never a throw) on invalid/over-precision input so the localized
  // t("invalidAmount") rejection paths below keep working.
  const chainGasBalanceBaseUnits = (value: number): bigint => {
    if (!Number.isFinite(value) || value <= 0) return 0n;
    const fixed8 = app.amount.parseGasToFixed8(value.toFixed(8));
    return fixed8 ? BigInt(fixed8) : 0n;
  };

  const gasAmountFitsBalance = (amount: string, balance: number): boolean => {
    const fixed8 = app.amount.parseGasToFixed8(amount);
    return Boolean(
      fixed8 && BigInt(fixed8) <= chainGasBalanceBaseUnits(balance),
    );
  };
  const isRequesting = refToObservable(gasSponsorSDK.isRequestingSponsorship);
  const { checkEligibility, requestSponsorship: apiRequest } = gasSponsorSDK;

  const poolAddress = SPONSOR_POOL_ADDRESS[network === "testnet" ? "testnet" : "mainnet"];
  // Surface the pool destination so the donate form can show donors where their
  // GAS lands (the same pool that funds new-user sponsorship requests).
  const poolAddressObservable = createObservable(poolAddress);

  const userAddress = createObservable("");
  // gasBalance / usedQuota / dailyLimit / resetsAt come from the platform API.
  const gasBalance = createObservable("0");
  const usedQuota = createObservable("0");
  const dailyLimit = createObservable("0.1");
  const resetsAt = createObservable("");
  // chainGasBalance is the REAL on-chain GAS the wallet holds — independent of
  // the platform API. It drives the donate/send affordances.
  const chainGasBalance = createObservable(0);
  // serviceAvailable is false when the sponsorship API is unconfigured or down.
  const serviceAvailable = createObservable(true);
  const serviceNotice = createObservable("");
  const loading = createObservable(true);
  const requestAmount = createObservable("0.01");

  // Donate/Send state
  const donateAmount = createObservable("0.1");
  const sendAmount = createObservable("0.1");
  const recipientAddress = createObservable("");
  const isDonating = createObservable(false);
  const isSending = createObservable(false);

  // -- Computed (sponsorship side — only meaningful when serviceAvailable) --
  const isEligible = createDerived(
    () => serviceAvailable.get() && parseFloat(gasBalance.get()) < ELIGIBILITY_THRESHOLD,
    [serviceAvailable, gasBalance],
  );
  const remainingQuota = createDerived(
    () => Math.max(0, parseFloat(dailyLimit.get()) - parseFloat(usedQuota.get())),
    [dailyLimit, usedQuota],
  );
  const fuelLevelPercent = createDerived(() => {
    if (!serviceAvailable.get()) return 0;
    const bal = parseFloat(gasBalance.get());
    return Math.min((bal / ELIGIBILITY_THRESHOLD) * 100, 100);
  }, [serviceAvailable, gasBalance]);
  const maxRequestAmount = createDerived(() => remainingQuota.get().toFixed(4), [remainingQuota]);
  const quickAmounts = createDerived(() => [0.001, 0.005, 0.01, 0.05], []);
  const quotaPercent = createDerived(() => {
    const limit = parseFloat(dailyLimit.get());
    const used = parseFloat(usedQuota.get());
    return limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  }, [dailyLimit, usedQuota]);
  // Empty when there is no reset timestamp — the UI defaults to an em-dash.
  // Never compare against a translated string downstream.
  const resetTime = createDerived(() => {
    if (!serviceAvailable.get() || !resetsAt.get()) return "";
    const now = Date.now();
    const reset = new Date(resetsAt.get()).getTime();
    if (!Number.isFinite(reset)) return "";
    const diff = reset - now;
    if (diff <= 0) return t("now");
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}${t("hoursShort")} ${minutes}${t("minutesShort")}`;
  }, [serviceAvailable, resetsAt]);

  // -- Transfer affordance / inline validation --
  // Donate & Send move GAS the user already holds — gate on the REAL chain
  // balance, not the (possibly fabricated) API balance.
  const isFunded = createDerived(() => chainGasBalance.get() > 0, [chainGasBalance]);
  const donateAmountValid = createDerived(
    () => gasAmountFitsBalance(donateAmount.get(), chainGasBalance.get()),
    [donateAmount, chainGasBalance],
  );
  const recipientValid = createDerived(
    () => isValidNeoAddress(recipientAddress.get()),
    [recipientAddress],
  );
  const sendAmountValid = createDerived(
    () => gasAmountFitsBalance(sendAmount.get(), chainGasBalance.get()),
    [sendAmount, chainGasBalance],
  );
  const canSend = createDerived(
    () => recipientValid.get() && sendAmountValid.get(),
    [recipientValid, sendAmountValid],
  );

  // -- Display values for manifest --
  const tankLevelDisplay = createDerived(
    () => (serviceAvailable.get() ? `${Math.round(fuelLevelPercent.get())}%` : t("notAvailable")),
    [serviceAvailable, fuelLevelPercent],
  );
  const gasBalanceDisplay = createDerived(
    () => (serviceAvailable.get() ? gasBalance.get() : t("notAvailable")),
    [serviceAvailable, gasBalance],
  );
  const remainingQuotaDisplay = createDerived(
    () => (serviceAvailable.get() ? remainingQuota.get().toFixed(4) : t("notAvailable")),
    [serviceAvailable, remainingQuota],
  );
  const eligibleDisplay = createDerived(
    () =>
      serviceAvailable.get() ? (isEligible.get() ? t("eligible") : t("notEligible")) : t("notAvailable"),
    [serviceAvailable, isEligible],
  );
  // The real, chain-read GAS the wallet holds — shown to frame the donate/send
  // affordances honestly even when the sponsorship API is down.
  const chainGasBalanceDisplay = createDerived(() => chainGasBalance.get().toFixed(4), [chainGasBalance]);

  // -- Helpers --

  // Base58 alphabet used by Neo (Bitcoin variant — excludes 0, O, I, l).
  const BASE58_ALPHABET = /^[1-9A-HJ-NP-Za-km-z]+$/;

  /**
   * Validate a Neo N3 address by format: a single 'N' prefix (version byte 0x35),
   * exactly 34 base58 characters, all within the base58 alphabet.
   */
  const isValidNeoAddress = (address: string): boolean => {
    const trimmed = address.trim();
    return trimmed.length === 34 && trimmed.startsWith("N") && BASE58_ALPHABET.test(trimmed);
  };

  /**
   * Read the wallet's real on-chain GAS balance. Best-effort — a chain read
   * failure leaves the previous value rather than fabricating zero.
   */
  const refreshChainBalance = async (address: string) => {
    if (!address) {
      chainGasBalance.set(0);
      return;
    }
    try {
      const gas = await app.wallet.balance("GAS", address);
      chainGasBalance.set(Number.isFinite(gas) ? gas : 0);
    } catch {
      // Keep the last known value; do not zero it out.
    }
  };

  // -- Actions --
  const loadUserData = async () => {
    loading.set(true);
    try {
      await app.chain.ensureWallet();
      const address = app.chain.address.get() || "";
      userAddress.set(address);

      // Always read the real chain balance — drives donate/send regardless of
      // the sponsorship API's health.
      await refreshChainBalance(address);

      const statusData = await checkEligibility();
      const apiError = gasSponsorSDK.eligibilityError.value;
      const apiUsable = PLATFORM_API_CONFIGURED && !apiError && Boolean(address);

      if (apiUsable) {
        gasBalance.set(statusData.gas_balance);
        usedQuota.set(statusData.used_today);
        dailyLimit.set(statusData.daily_limit);
        resetsAt.set(statusData.resets_at);
        serviceAvailable.set(true);
        serviceNotice.set("");
      } else {
        // Do NOT trust the fabricated zeros. Mark the sponsorship service as
        // unavailable and surface an honest notice.
        serviceAvailable.set(false);
        serviceNotice.set(
          !PLATFORM_API_CONFIGURED
            ? t("sponsorServiceUnconfigured")
            : t("sponsorServiceUnavailable"),
        );
      }
    } catch {
      userAddress.set("");
      gasBalance.set("0");
      usedQuota.set("0");
      dailyLimit.set("0.1");
      resetsAt.set("");
      chainGasBalance.set(0);
      serviceAvailable.set(false);
      serviceNotice.set(t("sponsorServiceUnavailable"));
    } finally {
      loading.set(false);
    }
  };

  const requestSponsorship = async () => {
    if (!serviceAvailable.get()) {
      throw new Error(t("sponsorServiceUnavailable"));
    }
    if (!isEligible.get() || remainingQuota.get() <= 0) return;

    const amount = parseFloat(requestAmount.get());
    if (Number.isNaN(amount) || amount <= 0 || amount > remainingQuota.get()) {
      throw new Error(t("invalidAmount"));
    }

    const result = await apiRequest(amount);
    if (!result.success) {
      // Map the SDK's raw error to a localized message.
      const raw = gasSponsorSDK.sponsorshipError.value;
      throw new Error(raw ? formatErrorMessage(new Error(raw), t("requestFailed")) : t("requestFailed"));
    }
    const requestId = result.request_id || result.requestId || result.txid || "";
    requestAmount.set("0.01");
    await loadUserData();
    return { ...result, request_id: requestId };
  };

  const handleDonate = async () => {
    if (isDonating.get()) return;
    const amountFixed8 = app.amount.parseGasToFixed8(donateAmount.get());
    if (!amountFixed8) {
      throw new Error(t("invalidAmount"));
    }
    if (BigInt(amountFixed8) > chainGasBalanceBaseUnits(chainGasBalance.get())) {
      throw new Error(t("insufficientBalance"));
    }
    isDonating.set(true);
    try {
      await app.chain.ensureWallet();
      const sender = app.chain.address.get() as string;
      await app.chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: sender },
          { type: "Hash160", value: poolAddress },
          { type: "Integer", value: amountFixed8 },
          { type: "String", value: "" },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );
      donateAmount.set("0.1");
      await loadUserData();
    } finally {
      isDonating.set(false);
    }
  };

  const handleSend = async () => {
    if (isSending.get()) return;
    if (!isValidNeoAddress(recipientAddress.get())) {
      throw new Error(t("invalidAddress"));
    }
    const amountFixed8 = app.amount.parseGasToFixed8(sendAmount.get());
    if (!amountFixed8) {
      throw new Error(t("invalidAmount"));
    }
    if (BigInt(amountFixed8) > chainGasBalanceBaseUnits(chainGasBalance.get())) {
      throw new Error(t("insufficientBalance"));
    }
    isSending.set(true);
    try {
      await app.chain.ensureWallet();
      const sender = app.chain.address.get() as string;
      await app.chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: sender },
          { type: "Hash160", value: recipientAddress.get() },
          { type: "Integer", value: amountFixed8 },
          { type: "String", value: "" },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );
      sendAmount.set("0.1");
      recipientAddress.set("");
      await loadUserData();
    } finally {
      isSending.set(false);
    }
  };

  const loadAll = loadUserData;

  return {
    // -- State --
    userAddress,
    poolAddress: poolAddressObservable,
    gasBalance,
    usedQuota,
    dailyLimit,
    resetsAt,
    chainGasBalance,
    serviceAvailable,
    serviceNotice,
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
    isFunded,
    donateAmountValid,
    recipientValid,
    sendAmountValid,
    canSend,

    // -- Display --
    tankLevelDisplay,
    gasBalanceDisplay,
    remainingQuotaDisplay,
    eligibleDisplay,
    chainGasBalanceDisplay,

    // -- Actions --
    loadUserData,
    requestSponsorship,
    handleDonate,
    handleSend,
    loadAll,
  };
}

export type UseGasSponsorAppReturn = ReturnType<typeof useGasSponsorApp>;

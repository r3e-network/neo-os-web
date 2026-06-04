import { ref } from "vue";

import {
  getMiniAppContractHash,
  getNetwork,
  type NeoNetwork,
  N3INDEX_API,
} from "../constants/rpc";
import { MiniAppError } from "./errorHandling";
import type {
  ContractEvent,
  EventsListParams,
  EventsListResponse,
  MiniAppManifest,
  WalletSDK,
} from "./wallet-sdk-types";

export type WalletSdkComposableErrorCodes = {
  ELIGIBILITY_CHECK_FAILED: string;
  PLATFORM_API_NOT_CONFIGURED: string;
  WALLET_NOT_CONNECTED: string;
  SPONSORSHIP_REQUEST_FAILED: string;
  PAYMENT_INVALID_AMOUNT: string;
  MINIAPP_CONTRACT_UNAVAILABLE: string;
};

export type WalletSdkComposableDeps = {
  platformApi: string;
  useWallet: () => WalletSDK;
  loadCurrentMiniAppManifest: () => Promise<MiniAppManifest | null>;
  errorCodes: WalletSdkComposableErrorCodes;
};

async function fetchEvents(
  params: EventsListParams,
  platformApi: string,
): Promise<EventsListResponse> {
  if (!platformApi) {
    return { events: [], total: 0 };
  }
  const query = new URLSearchParams();
  if (params.app_id) query.set("app_id", params.app_id);
  if (params.event_name) query.set("event_name", params.event_name);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  if (params.tx_hash) query.set("tx_hash", params.tx_hash);

  const res = await fetch(
    `${platformApi}/api/activity/events?${query.toString()}`,
  );
  if (!res.ok) return { events: [], total: 0 };
  try {
    return await res.json();
  } catch (_e) {
    console.warn(
      "[wallet-sdk] fetchEvents failed to parse JSON:",
      _e instanceof Error ? _e.message : String(_e),
    );
    return { events: [], total: 0 };
  }
}

// ---------------------------------------------------------------------------
// useGasSponsor composable
// ---------------------------------------------------------------------------

export interface EligibilityResult {
  gas_balance: string;
  used_today: string;
  daily_limit: string;
  resets_at: string;
}

export interface SponsorshipResult {
  success: boolean;
  request_id?: string;
  requestId?: string;
  txid?: string;
}

export function createGasSponsorComposable(deps: WalletSdkComposableDeps) {
  const { errorCodes, platformApi, useWallet } = deps;
  const isCheckingEligibility = ref(false);
  const eligibilityError = ref<string | null>(null);
  const isRequestingSponsorship = ref(false);
  const sponsorshipError = ref<string | null>(null);

  const checkEligibility = async (): Promise<EligibilityResult> => {
    isCheckingEligibility.value = true;
    eligibilityError.value = null;
    try {
      if (!platformApi) {
        return {
          gas_balance: "0",
          used_today: "0",
          daily_limit: "0.1",
          resets_at: "",
        };
      }
      const wallet = useWallet();
      const addr = wallet.address.value;
      if (!addr) {
        return {
          gas_balance: "0",
          used_today: "0",
          daily_limit: "0.1",
          resets_at: "",
        };
      }
      const res = await fetch(
        `${platformApi}/api/gas-sponsor/eligibility?address=${addr}`,
      );
      if (!res.ok)
        throw new MiniAppError(
          "Failed to check eligibility",
          errorCodes.ELIGIBILITY_CHECK_FAILED,
          undefined,
          undefined,
          undefined,
          errorCodes.ELIGIBILITY_CHECK_FAILED,
        );
      return res.json();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      eligibilityError.value = msg;
      return {
        gas_balance: "0",
        used_today: "0",
        daily_limit: "0.1",
        resets_at: "",
      };
    } finally {
      isCheckingEligibility.value = false;
    }
  };

  const requestSponsorship = async (
    amount: number,
  ): Promise<SponsorshipResult> => {
    isRequestingSponsorship.value = true;
    sponsorshipError.value = null;
    try {
      if (!platformApi)
        throw new MiniAppError(
          "Platform API not configured",
          errorCodes.PLATFORM_API_NOT_CONFIGURED,
          undefined,
          undefined,
          undefined,
          errorCodes.PLATFORM_API_NOT_CONFIGURED,
        );
      const wallet = useWallet();
      const addr = wallet.address.value;
      if (!addr)
        throw new MiniAppError(
          "Wallet not connected",
          errorCodes.WALLET_NOT_CONNECTED,
          undefined,
          undefined,
          undefined,
          errorCodes.WALLET_NOT_CONNECTED,
        );
      const res = await fetch(`${platformApi}/api/gas-sponsor/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, amount }),
      });
      if (!res.ok)
        throw new MiniAppError(
          "Sponsorship request failed",
          errorCodes.SPONSORSHIP_REQUEST_FAILED,
          undefined,
          undefined,
          undefined,
          errorCodes.SPONSORSHIP_REQUEST_FAILED,
        );
      return res.json();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      sponsorshipError.value = msg;
      return { success: false };
    } finally {
      isRequestingSponsorship.value = false;
    }
  };

  return {
    isCheckingEligibility,
    eligibilityError,
    checkEligibility,
    isRequestingSponsorship,
    sponsorshipError,
    requestSponsorship,
  };
}

// ---------------------------------------------------------------------------
// usePayments composable
// ---------------------------------------------------------------------------

export interface PaymentResult {
  request_id?: string;
  receipt_id: string;
  txid: string;
}

export function createPaymentsComposable(
  appId: string | undefined,
  deps: WalletSdkComposableDeps,
) {
  const { errorCodes, useWallet } = deps;
  const wallet = useWallet();

  const payGAS = async (
    amount: string,
    memo: string,
    targetContractHash = "",
    scopedAppId = appId || "miniapp",
  ): Promise<PaymentResult> => {
    const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
    const parsedAmount = parseFloat(amount);
    // A payment must be a positive number — reject NaN, 0, and negatives before
    // scaling so a malformed/empty amount cannot reach the wallet as a 0-value
    // or negative transfer.
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new MiniAppError(
        "Invalid amount",
        errorCodes.PAYMENT_INVALID_AMOUNT,
        undefined,
        undefined,
        undefined,
        errorCodes.PAYMENT_INVALID_AMOUNT,
      );
    }
    const amountFixed8 = Math.round(parsedAmount * 1e8).toString();
    if (!wallet.address.value) {
      await wallet.connect();
    }
    const resolvedTargetHash =
      targetContractHash || (await wallet.getContractAddress());
    if (!resolvedTargetHash) {
      throw new MiniAppError(
        "MiniApp contract address unavailable",
        errorCodes.MINIAPP_CONTRACT_UNAVAILABLE,
        undefined,
        undefined,
        undefined,
        errorCodes.MINIAPP_CONTRACT_UNAVAILABLE,
      );
    }
    const transferData = String(memo || scopedAppId || "miniapp");

    const result = await wallet.invokeContract({
      scriptHash: GAS_HASH,
      operation: "transfer",
      args: [
        { type: "Hash160", value: wallet.address.value },
        { type: "Hash160", value: resolvedTargetHash },
        { type: "Integer", value: amountFixed8 },
        { type: "String", value: transferData },
      ],
    });

    const txid = result.txid ?? "";

    return {
      request_id: txid,
      receipt_id: "",
      txid,
    };
  };

  const processPayment = async (
    targetContractHash: string,
    scopedAppId: string,
    amount: string,
    memo: string,
  ): Promise<PaymentResult> => {
    return payGAS(amount, `${memo}`, targetContractHash, scopedAppId);
  };

  return { payGAS, processPayment };
}

// ---------------------------------------------------------------------------
// useEvents composable — N3Index-powered event querying
// ---------------------------------------------------------------------------

export function createEventsComposable(deps: WalletSdkComposableDeps) {
  const { loadCurrentMiniAppManifest, platformApi } = deps;
  /**
   * List contract events via N3Index decoded events API.
   * Falls back to platform API if N3Index is unavailable.
   */
  const list = async (
    params: EventsListParams,
  ): Promise<EventsListResponse> => {
    // Try N3Index first (decoded events, more reliable)
    if (params.app_id) {
      try {
        const network = getNetwork() as NeoNetwork;
        let contractHash = getMiniAppContractHash(params.app_id, network);
        if (!contractHash) {
          const manifest = await loadCurrentMiniAppManifest();
          const requestedAppId = String(params.app_id || "").trim();
          if (manifest?.id === requestedAppId) {
            contractHash =
              manifest.contracts?.[`neo-n3-${network}`] ||
              manifest.contracts?.[network] ||
              "";
          }
        }
        if (!contractHash) {
          throw new Error(`missing contract hash for ${params.app_id}`);
        }
        const url = new URL(
          `${N3INDEX_API}/indexer/v1/networks/${network}/contracts/${contractHash}/events`,
        );
        if (params.event_name)
          url.searchParams.set("event_name", params.event_name);
        if (params.limit) url.searchParams.set("limit", String(params.limit));
        if (params.offset)
          url.searchParams.set("offset", String(params.offset));
        if (params.tx_hash) url.searchParams.set("tx_hash", params.tx_hash);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            return {
              events: data.map((e: Record<string, unknown>) => ({
                id: e.id as string | number,
                event_name: e.event_name as string,
                state: e.state,
                tx_hash: e.txid as string,
                created_at: e.block_time as string,
                block_index: e.block_index as number,
              })),
              total: data.length,
            };
          }
        }
      } catch (e) {
        console.warn(
          "[useEvents] N3Index fetch failed, falling back to platform API:",
          e,
        );
      }
    }

    // Fallback to platform API
    return fetchEvents(params, platformApi);
  };

  /**
   * Wait for a specific event after a transaction.
   * Uses N3Index polling for decoded contract events.
   */
  const waitForEvent = async (
    txHash: string,
    eventName: string,
    appId: string,
    timeoutMs = 10_000,
    signal?: AbortSignal,
  ): Promise<ContractEvent | null> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) return null;
      const result = await list({
        app_id: appId,
        event_name: eventName,
        tx_hash: txHash,
        limit: 1,
      });
      if (result.events.length > 0) return result.events[0] ?? null;
      // Wait 2500ms or until signal fires, whichever comes first
      let aborted = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onAbort = () => {
        aborted = true;
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      await new Promise((r) => {
        timer = setTimeout(r, 2500);
        const onAbortResolve = () => {
          aborted = true;
          r(null);
        };
        signal?.addEventListener("abort", onAbortResolve, { once: true });
      });
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (aborted) return null;
    }
    return null;
  };

  return { list, waitForEvent };
}

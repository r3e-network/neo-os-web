/**
 * Thin Abstract Account integration client for MiniApps.
 *
 * This shared layer now only keeps the capabilities that are genuinely
 * reused across miniapps today:
 * - GAS sponsorship checks/requests
 * - relay submission for AA user operations
 *
 * Session-key configuration stays in the AA miniapp itself because it is an
 * on-chain verifier-plugin mutation, not a generic host SDK concern.
 */
import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import {
  getExternalIntegrationConfig,
  getNetwork,
  type NeoNetwork,
} from "../constants/rpc";
import { MiniAppError } from "../utils/errorHandling";

// Error codes for i18n-compatible error handling
const ERROR_CODE_GAS_SPONSORSHIP_CHECK = "AA_GAS_SPONSORSHIP_CHECK_FAILED";
const ERROR_CODE_GAS_SPONSORSHIP_REQUEST = "AA_GAS_SPONSORSHIP_REQUEST_FAILED";
const ERROR_CODE_RELAY_SUBMISSION = "AA_RELAY_SUBMISSION_FAILED";

type TokenResolver = () => string | Promise<string | undefined> | undefined;

type GasSponsorClientLike = {
  check: () => Promise<GasSponsorCheckResponse>;
  request: (amount: string) => Promise<GasSponsorRequestResponse>;
};

type MiniAppSDKLike = {
  gasSponsor?: GasSponsorClientLike;
};

export interface AAConfig {
  network?: NeoNetwork;
  edgeBaseUrl?: string;
  relayUrl?: string;
  paymasterDappId?: string;
  aaAddress?: string;
  sdk?: MiniAppSDKLike;
  getAuthToken?: TokenResolver;
  getAPIKey?: TokenResolver;
}

export interface GasSponsorCheckResponse {
  eligible: boolean;
  gas_balance: string;
  daily_limit: string;
  used_today: string;
  remaining: string;
  resets_at: string;
}

export interface GasSponsorRequestResponse {
  request_id: string;
  amount: string;
  status: string;
  tx_hash: string | null;
}

export interface AARelayPayload {
  metaInvocation?: Record<string, unknown>;
  rawTransaction?: string;
  paymaster?: Record<string, unknown>;
  simulate?: boolean;
  [key: string]: unknown;
}

export interface AARelayResponse {
  txid?: string;
  networkFee?: string;
  systemFee?: string;
  invocation?: {
    scriptHash?: string;
    operation?: string;
  };
  paymaster?: Record<string, unknown>;
  [key: string]: unknown;
}

function getWindowMiniAppSDK(): MiniAppSDKLike | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window as Window & { MiniAppSDK?: MiniAppSDKLike };
  return host.MiniAppSDK;
}

function normalizeUrl(raw: string | undefined, fallback = ""): string {
  const value = String(raw ?? "").trim();
  if (!value) return fallback;
  return value.replace(/\/$/, "");
}

async function resolveToken(resolver?: TokenResolver): Promise<string | undefined> {
  if (!resolver) return undefined;
  const value = await resolver();
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

async function requestJson<T>(
  url: string,
  options: {
    method: "GET" | "POST";
    body?: Record<string, unknown>;
    getAuthToken?: TokenResolver;
    getAPIKey?: TokenResolver;
  },
): Promise<T> {
  const headers = new Headers();
  if (options.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  const authToken = await resolveToken(options.getAuthToken);
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const apiKey = await resolveToken(options.getAPIKey);
  if (apiKey) headers.set("X-API-Key", apiKey);

  const response = await fetch(url, {
    method: options.method,
    headers,
    credentials: "include",
    ...(options.body ? { body: (() => { try { return JSON.stringify(options.body); } catch { return String(options.body); } })() } : {}),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `${options.method} ${url} failed (${response.status})`);
  }

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (_e) {
    throw new Error(`invalid JSON response from ${url}`);
  }
}

export function useAbstractAccount(config: AAConfig = {}) {
  const network = config.network ?? getNetwork();
  const integration = getExternalIntegrationConfig(network);
  const edgeBaseUrl = normalizeUrl(config.edgeBaseUrl, "/api/rpc");
  const relayUrl = normalizeUrl(config.relayUrl, "/api/aa/relay");
  const sdk = config.sdk ?? getWindowMiniAppSDK();

  const aaAddress: Observable<string | null> = createObservable<string | null>(String(config.aaAddress ?? "").trim() || null);
  const isCheckingSponsorship: Observable<boolean> = createObservable(false);
  const isRelaying: Observable<boolean> = createObservable(false);
  const lastRelayResponse: Observable<AARelayResponse | null> = createObservable<AARelayResponse | null>(null);
  const error: Observable<string | null> = createObservable<string | null>(null);

  const setAAAddress = (address: string | null | undefined) => {
    const next = String(address ?? "").trim();
    aaAddress.set(next || null);
  };

  const checkGasSponsorship = async (): Promise<GasSponsorCheckResponse> => {
    isCheckingSponsorship.set(true);
    error.set(null);
    try {
      if (sdk?.gasSponsor?.check) {
        return await sdk.gasSponsor.check();
      }
      return await requestJson<GasSponsorCheckResponse>(`${edgeBaseUrl}/gas-sponsor-check`, {
        method: "GET",
        getAuthToken: config.getAuthToken,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gas sponsorship check failed";
      error.set(msg);
      throw new MiniAppError(msg, ERROR_CODE_GAS_SPONSORSHIP_CHECK, undefined, undefined, undefined, ERROR_CODE_GAS_SPONSORSHIP_CHECK);
    } finally {
      isCheckingSponsorship.set(false);
      error.set(null);
    }
  };

  const requestGasSponsorship = async (amount: string): Promise<GasSponsorRequestResponse> => {
    isCheckingSponsorship.set(true);
    error.set(null);
    try {
      if (sdk?.gasSponsor?.request) {
        return await sdk.gasSponsor.request(amount);
      }
      return await requestJson<GasSponsorRequestResponse>(`${edgeBaseUrl}/gas-sponsor-request`, {
        method: "POST",
        body: { amount },
        getAuthToken: config.getAuthToken,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gas sponsorship request failed";
      error.set(msg);
      throw new MiniAppError(msg, ERROR_CODE_GAS_SPONSORSHIP_REQUEST, undefined, undefined, undefined, ERROR_CODE_GAS_SPONSORSHIP_REQUEST);
    } finally {
      isCheckingSponsorship.set(false);
      error.set(null);
    }
  };

  const buildPaymasterConfig = (dappId = config.paymasterDappId): Record<string, unknown> | undefined => {
    const clean = String(dappId ?? "").trim();
    if (!clean) return undefined;
    return { dapp_id: clean, network };
  };

  const submitRelayTransaction = async (payload: AARelayPayload): Promise<AARelayResponse> => {
    if (!relayUrl) {
      throw new Error("AA relay URL is not configured");
    }

    isRelaying.set(true);
    error.set(null);
    try {
      const paymaster = payload.paymaster ?? buildPaymasterConfig();
      const response = await requestJson<AARelayResponse>(relayUrl, {
        method: "POST",
        body: {
          ...payload,
          ...(paymaster ? { paymaster } : {}),
        },
        getAuthToken: config.getAuthToken,
        getAPIKey: config.getAPIKey,
      });

      lastRelayResponse.set(response);
      return response;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AA relay submission failed";
      error.set(msg);
      throw new MiniAppError(msg, ERROR_CODE_RELAY_SUBMISSION, undefined, undefined, undefined, ERROR_CODE_RELAY_SUBMISSION);
    } finally {
      isRelaying.set(false);
      error.set(null);
    }
  };

  return {
    integration,
    network,
    edgeBaseUrl,
    relayUrl,

    AA_MASTER_CONTRACT_MAINNET: getExternalIntegrationConfig("mainnet").contracts.aaCore,
    AA_MASTER_CONTRACT_TESTNET: getExternalIntegrationConfig("testnet").contracts.aaCore,
    RELAY_ENDPOINT: relayUrl,

    aaAddress,
    isCheckingSponsorship,
    isRelaying,
    lastRelayResponse,
    error,

    setAAAddress,
    checkGasSponsorship,
    requestGasSponsorship,
    buildPaymasterConfig,
    submitRelayTransaction,
  };
}

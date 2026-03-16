/**
 * Abstract Account integration composable for Neo N3 MiniApps.
 *
 * This composable does not try to replace `neo-abstract-account`.
 * It gives the MiniApp platform a thin, accurate integration layer for:
 * - canonical AA contract / verifier / domain discovery
 * - GAS sponsorship checks via the platform gateway
 * - relay submission into an external AA relay
 * - session metadata hydration for UX state
 *
 * The actual Web3Auth login, `executeUserOp` construction, verifier updates,
 * and on-chain AA lifecycle continue to live in the dedicated AA project.
 */
import { computed, ref } from "vue";
import {
  getExternalIntegrationConfig,
  getNetwork,
  type NeoNetwork,
} from "../constants/rpc";

type MaybePromise<T> = T | Promise<T>;

type TokenResolver = () => MaybePromise<string | undefined>;

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
  resolveAAAddress?: (provider: "google" | "twitter" | "github") => MaybePromise<string>;
  registerSessionKey?: (params: RegisterSessionKeyParams) => MaybePromise<SessionKey>;
}

export interface RegisterSessionKeyParams {
  aaAddress: string;
  sessionKeyVerifierHash?: string;
  scope: {
    contractHash: string;
    allowedMethods: string[];
  };
  maxInvocations: number;
  expiresAt: number;
}

export interface SessionKey {
  address: string;
  publicKey?: string;
  expiresAt: number;
  remainingInvocations: number;
  isValid: boolean;
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
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
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
  } catch {
    throw new Error(`invalid JSON response from ${url}`);
  }
}

export function useAbstractAccount(config: AAConfig = {}) {
  const network = config.network ?? getNetwork();
  const integration = getExternalIntegrationConfig(network);
  const edgeBaseUrl = normalizeUrl(config.edgeBaseUrl, "/api/rpc");
  const relayUrl = normalizeUrl(config.relayUrl, "/api/aa/relay");
  const sdk = config.sdk ?? getWindowMiniAppSDK();

  const aaAddress = ref<string | null>(String(config.aaAddress ?? "").trim() || null);
  const sessionKey = ref<SessionKey | null>(null);
  const isInitializing = ref(false);
  const isCheckingSponsorship = ref(false);
  const isRelaying = ref(false);
  const lastRelayResponse = ref<AARelayResponse | null>(null);
  const error = ref<string | null>(null);

  const isAAEnabled = computed(() => Boolean(aaAddress.value));
  const hasActiveSession = computed(
    () => Boolean(
      sessionKey.value
      && sessionKey.value.isValid
      && sessionKey.value.remainingInvocations > 0
      && sessionKey.value.expiresAt > Math.floor(Date.now() / 1000),
    ),
  );
  const canUseGasSponsoring = computed(() => Boolean(config.paymasterDappId));

  const setAAAddress = (address: string | null | undefined) => {
    const next = String(address ?? "").trim();
    aaAddress.value = next || null;
  };

  const hydrateSessionKey = (value: SessionKey | null) => {
    sessionKey.value = value;
  };

  const initWithSocialLogin = async (provider: "google" | "twitter" | "github") => {
    isInitializing.value = true;
    error.value = null;
    try {
      if (config.resolveAAAddress) {
        const address = await config.resolveAAAddress(provider);
        setAAAddress(address);
        return address;
      }

      if (aaAddress.value) {
        return aaAddress.value;
      }

      throw new Error(
        "AA address resolver is not configured. Wire this MiniApp to neo-abstract-account or the host Web3Auth flow.",
      );
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "AA initialization failed";
      throw e;
    } finally {
      isInitializing.value = false;
    }
  };

  const createSessionKey = async (
    scope: { contractHash: string; allowedMethods: string[] },
    maxInvocations = 100,
  ): Promise<SessionKey> => {
    if (!aaAddress.value) {
      throw new Error("AA address not initialized");
    }
    if (!config.registerSessionKey) {
      throw new Error(
        "Session key registration is not configured. Use neo-abstract-account to produce the on-chain session key and hydrate it here.",
      );
    }

    try {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const created = await config.registerSessionKey({
        aaAddress: aaAddress.value,
        sessionKeyVerifierHash: integration.contracts.aaSessionKeyVerifier,
        scope,
        maxInvocations,
        expiresAt,
      });
      sessionKey.value = created;
      return created;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "Session key creation failed";
      throw e;
    }
  };

  const checkGasSponsorship = async (): Promise<GasSponsorCheckResponse> => {
    isCheckingSponsorship.value = true;
    error.value = null;
    try {
      if (sdk?.gasSponsor?.check) {
        return await sdk.gasSponsor.check();
      }
      return await requestJson<GasSponsorCheckResponse>(`${edgeBaseUrl}/gas-sponsor-check`, {
        method: "GET",
        getAuthToken: config.getAuthToken,
      });
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "Gas sponsorship check failed";
      throw e;
    } finally {
      isCheckingSponsorship.value = false;
    }
  };

  const requestGasSponsorship = async (amount: string): Promise<GasSponsorRequestResponse> => {
    isCheckingSponsorship.value = true;
    error.value = null;
    try {
      if (sdk?.gasSponsor?.request) {
        return await sdk.gasSponsor.request(amount);
      }
      return await requestJson<GasSponsorRequestResponse>(`${edgeBaseUrl}/gas-sponsor-request`, {
        method: "POST",
        body: { amount },
        getAuthToken: config.getAuthToken,
      });
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "Gas sponsorship request failed";
      throw e;
    } finally {
      isCheckingSponsorship.value = false;
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

    isRelaying.value = true;
    error.value = null;
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

      lastRelayResponse.value = response;
      if (sessionKey.value) {
        sessionKey.value.remainingInvocations = Math.max(0, sessionKey.value.remainingInvocations - 1);
        sessionKey.value.isValid = sessionKey.value.remainingInvocations > 0;
      }
      return response;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "AA relay submission failed";
      throw e;
    } finally {
      isRelaying.value = false;
    }
  };

  // Backwards-compatible alias for existing examples.
  const executeWithSession = submitRelayTransaction;

  const revokeSession = async () => {
    sessionKey.value = null;
  };

  return {
    integration,
    network,
    edgeBaseUrl,
    relayUrl,

    // Canonical external deployment metadata.
    AA_MASTER_CONTRACT_MAINNET: getExternalIntegrationConfig("mainnet").contracts.aaCore,
    AA_MASTER_CONTRACT_TESTNET: getExternalIntegrationConfig("testnet").contracts.aaCore,
    RELAY_ENDPOINT: relayUrl,

    // State
    isAAEnabled,
    aaAddress,
    sessionKey,
    isInitializing,
    isCheckingSponsorship,
    isRelaying,
    lastRelayResponse,
    error,

    // Computed
    hasActiveSession,
    canUseGasSponsoring,

    // Actions
    setAAAddress,
    hydrateSessionKey,
    initWithSocialLogin,
    createSessionKey,
    checkGasSponsorship,
    requestGasSponsorship,
    buildPaymasterConfig,
    submitRelayTransaction,
    executeWithSession,
    revokeSession,
  };
}

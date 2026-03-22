/**
 * Morpheus Oracle / DataFeed / Compute integration composable for Neo N3 MiniApps.
 *
 * This composable is the MiniApp-platform-facing wrapper around the extracted
 * `neo-morpheus-oracle` stack. It intentionally does not re-implement the
 * oracle runtime; it routes requests through:
 * - the host-injected `window.MiniAppSDK` when available
 * - the MiniApp platform edge gateway (`/api/rpc` by default)
 * - optional host-only API key flows for direct Oracle / Compute access
 *
 * Supported paths:
 * - RNG: `rng-request`
 * - DataFeed price reads: `datafeed-price`
 * - Host-only allowlisted HTTP Oracle: `oracle-query`
 * - Host-only inline confidential compute: `compute-execute`
 * - Host-only registered-script compute: `compute-app-execute`
 *
 * This composable is intentionally focused on the preferred direct Oracle path.
 * Legacy on-chain callback gateways are outside the primary MiniApp runtime path.
 */
import { computed, ref } from "vue";
import {
  getExternalIntegrationConfig,
  getNetwork,
  type NeoNetwork,
} from "../constants/rpc";
import { MiniAppError } from "../utils/errorHandling";

// Error codes for i18n-compatible error handling
const ERROR_CODE_RNG_FAILED = "ORACLE_RNG_FAILED";
const ERROR_CODE_DATA_FEED_FAILED = "ORACLE_DATA_FEED_FAILED";
const ERROR_CODE_ORACLE_QUERY_FAILED = "ORACLE_QUERY_FAILED";
const ERROR_CODE_COMPUTE_EXECUTION_FAILED = "ORACLE_COMPUTE_EXECUTION_FAILED";
const ERROR_CODE_REGISTERED_COMPUTE_FAILED = "ORACLE_REGISTERED_COMPUTE_FAILED";
const ERROR_CODE_NEODID_RESOLUTION_FAILED = "ORACLE_NEODID_RESOLUTION_FAILED";
const ERROR_CODE_NEODID_PROVIDERS_FAILED = "ORACLE_NEODID_PROVIDERS_FAILED";
const ERROR_CODE_ORACLE_PUBLIC_KEY_FAILED = "ORACLE_PUBLIC_KEY_FAILED";
const ERROR_CODE_CONFIDENTIAL_STORE_FAILED = "ORACLE_CONFIDENTIAL_STORE_FAILED";

type MaybePromise<T> = T | Promise<T>;

type TokenResolver = () => MaybePromise<string | undefined>;

type MiniAppSDKLike = {
  rng?: {
    requestRandom: (appId: string) => Promise<Record<string, unknown>>;
  };
  datafeed?: {
    getPrice: (symbol: string) => Promise<Record<string, unknown>>;
  };
};

type HostOracleLike = {
  query: (params: OracleQueryRequest) => Promise<OracleQueryResponse>;
};

type HostComputeLike = {
  execute: (params: ComputeExecuteRequest) => Promise<Record<string, unknown>>;
};

type HostSDKLike = {
  oracle?: HostOracleLike;
  compute?: HostComputeLike;
};

export interface OracleQueryRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  secret_name?: string;
  secret_as_key?: string;
  body?: string;
}

export interface OracleQueryResponse {
  status_code: number;
  headers: Record<string, string>;
  body: string;
}

export interface NeoDidResolveResponse {
  [key: string]: unknown;
}

export interface NeoDidProvidersResponse {
  [key: string]: unknown;
}

export interface OraclePublicKeyResponse {
  network: string;
  source?: string;
  contract?: string;
  rpc_url?: string;
  algorithm: string;
  public_key: string;
  public_key_format?: string;
}

export interface ConfidentialStoreRequest {
  ciphertext: string;
  name?: string;
  project_slug?: string;
  requester_script_hash?: string;
  callback_contract?: string;
  metadata?: Record<string, unknown>;
}

export interface ConfidentialStoreResponse {
  secret_ref: string;
  network: string;
  name: string;
  target_chain: string;
  encryption_algorithm: string;
  created_at?: string;
  bound_requester?: string;
  bound_callback_contract?: string;
}

export interface ComputeExecuteRequest {
  script: string;
  entry_point?: string;
  input?: Record<string, unknown>;
  secret_refs?: string[];
  timeout?: number;
}

export interface RegisteredComputeRequest {
  appId?: string;
  scriptName: string;
  input?: Record<string, unknown>;
  secretRefs?: string[];
  timeout?: number;
}

export interface ComputeJobResult {
  job_id?: string;
  status?: string;
  output?: Record<string, unknown>;
  logs?: string[];
  error?: string;
  gas_used?: number;
  started_at?: string;
  duration?: string;
  encrypted_output?: string;
  output_hash?: string;
  signature?: string;
  attestation?: string;
  [key: string]: unknown;
}

export interface OracleConfig {
  network?: NeoNetwork;
  appId?: string;
  edgeBaseUrl?: string;
  getAuthToken?: TokenResolver;
  getAPIKey?: TokenResolver;
  sdk?: MiniAppSDKLike;
  hostSdk?: HostSDKLike;
}

export interface VRFResult {
  value: string;
  proof: string;
  requestId: string;
  blockNumber: number;
  publicKey?: string;
  attestationHash?: string;
  raw?: Record<string, unknown>;
}

export interface TEEResult<T = unknown> {
  result: T;
  attestation: string;
  verified: boolean;
  raw?: Record<string, unknown>;
}

function getWindowMiniAppSDK(): MiniAppSDKLike | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window as Window & { MiniAppSDK?: MiniAppSDKLike };
  return host.MiniAppSDK;
}

function normalizeEdgeBaseUrl(raw?: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "/api/rpc";
  return value.replace(/\/$/, "");
}

function mapAssetToSymbol(asset: string): string {
  const normalized = String(asset ?? "").trim().toUpperCase();
  if (!normalized) throw new Error("asset is required");
  if (normalized.includes("/")) return normalized.replace("/", "-");
  if (normalized.includes("-")) return normalized;
  return `${normalized}-USD`;
}

async function resolveToken(resolver?: TokenResolver): Promise<string | undefined> {
  if (!resolver) return undefined;
  const value = await resolver();
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

async function requestEdgeJSON<T>(
  baseUrl: string,
  path: string,
  options: {
    method: "GET" | "POST";
    body?: Record<string, unknown>;
    getAuthToken?: TokenResolver;
    getAPIKey?: TokenResolver;
  },
): Promise<T> {
  const url = `${normalizeEdgeBaseUrl(baseUrl)}${path.startsWith("/") ? "" : "/"}${path}`;
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
    throw new Error(text || `${options.method} ${path} failed (${response.status})`);
  }

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (_e: unknown) {
    throw new Error(`invalid JSON response from ${path}`);
  }
}

async function requestExternalJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "omit",
    headers: {
      accept: "application/json, application/did+ld+json, application/ld+json",
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `GET ${url} failed (${response.status})`);
  }

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (_e: unknown) {
    throw new Error(`invalid JSON response from ${url}`);
  }
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
  } catch (_e: unknown) {
    throw new Error(`invalid JSON response from ${url}`);
  }
}

export function useOracle(config: OracleConfig = {}) {
  const network = config.network ?? getNetwork();
  const integration = getExternalIntegrationConfig(network);
  const edgeBaseUrl = normalizeEdgeBaseUrl(config.edgeBaseUrl);
  const sdk = config.sdk ?? getWindowMiniAppSDK();

  const isRequesting = ref(false);
  const error = ref<string | null>(null);
  const lastRandom = ref<VRFResult | null>(null);
  const lastComputeResult = ref<ComputeJobResult | null>(null);

  const isOracleAvailable = computed(
    () => Boolean(sdk?.rng || sdk?.datafeed || config.hostSdk?.oracle || edgeBaseUrl),
  );

  const requestRandomness = async (_requestLabel?: string): Promise<VRFResult> => {
    const appId = String(config.appId ?? "").trim();
    if (!appId) {
      throw new Error("appId is required for RNG requests");
    }

    isRequesting.value = true;
    error.value = null;
    try {
      const response = sdk?.rng
        ? await sdk.rng.requestRandom(appId)
        : await requestEdgeJSON<Record<string, unknown>>(edgeBaseUrl, "/rng-request", {
            method: "POST",
            body: { app_id: appId },
            getAuthToken: config.getAuthToken,
          });

      const result: VRFResult = {
        value: String(response.randomness ?? ""),
        proof: String(response.signature ?? ""),
        requestId: String(response.request_id ?? ""),
        blockNumber: 0,
        publicKey: String(response.public_key ?? "") || undefined,
        attestationHash: String(response.attestation_hash ?? "") || undefined,
        raw: response,
      };
      lastRandom.value = result;
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "RNG request failed";
      error.value = msg;
      throw new MiniAppError(msg, ERROR_CODE_RNG_FAILED, undefined, undefined, undefined, ERROR_CODE_RNG_FAILED);
    } finally {
      isRequesting.value = false;
      error.value = null;
    }
  };

  const getPrice = async (asset: "NEO" | "GAS" | string): Promise<number> => {
    error.value = null;
    try {
      const symbol = mapAssetToSymbol(asset);
      const response = sdk?.datafeed
        ? await sdk.datafeed.getPrice(symbol)
        : await requestEdgeJSON<Record<string, unknown>>(edgeBaseUrl, `/datafeed-price?symbol=${encodeURIComponent(symbol)}`, {
            method: "GET",
            getAuthToken: config.getAuthToken,
          });

      const price = Number.parseFloat(String(response.price ?? "0"));
      if (!Number.isFinite(price)) {
        throw new Error(`invalid price response for ${symbol}`);
      }
      return price;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "DataFeed request failed";
      error.value = msg;
      throw new MiniAppError(msg, ERROR_CODE_DATA_FEED_FAILED, undefined, undefined, undefined, ERROR_CODE_DATA_FEED_FAILED);
    } finally {
      error.value = null;
    }
  };

  const queryAllowlistedUrl = async (params: OracleQueryRequest): Promise<OracleQueryResponse> => {
    isRequesting.value = true;
    error.value = null;
    try {
      if (config.hostSdk?.oracle?.query) {
        return await config.hostSdk.oracle.query(params);
      }
      return await requestEdgeJSON<OracleQueryResponse>(edgeBaseUrl, "/oracle-query", {
        method: "POST",
        body: {
          url: params.url,
          method: params.method,
          headers: params.headers,
          secret_name: params.secret_name,
          secret_as_key: params.secret_as_key,
          body: params.body,
        },
        getAuthToken: config.getAuthToken,
        getAPIKey: config.getAPIKey,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Oracle query failed";
      error.value = msg;
      throw new MiniAppError(msg, ERROR_CODE_ORACLE_QUERY_FAILED, undefined, undefined, undefined, ERROR_CODE_ORACLE_QUERY_FAILED);
    } finally {
      isRequesting.value = false;
      error.value = null;
    }
  };

  const executeTEE = async <T = unknown>(params: ComputeExecuteRequest): Promise<TEEResult<T>> => {
    isRequesting.value = true;
    error.value = null;
    try {
      const response = config.hostSdk?.compute?.execute
        ? await config.hostSdk.compute.execute(params)
        : await requestEdgeJSON<Record<string, unknown>>(edgeBaseUrl, "/compute-execute", {
            method: "POST",
            body: {
              script: params.script,
              entry_point: params.entry_point,
              input: params.input,
              secret_refs: params.secret_refs,
              timeout: params.timeout,
            },
            getAuthToken: config.getAuthToken,
            getAPIKey: config.getAPIKey,
          });

      lastComputeResult.value = response as ComputeJobResult;
      return {
        result: (response.output ?? response.result ?? response) as T,
        attestation: String(response.attestation ?? ""),
        verified: Boolean(response.attestation || response.signature || response.output_hash),
        raw: response,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Compute execution failed";
      error.value = msg;
      throw new MiniAppError(msg, ERROR_CODE_COMPUTE_EXECUTION_FAILED, undefined, undefined, undefined, ERROR_CODE_COMPUTE_EXECUTION_FAILED);
    } finally {
      isRequesting.value = false;
    }
  };

  const executeRegisteredScript = async <T = unknown>(params: RegisteredComputeRequest): Promise<TEEResult<T>> => {
    const appId = String(params.appId ?? config.appId ?? "").trim();
    if (!appId) {
      throw new Error("appId is required for registered compute execution");
    }

    isRequesting.value = true;
    error.value = null;
    try {
      const response = await requestEdgeJSON<Record<string, unknown>>(edgeBaseUrl, "/compute-app-execute", {
        method: "POST",
        body: {
          app_id: appId,
          script_name: params.scriptName,
          input: params.input,
          secret_refs: params.secretRefs,
          timeout: params.timeout,
        },
        getAuthToken: config.getAuthToken,
        getAPIKey: config.getAPIKey,
      });

      lastComputeResult.value = response as ComputeJobResult;
      return {
        result: (response.output ?? response.result ?? response) as T,
        attestation: String(response.attestation ?? ""),
        verified: Boolean(response.attestation || response.signature || response.output_hash),
        raw: response,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registered compute execution failed";
      error.value = msg;
      throw new MiniAppError(msg, ERROR_CODE_REGISTERED_COMPUTE_FAILED, undefined, undefined, undefined, ERROR_CODE_REGISTERED_COMPUTE_FAILED);
    } finally {
      isRequesting.value = false;
      error.value = null;
    }
  };

  const resolveNeoDid = async (did: string, format?: "resolution" | "document"): Promise<NeoDidResolveResponse> => {
    const trimmedDid = String(did ?? "").trim();
    if (!trimmedDid) {
      throw new Error("did is required");
    }

    isRequesting.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      params.set("did", trimmedDid);
      params.set("network", network);
      if (format === "document") params.set("format", "document");
      return await requestExternalJson<NeoDidResolveResponse>(`/api/morpheus/neodid/resolve?${params.toString()}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "NeoDID resolution failed";
      error.value = msg;
      throw new MiniAppError(msg, ERROR_CODE_NEODID_RESOLUTION_FAILED, undefined, undefined, undefined, ERROR_CODE_NEODID_RESOLUTION_FAILED);
    } finally {
      isRequesting.value = false;
      error.value = null;
    }
  };

  const getNeoDidProviders = async (): Promise<NeoDidProvidersResponse> => {
    isRequesting.value = true;
    error.value = null;
    try {
      return await requestExternalJson<NeoDidProvidersResponse>(`/api/morpheus/neodid/providers?network=${encodeURIComponent(network)}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "NeoDID providers request failed";
      error.value = msg;
      throw new MiniAppError(msg, ERROR_CODE_NEODID_PROVIDERS_FAILED, undefined, undefined, undefined, ERROR_CODE_NEODID_PROVIDERS_FAILED);
    } finally {
      isRequesting.value = false;
      error.value = null;
    }
  };

  const getOraclePublicKey = async (): Promise<OraclePublicKeyResponse> => {
    isRequesting.value = true;
    error.value = null;
    try {
      return await requestExternalJson<OraclePublicKeyResponse>(
        `/api/morpheus/oracle/public-key?network=${encodeURIComponent(network)}`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Oracle public key request failed";
      error.value = msg;
      throw new MiniAppError(msg, ERROR_CODE_ORACLE_PUBLIC_KEY_FAILED, undefined, undefined, undefined, ERROR_CODE_ORACLE_PUBLIC_KEY_FAILED);
    } finally {
      isRequesting.value = false;
      error.value = null;
    }
  };

  const storeConfidentialCiphertext = async (params: ConfidentialStoreRequest): Promise<ConfidentialStoreResponse> => {
    isRequesting.value = true;
    error.value = null;
    try {
      return await requestJson<ConfidentialStoreResponse>("/api/morpheus/confidential/store", {
        method: "POST",
        body: {
          ciphertext: params.ciphertext,
          target_chain: "neo_n3",
          network,
          name: params.name,
          project_slug: params.project_slug,
          requester_script_hash: params.requester_script_hash,
          callback_contract: params.callback_contract,
          metadata: params.metadata,
        },
        getAuthToken: config.getAuthToken,
        getAPIKey: config.getAPIKey,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Confidential store request failed";
      error.value = msg;
      throw new MiniAppError(msg, ERROR_CODE_CONFIDENTIAL_STORE_FAILED, undefined, undefined, undefined, ERROR_CODE_CONFIDENTIAL_STORE_FAILED);
    } finally {
      isRequesting.value = false;
      error.value = null;
    }
  };

  return {
    integration,
    network,
    edgeBaseUrl,

    // Canonical external deployment metadata - computed once at creation.
    ORACLE_CONTRACT_MAINNET: getExternalIntegrationConfig("mainnet").contracts.morpheusOracle,
    ORACLE_CONTRACT_TESTNET: getExternalIntegrationConfig("testnet").contracts.morpheusOracle,
    DATA_FEED_CONTRACT_MAINNET: getExternalIntegrationConfig("mainnet").contracts.morpheusDatafeed,
    MORPHEUS_PUBLIC_API_MAINNET: getExternalIntegrationConfig("mainnet").morpheusPublicApiUrl,
    MORPHEUS_PUBLIC_API_TESTNET: getExternalIntegrationConfig("testnet").morpheusPublicApiUrl,

    // State
    isOracleAvailable,
    isRequesting,
    error,
    lastRandom,
    lastComputeResult,

    // Actions
    requestRandomness,
    getPrice,
    queryAllowlistedUrl,
    executeTEE,
    executeRegisteredScript,
    resolveNeoDid,
    getNeoDidProviders,
    getOraclePublicKey,
    storeConfidentialCiphertext,
  };
}

/**
 * Internal shared utilities for the Oracle composable family.
 *
 * Not intended for direct consumption by miniapps — use useOracle or
 * the focused composables (useVRF, useDataFeed, useOracleQuery, useCompute).
 */
import type { NeoNetwork } from "../constants/rpc";
import { MiniAppError } from "../utils/errorHandling";

// ── Error codes (i18n-compatible) ──────────────────────────────────────────

export const ERROR_CODE_RNG_FAILED = "ORACLE_RNG_FAILED";
export const ERROR_CODE_DATA_FEED_FAILED = "ORACLE_DATA_FEED_FAILED";
export const ERROR_CODE_ORACLE_QUERY_FAILED = "ORACLE_QUERY_FAILED";
export const ERROR_CODE_COMPUTE_EXECUTION_FAILED = "ORACLE_COMPUTE_EXECUTION_FAILED";
export const ERROR_CODE_REGISTERED_COMPUTE_FAILED = "ORACLE_REGISTERED_COMPUTE_FAILED";
export const ERROR_CODE_NEODID_RESOLUTION_FAILED = "ORACLE_NEODID_RESOLUTION_FAILED";
export const ERROR_CODE_NEODID_PROVIDERS_FAILED = "ORACLE_NEODID_PROVIDERS_FAILED";
export const ERROR_CODE_ORACLE_PUBLIC_KEY_FAILED = "ORACLE_PUBLIC_KEY_FAILED";
export const ERROR_CODE_CONFIDENTIAL_STORE_FAILED = "ORACLE_CONFIDENTIAL_STORE_FAILED";

// ── Utility types ──────────────────────────────────────────────────────────

export type MaybePromise<T> = T | Promise<T>;

export type TokenResolver = () => MaybePromise<string | undefined>;

export type MiniAppSDKLike = {
  rng?: {
    requestRandom: (appId: string) => Promise<Record<string, unknown>>;
  };
  datafeed?: {
    getPrice: (symbol: string) => Promise<Record<string, unknown>>;
  };
};

export type HostOracleLike = {
  query: (params: OracleQueryRequest) => Promise<OracleQueryResponse>;
};

export type HostComputeLike = {
  execute: (params: ComputeExecuteRequest) => Promise<Record<string, unknown>>;
};

export type HostSDKLike = {
  oracle?: HostOracleLike;
  compute?: HostComputeLike;
};

// ── Public interfaces ──────────────────────────────────────────────────────

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

// ── Helper functions ───────────────────────────────────────────────────────

export function getWindowMiniAppSDK(): MiniAppSDKLike | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window as Window & { MiniAppSDK?: MiniAppSDKLike };
  return host.MiniAppSDK;
}

export function normalizeEdgeBaseUrl(raw?: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "/api/rpc";
  return value.replace(/\/$/, "");
}

export function mapAssetToSymbol(asset: string): string {
  const normalized = String(asset ?? "").trim().toUpperCase();
  if (!normalized) throw new Error("asset is required");
  if (normalized.includes("/")) return normalized.replace("/", "-");
  if (normalized.includes("-")) return normalized;
  return `${normalized}-USD`;
}

export async function resolveToken(resolver?: TokenResolver): Promise<string | undefined> {
  if (!resolver) return undefined;
  const value = await resolver();
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

export async function requestEdgeJSON<T>(
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
  } catch (_e) {
    throw new Error(`invalid JSON response from ${path}`);
  }
}

export async function requestExternalJson<T>(url: string): Promise<T> {
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
  } catch (_e) {
    throw new Error(`invalid JSON response from ${url}`);
  }
}

export async function requestJson<T>(
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

/** Wrap an error into a MiniAppError with the given code. */
export function toMiniAppError(e: unknown, fallbackMsg: string, code: string): MiniAppError {
  const msg = e instanceof Error ? e.message : fallbackMsg;
  return new MiniAppError(msg, code, undefined, undefined, undefined, code);
}

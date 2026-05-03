/**
 * Shared handler for OS service edge functions.
 * Standardizes auth, rate limiting, permission checks, and response format.
 *
 * Each OS edge function wraps a single contract operation behind:
 *   1. CORS preflight
 *   2. Auth (bearer JWT or API key)
 *   3. Rate limiting
 *   4. Scope enforcement
 *   5. App policy / permission check
 *   6. Body parsing + appId validation
 *   7. Handler execution
 */

import { handleCorsPreflight } from "./cors.ts";
import { getNeoRpcUrl } from "./k8s-config.ts";
import { readJsonBody } from "./request.ts";
import { error, json } from "./response.ts";
import { requireRateLimit } from "./ratelimit.ts";
import { requireScope } from "./scopes.ts";
import { addressToScriptHash } from "./neo.ts";
import { requireAuth, requirePrimaryWallet, type AuthContext } from "./supabase.ts";
import { fetchMiniAppPolicy, permissionEnabled, type MiniAppPolicy } from "./apps.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OSRequest = {
  appId: string;
  /** Neo script hash for the authenticated user's verified primary wallet. */
  userId: string;
  walletAddress: string;
  walletHash: string;
  params: Record<string, unknown>;
  auth: AuthContext;
  policy: MiniAppPolicy | null;
  req: Request;
};

export type OSHandlerResult = unknown;

export type OSHandlerFn = (osReq: OSRequest) => Promise<OSHandlerResult>;

export type OSHandlerOptions = {
  /** Edge function / scope name used for rate limiting and scope checks. */
  scopeName: string;
  /** Manifest permission key required (e.g. "storage", "payments"). Omit to skip. */
  permission?: string;
  /** HTTP method to accept. Defaults to "POST". */
  method?: "GET" | "POST";
  /** When true, adds Cache-Control headers for read-only responses. */
  cacheable?: boolean;
  /** Cache TTL in seconds (default 10). Only used when cacheable is true. */
  cacheTtl?: number;
};

// ---------------------------------------------------------------------------
// RPC helpers
// ---------------------------------------------------------------------------

type InvokeFunctionArg = { type: string; value: unknown };

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

function decodeBase64Bytes(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function stackBytes(item: Record<string, unknown>): Uint8Array {
  const value = String(item.value ?? "");
  if (item.type === "ByteString" || item.type === "Buffer") {
    try {
      return decodeBase64Bytes(value);
    } catch (_err) {
      return new TextEncoder().encode(value);
    }
  }
  if (item.type === "Integer") {
    let hex = BigInt(value || "0").toString(16);
    if (hex.length % 2 !== 0) hex = `0${hex}`;
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  return new Uint8Array();
}

function stackMapKey(item: unknown): string {
  const parsed = parseNeoStackValue(item);
  return typeof parsed === "string" ? parsed : String(parsed ?? "");
}

export function parseNeoStackValue(item: unknown): unknown {
  if (!item || typeof item !== "object") return item ?? null;
  const typed = item as Record<string, unknown>;
  const type = String(typed.type ?? "");

  switch (type) {
    case "Integer":
      return String(typed.value ?? "0");
    case "Boolean":
      return Boolean(typed.value);
    case "String":
    case "Hash160":
    case "Hash256":
      return String(typed.value ?? "");
    case "ByteString":
    case "Buffer":
    case "ByteArray": {
      const bytes = stackBytes(typed);
      const text = new TextDecoder().decode(bytes);
      if (/^[\x20-\x7E]*$/.test(text)) return text;
      if (bytes.length === 20) {
        return `0x${Array.from(bytes).reverse().map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      }
      return String(typed.value ?? "");
    }
    case "Array":
    case "Struct":
      return Array.isArray(typed.value) ? typed.value.map(parseNeoStackValue) : [];
    case "Map":
      if (!Array.isArray(typed.value)) return {};
      return Object.fromEntries(
        typed.value.map((entry) => {
          if (Array.isArray(entry) && entry.length === 2) {
            return [stackMapKey(entry[0]), parseNeoStackValue(entry[1])];
          }
          const record = entry as Record<string, unknown>;
          return [stackMapKey(record.key), parseNeoStackValue(record.value)];
        }),
      );
    default:
      return typed.value ?? null;
  }
}

export function parseInvokeResultValue(result: unknown): unknown {
  if (!result || typeof result !== "object") return result ?? null;
  const obj = result as Record<string, unknown>;
  const state = String(obj.state ?? "");
  if (state === "FAULT") {
    throw new Error(String(obj.exception ?? "contract invocation fault"));
  }
  if (!Array.isArray(obj.stack)) return result;
  if (obj.stack.length === 0) return null;
  if (obj.stack.length === 1) return parseNeoStackValue(obj.stack[0]);
  return obj.stack.map(parseNeoStackValue);
}

/**
 * Call an OS service contract method via Neo N3 RPC invokefunction.
 * Returns the result from the invocation (read-only / [Safe] methods).
 */
export async function invokeOSContract(
  contractHash: string,
  method: string,
  args: InvokeFunctionArg[],
): Promise<unknown> {
  const rpcUrl = getNeoRpcUrl();
  let res: Response;
  try {
    res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "invokefunction",
        params: [contractHash, method, args],
      }),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`RPC invokefunction "${method}" timed out after 10s`);
    }
    throw new Error(`RPC invokefunction "${method}" failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    throw new Error(`RPC request failed (${res.status})`);
  }

  const data: RpcResponse = await res.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }
  return data.result;
}

// ---------------------------------------------------------------------------
// Cached RPC reads (short TTL in-memory cache for [Safe] contract calls)
// ---------------------------------------------------------------------------

const invokeCache = new Map<string, { data: unknown; expires: number }>();
const INVOKE_CACHE_MAX = 200;
const INVOKE_CACHE_DEFAULT_TTL_MS = 10_000;

function evictExpiredInvokeCache() {
  const now = Date.now();
  for (const [k, v] of invokeCache) {
    if (v.expires < now) invokeCache.delete(k);
  }
}

/**
 * Cached variant of invokeOSContract for read-only [Safe] methods.
 * Results are held in memory for `ttlMs` (default 10 000 ms).
 */
export async function invokeOSContractCached(
  contractHash: string,
  method: string,
  args: InvokeFunctionArg[],
  ttlMs = INVOKE_CACHE_DEFAULT_TTL_MS,
): Promise<unknown> {
  const key = JSON.stringify([contractHash, method, args]);
  const cached = invokeCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;

  const result = await invokeOSContract(contractHash, method, args);
  invokeCache.set(key, { data: result, expires: Date.now() + ttlMs });

  if (invokeCache.size > INVOKE_CACHE_MAX) evictExpiredInvokeCache();

  return result;
}

/**
 * Build a wallet invocation intent for the frontend to sign and submit.
 * Returned to the frontend which then asks the wallet to sign + relay.
 */
export function buildInvocationIntent(
  contractHash: string,
  method: string,
  args: InvokeFunctionArg[],
) {
  return {
    contract: contractHash,
    operation: method,
    args,
  };
}

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

/**
 * Create a standard OS service edge function handler.
 *
 * Applies the full middleware chain (CORS, auth, rate limit, scope, policy)
 * then delegates to the provided `handlerFn`.
 */
export function createOSHandler(opts: OSHandlerOptions, handlerFn: OSHandlerFn) {
  const allowedMethod = opts.method ?? "POST";

  async function handler(req: Request): Promise<Response> {
    // CORS preflight
    const preflight = handleCorsPreflight(req);
    if (preflight) return preflight;

    if (req.method !== allowedMethod) {
      return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
    }

    // 1. Auth
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;

    // 2. Rate limit
    const rl = await requireRateLimit(req, opts.scopeName, auth);
    if (rl) return rl;

    // 3. Scope check
    const scopeCheck = requireScope(req, auth, opts.scopeName);
    if (scopeCheck) return scopeCheck;

    // 4. Parse body
    const bodyOrErr = await readJsonBody<Record<string, unknown>>(req);
    if (bodyOrErr instanceof Response) return bodyOrErr;
    const body = bodyOrErr;

    const appId = String(body.app_id ?? body.appId ?? "").trim();
    if (!appId) {
      return error(400, "app_id required", "APP_ID_REQUIRED", req);
    }

    const wallet = await requirePrimaryWallet(auth.userId, req);
    if (wallet instanceof Response) return wallet;

    let walletHash: string;
    try {
      walletHash = addressToScriptHash(wallet.address);
    } catch (_err) {
      return error(428, "valid primary Neo wallet binding required", "WALLET_INVALID", req);
    }

    // 5. App policy + optional permission gate
    const policyResult = await fetchMiniAppPolicy(appId, req);
    if (policyResult instanceof Response) return policyResult;
    const policy: MiniAppPolicy | null = policyResult;

    if (opts.permission && policy && !permissionEnabled(policy.permissions, opts.permission)) {
      return error(403, `app is not allowed to use ${opts.permission}`, "PERMISSION_DENIED", req);
    }

    // 6. Execute handler
    try {
      const result = await handlerFn({
        appId,
        userId: walletHash,
        walletAddress: wallet.address,
        walletHash,
        params: body,
        auth,
        policy,
        req,
      });

      const resInit: ResponseInit = {};
      if (opts.cacheable) {
        const ttl = opts.cacheTtl ?? 10;
        resInit.headers = new Headers({
          "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}`,
        });
      }
      return json({ ok: true, data: result }, resInit, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal error";
      console.error(`[${opts.scopeName}] handler error:`, message);

      if (message.includes("timed out")) {
        return error(504, message, "RPC_TIMEOUT", req);
      }
      if (message.startsWith("RPC")) {
        return error(502, message, "RPC_ERROR", req);
      }
      return error(500, message, "INTERNAL_ERROR", req);
    }
  }

  return handler;
}

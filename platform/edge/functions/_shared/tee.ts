import { getEnv, isProductionEnv } from "./env.ts";
import { error } from "./response.ts";

let mtlsClient: Deno.HttpClient | null | undefined;
let mtlsWarningLogged = false;
let mtlsStatusLogged = false;

function logMTLSStatus(message: string) {
  if (mtlsStatusLogged) return;
  console.log(`[TEE] ${message}`);
  mtlsStatusLogged = true;
}

/**
 * Audit fix H-7: explicit hostname allowlist.
 *
 * Previously this function suffix-matched `*.workers.dev`, which meant any
 * attacker-controlled `attacker.workers.dev` URL routed through `requestJSON`
 * would auto-attach `MORPHEUS_RUNTIME_TOKEN` / `NITRO_API_TOKEN` /
 * `NITRO_SHARED_SECRET` (with `PHALA_API_TOKEN` / `PHALA_SHARED_SECRET`
 * legacy fallbacks) Bearer credentials. The suffix wildcard has been
 * removed; additional hosts can be added via `TEE_PUBLIC_RUNTIME_HOSTS`
 * (comma-separated) at deploy time but never via a URL.
 */
function isPublicRuntimeHost(hostname: string) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase();
  if (!host) return false;
  const baseline = [
    "oracle.meshmini.app",
    "edge.meshmini.app",
    "control.meshmini.app",
  ];
  if (baseline.includes(host)) return true;
  const extra = (getEnv("TEE_PUBLIC_RUNTIME_HOSTS") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(host);
}

function canUsePublicRuntimeWithoutMTLS(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && isPublicRuntimeHost(parsed.hostname);
  } catch {
    return false;
  }
}

function maybeAttachRuntimeAuth(headers: Headers, url: string) {
  if (!canUsePublicRuntimeWithoutMTLS(url)) return;
  if (headers.get("authorization")) return;

  const token =
    getEnv("MORPHEUS_RUNTIME_TOKEN") ??
    getEnv("NITRO_API_TOKEN") ??
    getEnv("NITRO_SHARED_SECRET");
  if (!token) return;

  headers.set("authorization", `Bearer ${token}`);
  // Emit both the new and legacy runtime auth headers so the live runtime
  // (which may still read x-phala-token) keeps working during the cutover.
  headers.set("x-nitro-token", token);
  headers.set("x-phala-token", token);
}

function getMTLSClient(): Deno.HttpClient | undefined {
  if (mtlsClient !== undefined) return mtlsClient ?? undefined;

  const cert = getEnv("TEE_MTLS_CERT_PEM") ?? getEnv("EDGE_MTLS_CERT_PEM");
  const key = getEnv("TEE_MTLS_KEY_PEM") ?? getEnv("EDGE_MTLS_KEY_PEM");
  const ca = getEnv("TEE_MTLS_ROOT_CA_PEM") ?? getEnv("NITRO_ROOT_CA_PEM");

  if (!cert || !key) {
    mtlsClient = null;
    logMTLSStatus("mTLS disabled: missing client certificate or key.");
    // Log warning once in production mode
    if (!mtlsWarningLogged && isProductionEnv()) {
      console.warn(
        "[TEE] WARNING: mTLS not configured. TEE services requiring service authentication will fail. " +
          "Set TEE_MTLS_CERT_PEM, TEE_MTLS_KEY_PEM, and TEE_MTLS_ROOT_CA_PEM for production.",
      );
      mtlsWarningLogged = true;
    }
    return undefined;
  }

  if (typeof Deno.createHttpClient !== "function") {
    mtlsClient = null;
    logMTLSStatus(
      "mTLS disabled: Deno.createHttpClient unavailable (enable --unstable).",
    );
    return undefined;
  }

  const opts: { cert: string; key: string; caCerts?: string[] } = { cert, key };
  if (ca) {
    opts.caCerts = [ca];
  }

  mtlsClient = Deno.createHttpClient(opts);
  logMTLSStatus(
    `mTLS enabled: cert=${cert.length} key=${key.length} ca=${ca ? ca.length : 0}`,
  );
  return mtlsClient;
}

export async function requestJSON(
  url: string,
  init: {
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
  },
  req?: Request,
): Promise<unknown | Response> {
  // Audit fix H-7: require HTTPS in every environment, not just production.
  // The previous `isProductionEnv()` heuristic was fragile (a staging deploy
  // missing the env-var would silently downgrade to http). Allow http only
  // for explicit localhost / private-IP URLs which are always operator-set.
  const lowerUrl = url.toLowerCase();
  const isHttps = lowerUrl.startsWith("https://");
  const isLocalhost =
    lowerUrl.startsWith("http://localhost") ||
    lowerUrl.startsWith("http://127.0.0.1") ||
    lowerUrl.startsWith("http://[::1]");
  if (!isHttps && !(isLocalhost && !isProductionEnv())) {
    return error(
      400,
      "TEE service URL must use https:// (http only allowed for localhost in non-production)",
      "INSECURE_TEE_URL",
      req,
    );
  }

  const headers = new Headers(init.headers);
  if (!headers.get("X-Service-ID")) {
    headers.set("X-Service-ID", getEnv("EDGE_SERVICE_ID") ?? "gateway");
  }
  maybeAttachRuntimeAuth(headers, url);
  let body: string | undefined = undefined;

  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
    try {
      body = JSON.stringify(init.body);
    } catch (_e: unknown) {
      console.warn(
        "[tee] JSON.stringify failed, using String() fallback:",
        _e instanceof Error ? _e.message : String(_e),
      );
      body = String(init.body);
    }
  }

  const requestInit: RequestInit & { client?: Deno.HttpClient } = {
    method: init.method,
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  };

  const client = getMTLSClient();
  if (client) {
    requestInit.client = client;
  } else if (isProductionEnv() && !canUsePublicRuntimeWithoutMTLS(url)) {
    return error(
      503,
      "mTLS is required for TEE service calls in production",
      "MTLS_REQUIRED",
      req,
    );
  }

  try {
    const resp = await fetch(url, requestInit);

    const text = await resp.text();
    if (!resp.ok) {
      return error(
        resp.status,
        "upstream request failed",
        "UPSTREAM_ERROR",
        req,
      );
    }

    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return error(502, "invalid upstream JSON", "UPSTREAM_INVALID_JSON", req);
    }
  } catch (err) {
    return error(502, "upstream request failed", "UPSTREAM_ERROR", req);
  }
}

export async function postJSON(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  req?: Request,
): Promise<unknown | Response> {
  return requestJSON(url, { method: "POST", headers, body }, req);
}

export async function getJSON(
  url: string,
  headers: Record<string, string> = {},
  req?: Request,
): Promise<unknown | Response> {
  return requestJSON(url, { method: "GET", headers }, req);
}

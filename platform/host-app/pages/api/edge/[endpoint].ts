import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { forwardEdgeRpcHeaders, getEdgeFunctionsBaseUrl } from "@/lib/edge";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import { getKernelHash, getMiniAppContractHash, getRpcNetwork } from "@/lib/rpc-helpers";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_SIZE = 256 * 1024;
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;
const GAS_CONTRACT_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const EDGE_CORS_ALLOW_HEADERS =
  "Content-Type, Authorization, X-API-Key, X-Requested-With";
const EDGE_CORS_ALLOW_METHODS = "GET,HEAD,POST,OPTIONS";

const UNAUTHENTICATED_READ_DEFAULTS: Record<string, unknown> = {
  "os-badge-get-stat": "0",
  "os-badge-list": [],
  "os-checkin-streak": {
    currentStreak: 0,
    highestStreak: 0,
    totalCheckins: 0,
    lastCheckinTime: 0,
    unclaimedRewards: "0",
    totalClaimed: "0",
  },
  "os-escrow-get": null,
  "os-game-status": null,
  "os-leaderboard-get": [],
  "os-nft-list": [],
  "os-payment-balance": "0",
  "os-storage-get": null,
  "os-storage-list": {},
  "os-storage-read-shared": null,
  "os-vesting-get": null,
  "os-vesting-list": [],
};

const LOCAL_OPTIONAL_WRITE_DEFAULTS = new Set([
  "os-badge-award",
  "os-nft-mint",
]);
const AUTOMATION_EDGE_ENDPOINTS = new Set([
  "automation-triggers",
  "automation-trigger",
  "automation-trigger-update",
  "automation-trigger-delete",
  "automation-trigger-enable",
  "automation-trigger-disable",
  "automation-trigger-resume",
  "automation-trigger-executions",
]);

function parseAllowlist(raw: string): {
  allowAll: boolean;
  entries: Set<string>;
} {
  const entries = String(raw || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return {
    allowAll: entries.includes("*"),
    entries: new Set(entries),
  };
}

function isMiniAppEdgeEndpointAllowed(endpoint: string): boolean {
  const { allowAll, entries } = parseAllowlist(
    process.env.MINIAPP_EDGE_ALLOWLIST || "",
  );
  if (allowAll) return true;
  if (entries.size > 0) return entries.has(endpoint);
  return endpoint.startsWith("os-") || AUTOMATION_EDGE_ENDPOINTS.has(endpoint);
}

function hasCallerCredential(req: NextApiRequest): boolean {
  const auth = req.headers.authorization;
  const apiKey = req.headers["x-api-key"];
  return Boolean(
    (Array.isArray(auth) ? auth[0] : auth)?.trim() ||
      (Array.isArray(apiKey) ? apiKey[0] : apiKey)?.trim(),
  );
}

function setMiniAppEdgeCorsHeaders(res: NextApiResponse) {
  // MiniApps run in sandboxed iframes without allow-same-origin, so browser
  // requests arrive with origin "null". These API calls do not use cookies;
  // credentials are explicit bearer/API-key headers handled below.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", EDGE_CORS_ALLOW_METHODS);
  res.setHeader("Access-Control-Allow-Headers", EDGE_CORS_ALLOW_HEADERS);
  res.setHeader("Access-Control-Expose-Headers", "X-MiniApp-Edge-State");
  res.setHeader("Access-Control-Max-Age", "600");
}

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalSize = 0;
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalSize += buf.length;
      if (totalSize > MAX_BODY_SIZE) {
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => resolve());
    req.on("error", reject);
  });
  return Buffer.concat(chunks);
}

function parseJsonBody(
  rawBody: Buffer | undefined,
  parsedBody?: unknown,
): Record<string, unknown> {
  if (!rawBody?.length && parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)) {
    return parsedBody as Record<string, unknown>;
  }
  if (!rawBody?.length) return {};
  try {
    const parsed = JSON.parse(rawBody.toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch (_error) {
    if (parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)) {
      return parsedBody as Record<string, unknown>;
    }
    return {};
  }
}

function stringToHex(value: string): string {
  return Buffer.from(value, "utf8").toString("hex");
}

function normalizeNetwork(value: unknown): "mainnet" | "testnet" | "" {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "testnet";
  return "";
}

function resolveLocalEdgeNetwork(
  req: NextApiRequest,
  body: Record<string, unknown>,
): "mainnet" | "testnet" {
  const bodyNetwork = normalizeNetwork(body.network ?? body.chain);
  if (bodyNetwork) return bodyNetwork;

  const referer = Array.isArray(req.headers.referer)
    ? req.headers.referer[0]
    : req.headers.referer;
  if (referer) {
    try {
      const url = new URL(referer);
      const refererNetwork = normalizeNetwork(
        url.searchParams.get("network") || url.searchParams.get("chain"),
      );
      if (refererNetwork) return refererNetwork;
    } catch (_error) {
      // Ignore malformed referer headers and fall back to the configured RPC network.
    }
  }

  return getRpcNetwork();
}

function parsePositiveFixed8Amount(value: unknown, label: string): bigint {
  const raw = String(value ?? "").trim();
  if (/^\d{8,}$/.test(raw)) {
    const scaled = BigInt(raw);
    if (scaled <= 0n) throw new Error(`${label} must be greater than zero`);
    return scaled;
  }
  if (!/^\d+(?:\.\d{1,8})?$/.test(raw)) {
    throw new Error(`${label} must be a positive GAS amount`);
  }
  const [whole, fraction = ""] = raw.split(".");
  const scaled = BigInt(`${whole}${fraction.padEnd(8, "0")}`);
  if (scaled <= 0n) throw new Error(`${label} must be greater than zero`);
  return scaled;
}

function buildKernelStateIntent(
  operation: "putMiniAppState" | "deleteMiniAppState",
  body: Record<string, unknown>,
  network: "mainnet" | "testnet",
) {
  const appId = String(body.appId || body.app_id || "").trim();
  const key = String(body.key || "").trim();
  if (!appId) throw new Error("appId required");
  if (!key) throw new Error("key required");

  const args = [
    { type: "String", value: appId },
    { type: "ByteArray", value: stringToHex(key) },
  ];
  if (operation === "putMiniAppState") {
    if (body.value === undefined || body.value === null) {
      throw new Error("value required");
    }
    args.push({
      type: "ByteArray",
      value: stringToHex(JSON.stringify(body.value)),
    });
  }

  return {
    contract: getKernelHash(network),
    operation,
    args,
  };
}

function countMilestones(value: unknown): number {
  if (Array.isArray(value)) return Math.max(1, value.length);
  const count = Number(value || 1);
  return Number.isFinite(count) && count >= 1 ? Math.floor(count) : 1;
}

function buildPaymentDepositIntent(
  body: Record<string, unknown>,
  network: "mainnet" | "testnet",
) {
  const appId = String(body.appId || body.app_id || "").trim();
  if (!appId) throw new Error("appId required");
  const amount = parsePositiveFixed8Amount(body.amount, "Deposit amount");
  const memo = String(body.memo || "").trim() || appId;
  return {
    intent: "deposit",
    invocation: {
      contract_hash: GAS_CONTRACT_HASH,
      method: "transfer",
      params: [
        { type: "Hash160", value: "SENDER" },
        { type: "Hash160", value: getKernelHash(network) },
        { type: "Integer", value: amount.toString() },
        { type: "String", value: memo },
      ],
    },
  };
}

function buildGameBetIntent(
  body: Record<string, unknown>,
  network: "mainnet" | "testnet",
) {
  const appId = String(body.appId || body.app_id || "").trim();
  if (!appId) throw new Error("appId required");
  const amount = parsePositiveFixed8Amount(body.amount, "Bet amount");
  const rawPoolId = String(body.poolId || body.pool_id || "0").trim();
  const poolId = /^\d+$/.test(rawPoolId) ? rawPoolId : "0";

  return {
    intent: "game_bet",
    contract: getKernelHash(network),
    operation: "PlaceBet",
    args: [
      { type: "String", value: appId },
      { type: "Integer", value: poolId },
      { type: "Hash160", value: "SENDER" },
      { type: "Integer", value: amount.toString() },
    ],
    meta: {
      requestedPoolId: rawPoolId,
    },
  };
}

function buildEscrowCreateIntent(
  body: Record<string, unknown>,
  network: "mainnet" | "testnet",
) {
  const appId = String(body.appId || body.app_id || "").trim();
  if (!appId) throw new Error("appId required");
  const amount = parsePositiveFixed8Amount(body.amount, "Escrow amount");
  const counterparty =
    String(
      body.counterparty || body.beneficiary || body.recipient || body.to || "",
    ).trim() || "SENDER";

  return {
    intent: "escrow_create",
    contract: getKernelHash(network),
    operation: "CreateEscrow",
    args: [
      { type: "String", value: appId },
      { type: "Hash160", value: "SENDER" },
      { type: "Hash160", value: counterparty },
      { type: "Integer", value: amount.toString() },
      { type: "Integer", value: String(countMilestones(body.milestones)) },
    ],
  };
}

function requireEscrowId(body: Record<string, unknown>): string {
  const escrowId = String(body.escrowId || body.id || "").trim();
  if (!escrowId) throw new Error("escrowId required");
  return escrowId;
}

function parseMilestoneIndex(body: Record<string, unknown>): number {
  const raw = Number(body.milestoneIndex ?? body.index ?? 0);
  if (!Number.isFinite(raw) || raw < 0) {
    throw new Error("milestoneIndex must be zero or greater");
  }
  return Math.floor(raw);
}

function buildEscrowMilestoneIntent(
  intent: string,
  operation: string,
  body: Record<string, unknown>,
  network: "mainnet" | "testnet",
) {
  const appId = String(body.appId || body.app_id || "").trim();
  if (!appId) throw new Error("appId required");
  return {
    intent,
    contract: getKernelHash(network),
    operation,
    args: [
      { type: "String", value: appId },
      { type: "Hash160", value: "SENDER" },
      { type: "String", value: requireEscrowId(body) },
      { type: "Integer", value: String(parseMilestoneIndex(body)) },
    ],
  };
}

function buildEscrowRefundIntent(
  body: Record<string, unknown>,
  network: "mainnet" | "testnet",
) {
  const appId = String(body.appId || body.app_id || "").trim();
  if (!appId) throw new Error("appId required");
  return {
    intent: "escrow_refund",
    contract: getKernelHash(network),
    operation: "RefundEscrow",
    args: [
      { type: "String", value: appId },
      { type: "Hash160", value: "SENDER" },
      { type: "String", value: requireEscrowId(body) },
    ],
  };
}

function getAppContractHash(
  body: Record<string, unknown>,
  network: "mainnet" | "testnet",
): string {
  const appId = String(body.appId || body.app_id || "").trim();
  if (!appId) throw new Error("appId required");
  const contractHash =
    String(body.contractHash || body.contract_hash || "").trim() ||
    getMiniAppContractHash(appId, network);
  if (!contractHash) throw new Error("miniapp contract hash not configured");
  return contractHash;
}

function buildCheckinIntent(
  body: Record<string, unknown>,
  network: "mainnet" | "testnet",
) {
  const appId = String(body.appId || body.app_id || "").trim();
  const contractHash = getAppContractHash(body, network);
  return {
    intent: "checkin",
    invocation: {
      contract_hash: GAS_CONTRACT_HASH,
      method: "transfer",
      params: [
        { type: "Hash160", value: "SENDER" },
        { type: "Hash160", value: contractHash },
        { type: "Integer", value: "100000" },
        { type: "String", value: `${appId}:checkin` },
      ],
    },
  };
}

function buildCheckinClaimIntent(
  body: Record<string, unknown>,
  network: "mainnet" | "testnet",
) {
  const contractHash = getAppContractHash(body, network);
  return {
    intent: "checkin_claim",
    contract: contractHash,
    operation: "claimRewards",
    args: [
      { type: "Hash160", value: "SENDER" },
    ],
  };
}

function stableAutomationId(body: Record<string, unknown>) {
  return `local-auto-${createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex")
    .slice(0, 16)}`;
}

function buildAutomationFallback(
  req: NextApiRequest,
  endpoint: string,
  body: Record<string, unknown>,
) {
  if (!AUTOMATION_EDGE_ENDPOINTS.has(endpoint)) return null;

  const method = String(req.method || "GET").toUpperCase();
  if (endpoint === "automation-triggers" && method === "GET") {
    return {
      state: "local_automation_unavailable",
      data: [],
    };
  }

  if (endpoint === "automation-triggers" && method === "POST") {
    const name = String(body.name || "").trim();
    const triggerType = String(body.trigger_type || "").trim();
    if (!name || !triggerType) throw new Error("name and trigger_type required");
    if (body.action === undefined || body.action === null) {
      throw new Error("action required");
    }
    return {
      state: "local_automation_intent",
      data: {
        id: stableAutomationId(body),
        name,
        trigger_type: triggerType,
        schedule: body.schedule,
        condition: body.condition,
        action: body.action,
        enabled: false,
        created_at: new Date().toISOString(),
        registration_state: "local_automation_intent",
      },
    };
  }

  if (
    endpoint === "automation-trigger-enable" ||
    endpoint === "automation-trigger-disable" ||
    endpoint === "automation-trigger-resume" ||
    endpoint === "automation-trigger-delete"
  ) {
    const id = String(body.id || req.query.id || "").trim();
    if (!id) throw new Error("id required");
    return {
      state: "local_automation_intent",
      data: {
        id,
        status:
          endpoint === "automation-trigger-enable"
            ? "enabled"
            : endpoint === "automation-trigger-disable"
              ? "disabled"
              : endpoint === "automation-trigger-delete"
                ? "deleted"
                : "resumed",
      },
    };
  }

  return null;
}

function buildLocalEdgeFallback(
  req: NextApiRequest,
  endpoint: string,
  rawBody: Buffer | undefined,
  parsedBody?: unknown,
) {
  const body = parseJsonBody(rawBody, parsedBody);
  const network = resolveLocalEdgeNetwork(req, body);
  if (endpoint === "os-storage-set") {
    return {
      state: "local_kernel_intent",
      data: buildKernelStateIntent("putMiniAppState", body, network),
    };
  }
  if (endpoint === "os-storage-delete") {
    return {
      state: "local_kernel_intent",
      data: buildKernelStateIntent("deleteMiniAppState", body, network),
    };
  }
  if (endpoint === "os-payment-deposit") {
    return {
      state: "local_wallet_intent",
      data: buildPaymentDepositIntent(body, network),
    };
  }
  if (endpoint === "os-game-bet") {
    return {
      state: "local_wallet_intent",
      data: buildGameBetIntent(body, network),
    };
  }
  if (endpoint === "os-escrow-create") {
    return {
      state: "local_wallet_intent",
      data: buildEscrowCreateIntent(body, network),
    };
  }
  if (endpoint === "os-escrow-complete") {
    return {
      state: "local_wallet_intent",
      data: buildEscrowMilestoneIntent(
        "escrow_complete_milestone",
        "CompleteMilestone",
        body,
        network,
      ),
    };
  }
  if (endpoint === "os-escrow-fund") {
    return {
      state: "local_wallet_intent",
      data: buildEscrowMilestoneIntent(
        "escrow_claim_milestone",
        "ClaimMilestone",
        body,
        network,
      ),
    };
  }
  if (endpoint === "os-escrow-refund") {
    return {
      state: "local_wallet_intent",
      data: buildEscrowRefundIntent(body, network),
    };
  }
  if (endpoint === "os-checkin-checkin") {
    return {
      state: "local_wallet_intent",
      data: buildCheckinIntent(body, network),
    };
  }
  if (endpoint === "os-checkin-claim") {
    return {
      state: "local_wallet_intent",
      data: buildCheckinClaimIntent(body, network),
    };
  }
  if (LOCAL_OPTIONAL_WRITE_DEFAULTS.has(endpoint)) {
    return {
      state: "local_optional_unavailable",
      data: null,
    };
  }
  const automationFallback = buildAutomationFallback(req, endpoint, body);
  if (automationFallback) return automationFallback;
  return null;
}

function copyPassthroughQuery(req: NextApiRequest, url: URL) {
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "endpoint") continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === undefined) continue;
      url.searchParams.append(key, String(item));
    }
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  setMiniAppEdgeCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (standardLimit(req, res)) return;

  const endpoint = String(req.query.endpoint || "").trim();
  if (!endpoint) {
    apiError.badRequest(res, "edge endpoint required");
    return;
  }
  if (!isMiniAppEdgeEndpointAllowed(endpoint)) {
    apiError.forbidden(res, "edge endpoint not allowed");
    return;
  }

  // Some OS-style endpoints are safe to answer without the configured edge
  // gateway: they are read-only views that intentionally return defaults when
  // the caller has not provided wallet credentials. E2E validation relies on
  // this behavior to avoid noisy 500s (and browser console errors) when
  // exercising the public surfaces.
  if (!hasCallerCredential(req) && endpoint in UNAUTHENTICATED_READ_DEFAULTS) {
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-MiniApp-Edge-State", "wallet-required");
    res.status(200).json({
      ok: true,
      data: UNAUTHENTICATED_READ_DEFAULTS[endpoint],
      meta: { state: "wallet_required" },
    });
    return;
  }

  const method = String(req.method || "GET").toUpperCase();
  const hasBody = !(method === "GET" || method === "HEAD");
  const rawBody = hasBody ? await readRawBody(req) : undefined;
  const body = rawBody ? new Uint8Array(rawBody) : undefined;
  const headers = forwardEdgeRpcHeaders(req);
  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    try {
      const fallback = buildLocalEdgeFallback(req, endpoint, rawBody, req.body);
      if (fallback) {
        res.setHeader("Cache-Control", "no-store, private");
        res.setHeader("X-MiniApp-Edge-State", fallback.state);
        res.status(200).json({
          ok: true,
          data: fallback.data,
          meta: { state: fallback.state },
        });
        return;
      }
    } catch (error) {
      apiError.badRequest(
        res,
        error instanceof Error ? error.message : "Invalid local edge request",
      );
      return;
    }
    apiError.internal(
      res,
      "EDGE_BASE_URL (or NEXT_PUBLIC_EDGE_URL / NEXT_PUBLIC_SUPABASE_URL) not configured",
    );
    return;
  }

  let url: URL;
  try {
    url = new URL(`${base}/${encodeURIComponent(endpoint)}`);
    copyPassthroughQuery(req, url);
  } catch {
    apiError.internal(res, "Invalid EDGE_BASE_URL configuration");
    return;
  }

  try {
    const upstream = await fetchWithTimeout(url.toString(), {
      method,
      headers,
      body,
    });

    res.status(upstream.status);
    res.setHeader("Cache-Control", "no-store, private");
    const blockedHeaders = new Set([
      "transfer-encoding",
      "connection",
      "set-cookie",
      "access-control-allow-origin",
      "cache-control",
      "content-encoding",
      "content-length",
    ]);
    upstream.headers.forEach((value, key) => {
      if (blockedHeaders.has(key)) return;
      res.setHeader(key, value);
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_RESPONSE_SIZE) {
      apiError.gatewayError(res, "upstream response too large");
      return;
    }
    res.send(buf);
  } catch (err) {
    logger.error(
      "MiniApp edge upstream error:",
      err instanceof Error ? err.message : "unknown error",
    );
    apiError.gatewayTimeout(res, "Upstream request failed");
  }
}

export const config = {
  api: { bodyParser: false },
};

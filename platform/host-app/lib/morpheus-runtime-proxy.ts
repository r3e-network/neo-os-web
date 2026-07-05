import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import {
  resolveMorpheusRuntimeCandidates,
  resolveMorpheusRuntimeToken,
} from "@/lib/morpheus-endpoints";

const MORPHEUS_RUNTIME_TIMEOUT_MS = 30_000;
const SESSION_ACTIONS = ["start", "step", "finalize"] as const;
const LEGACY_GAME_ACTIONS = ["start", "move", "finalize"] as const;

export type MorpheusRuntimeFamily = "session" | "game";

type RuntimeProxyOptions = {
  family: MorpheusRuntimeFamily;
};

const startFinalizeLimit = rateLimit({ max: 12, windowMs: 60_000 });
const stepLimit = rateLimit({ max: 600, windowMs: 60_000 });
const fallbackLimit = rateLimit({ max: 60, windowMs: 60_000 });

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBody(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function serializeBody(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value || {});
}

function resolveAction(req: NextApiRequest) {
  return trimString(firstQueryValue(req.query.action)).toLowerCase();
}

function allowedActions(family: MorpheusRuntimeFamily): readonly string[] {
  return family === "session" ? SESSION_ACTIONS : LEGACY_GAME_ACTIONS;
}

function resolveNetwork(req: NextApiRequest, body: Record<string, unknown>) {
  return (
    trimString(body.network) ||
    trimString(body.morpheus_network) ||
    trimString(firstQueryValue(req.query.network)) ||
    "testnet"
  );
}

function selectLimiter(action: string) {
  if (action === "step" || action === "move") return stepLimit;
  if (action === "start" || action === "finalize") return startFinalizeLimit;
  return fallbackLimit;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function upstreamError(status: number, text: string) {
  const parsed = tryParseJson(text);
  const message = parsed?.error || parsed?.message || parsed?.detail || text.trim();
  return String(message || `Morpheus runtime returned ${status}`);
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    MORPHEUS_RUNTIME_TIMEOUT_MS,
  );
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function handleMorpheusRuntimeProxy(
  req: NextApiRequest,
  res: NextApiResponse,
  options: RuntimeProxyOptions,
) {
  if (String(req.method || "").toUpperCase() !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  const action = resolveAction(req);
  if (!allowedActions(options.family).includes(action)) {
    return apiError.notFound(res, "unsupported Morpheus runtime route");
  }
  if (selectLimiter(action)(req, res)) return;

  const body = parseBody(req.body);
  const network = resolveNetwork(req, body);
  const candidates = resolveMorpheusRuntimeCandidates(network);
  if (candidates.length === 0) {
    return apiError.configError(res, "Morpheus runtime URL is not configured");
  }

  const token = resolveMorpheusRuntimeToken(network);
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    "x-morpheus-network": network,
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
    headers["x-nitro-token"] = token;
  }

  const upstreamPath = `/${options.family}/${action}`;
  const requestBody = serializeBody(req.body);
  let lastResponse: {
    status: number;
    text: string;
    contentType: string;
  } | null = null;
  let lastError = "";

  for (const candidate of candidates) {
    const baseUrl = candidate.replace(/\/$/, "");
    try {
      const response = await fetchWithTimeout(`${baseUrl}${upstreamPath}`, {
        method: "POST",
        cache: "no-store",
        headers,
        body: requestBody,
      });
      const text = await response.text();
      lastResponse = {
        status: response.status,
        text,
        contentType: response.headers.get("content-type") || "application/json",
      };
      if (response.ok || !isRetryableStatus(response.status)) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  res.setHeader("Cache-Control", "no-store, private");
  if (!lastResponse) {
    return apiError.gatewayError(
      res,
      lastError || "Morpheus runtime is unavailable",
    );
  }

  res.status(lastResponse.status);
  if (lastResponse.status >= 400 && !lastResponse.contentType.includes("json")) {
    res.json({ error: upstreamError(lastResponse.status, lastResponse.text) });
    return;
  }

  res.setHeader("Content-Type", lastResponse.contentType);
  res.send(lastResponse.text);
}

import type { NextApiRequest, NextApiResponse } from "next";
import { getExternalIntegrationConfig, resolveNeoNetwork } from "@shared/constants/rpc";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";
import { resolveMorpheusPublicApiCandidates } from "@/lib/morpheus-endpoints";

const STATUS_PATHS = {
  health: "/health",
  status: "/v1/status",
  key: "/oracle/public-key",
} as const;

type StatusKey = keyof typeof STATUS_PATHS;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPath(candidates: string[], path: string): Promise<unknown> {
  for (const candidate of candidates) {
    try {
      return await fetchJson(`${candidate.replace(/\/$/, "")}${path}`);
    } catch {
      // Try the next canonical public endpoint. Raw upstream details are never
      // reflected to the browser because they may contain deployment context.
    }
  }
  throw new Error("public Morpheus route unavailable");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Embedded MiniApps run in an opaque-origin sandbox. This endpoint returns
  // public, read-only status data, so allow those frames to read the response.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, private");
  if (standardLimit(req, res)) return;

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    apiError.methodNotAllowed(res);
    return;
  }

  const network = resolveNeoNetwork(String(req.query.network ?? ""));
  const candidates = resolveMorpheusPublicApiCandidates(network);
  if (candidates.length === 0) {
    apiError.configError(res, "Morpheus public API is not configured");
    return;
  }

  const entries = Object.entries(STATUS_PATHS) as Array<[StatusKey, string]>;
  const settled = await Promise.allSettled(
    entries.map(([, path]) => fetchPath(candidates, path)),
  );
  const payload: Record<StatusKey, unknown | null> = {
    health: null,
    status: null,
    key: null,
  };
  const errors: StatusKey[] = [];
  settled.forEach((result, index) => {
    const key = entries[index][0];
    if (result.status === "fulfilled") payload[key] = result.value;
    else errors.push(key);
  });

  if (errors.length === entries.length) {
    apiError.gatewayError(res, "Morpheus status routes are unavailable");
    return;
  }

  const integration = getExternalIntegrationConfig(network);
  res.status(200).json({
    network,
    checkedAt: new Date().toISOString(),
    oracleContract: integration.contracts.morpheusOracle,
    ...payload,
    errors,
  });
}

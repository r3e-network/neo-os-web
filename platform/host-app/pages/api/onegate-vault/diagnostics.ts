import type { NextApiRequest, NextApiResponse } from "next";
import { apiError, getRequestId, setRequestIdHeader } from "@/lib/api-response";
import {
  createSupabaseOneGateVaultDiagnosticsRepository,
  summarizeOneGateVaultDiagnostics,
} from "@/lib/onegate-vault-diagnostics";
import { relaxedLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient } from "@/lib/server-supabase";

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return body && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};
}

function diagnosticsTokenMatches(req: NextApiRequest): boolean {
  const configured = String(
    process.env.ONEGATE_VAULT_DIAGNOSTICS_TOKEN || "",
  ).trim();
  if (!configured) return false;
  const header = req.headers["x-onegate-vault-diagnostics-token"];
  const query = req.query.token;
  const provided = String(
    Array.isArray(header)
      ? header[0]
      : header || (Array.isArray(query) ? query[0] : query) || "",
  ).trim();
  return provided === configured;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const requestId = getRequestId(req);
  setRequestIdHeader(res, requestId);

  if (req.method !== "POST" && req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  let supabase;
  try {
    supabase = getServerSupabaseClient({ requireServiceRole: true });
  } catch {
    supabase = null;
  }
  if (!supabase) {
    if (req.method === "POST") {
      return res.status(202).json({
        stored: false,
        reason: "diagnostics storage is not configured",
        requestId,
      });
    }
    return apiError.configError(
      res,
      "Supabase service role is required for diagnostics",
    );
  }

  const repository =
    createSupabaseOneGateVaultDiagnosticsRepository(supabase);

  if (req.method === "GET") {
    if (!diagnosticsTokenMatches(req)) {
      return apiError.forbidden(res, "diagnostics token is required");
    }
    const limitRaw = Array.isArray(req.query.limit)
      ? req.query.limit[0]
      : req.query.limit;
    const network = Array.isArray(req.query.network)
      ? req.query.network[0]
      : req.query.network;
    try {
      const records = await repository.listRecent({
        limit: Number(limitRaw || 50),
        network,
      });
      return res.status(200).json({
        records,
        summary: summarizeOneGateVaultDiagnostics(records),
        requestId,
      });
    } catch (error) {
      return apiError.internal(
        res,
        error instanceof Error ? error.message : "diagnostic query failed",
      );
    }
  }

  const body = parseBody(req.body);
  try {
    const record = await repository.create({
      ...body,
      requestId,
    });
    return res.status(202).json({
      stored: true,
      id: record.id,
      fingerprint: record.fingerprint,
      requestId,
    });
  } catch (error) {
    return res.status(202).json({
      stored: false,
      reason: error instanceof Error ? error.message : "diagnostic insert failed",
      requestId,
    });
  }
}

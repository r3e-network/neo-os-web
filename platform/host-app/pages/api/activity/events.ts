import type { NextApiRequest, NextApiResponse } from "next";
import { getEdgeFunctionsBaseUrl } from "../../../lib/edge";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import { FLAGSHIP_APPS } from "@/lib/chain";
import { rpcCall } from "@/lib/chain";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const base = getEdgeFunctionsBaseUrl();

  const params = new URLSearchParams();
  const { app_id, event_name, contract_hash, limit, after_id, tx_hash } = req.query;

  if (app_id) {
    const v = String(app_id);
    if (!/^[a-zA-Z0-9._-]+$/.test(v)) return apiError.badRequest(res, "Invalid app_id");
    params.set("app_id", v);
  }
  if (event_name) {
    const v = String(event_name);
    if (!/^[a-zA-Z0-9._-]+$/.test(v)) return apiError.badRequest(res, "Invalid event_name");
    params.set("event_name", v);
  }
  if (contract_hash) {
    const v = String(contract_hash);
    if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return apiError.badRequest(res, "Invalid contract_hash");
    params.set("contract_hash", v);
  }
  if (limit) {
    const parsed = parseInt(String(limit), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) return apiError.badRequest(res, "Invalid limit");
    params.set("limit", String(parsed));
  }
  if (after_id) {
    const v = String(after_id);
    if (!/^[a-zA-Z0-9_-]+$/.test(v)) return apiError.badRequest(res, "Invalid after_id");
    params.set("after_id", v);
  }

  try {
    let data: unknown;
    if (base) {
      const url = `${base}/events-list?${params}`;
      const upstream = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(req.headers.authorization ? { Authorization: String(req.headers.authorization) } : {}),
        },
        signal: AbortSignal.timeout(15000),
      });

      try {
        data = await upstream.json();
      } catch {
        return apiError.internal(res, "Failed to parse upstream response");
      }
      if (!upstream.ok) {
        return apiError.internal(res, "Upstream request failed");
      }
    } else if (typeof app_id === "string" && FLAGSHIP_APPS[app_id] && tx_hash) {
      const appLog = await rpcCall<{
        executions?: Array<{
          notifications?: Array<Record<string, unknown>>;
        }>;
      }>("getapplicationlog", [String(tx_hash)], "testnet");
      const notifications = appLog?.executions?.[0]?.notifications || [];
      const rows = notifications.filter((row) => {
        const contract = String(row.contract || "").toLowerCase();
        const expected = FLAGSHIP_APPS[app_id].contract.toLowerCase();
        const nameMatches = event_name ? String(row.eventname || "") === String(event_name) : true;
        return contract === expected && nameMatches;
      });
      data = {
        events: rows.map((row, index) => ({
          id: `${tx_hash}:${index}`,
          event_name: row.eventname,
          state: (row.state as { value?: unknown } | undefined)?.value || row.state || [],
          tx_hash: String(tx_hash),
          created_at: new Date().toISOString(),
          block_index: 0,
        })),
        total: rows.length,
      };
    } else if (typeof app_id === "string" && FLAGSHIP_APPS[app_id]) {
      const n3Params = new URLSearchParams();
      if (event_name) n3Params.set("event_name", String(event_name));
      if (limit) n3Params.set("limit", String(limit));
      if (after_id) n3Params.set("after_id", String(after_id));
      if (tx_hash) n3Params.set("tx_hash", String(tx_hash));

      const n3indexUrl = `https://api.n3index.dev/indexer/v1/networks/testnet/contracts/${FLAGSHIP_APPS[app_id].contract}/events?${n3Params.toString()}`;
      const upstream = await fetch(n3indexUrl, { signal: AbortSignal.timeout(15000) });
      if (!upstream.ok) {
        return apiError.internal(res, "N3Index request failed");
      }
      const rows = await upstream.json();
      data = {
        events: Array.isArray(rows) ? rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          event_name: row.event_name,
          state: row.state,
          tx_hash: row.txid,
          created_at: row.block_time,
          block_index: row.block_index,
        })) : [],
        total: Array.isArray(rows) ? rows.length : 0,
      };
    } else {
      return apiError.internal(res, "Edge functions not configured");
    }
    res.setHeader("Cache-Control", "no-store, private");
    res.status(200).json(data);
  } catch (err) {
    logger.error("Failed to fetch events:", err instanceof Error ? err.message : "unknown error");
    return apiError.internal(res, "Failed to fetch events");
  }
}

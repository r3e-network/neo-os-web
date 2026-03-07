/**
 * Platform Stats Sync Cron Job
 * Syncs platform transaction counts from chain explorer data
 *
 * Run via: GET /api/cron/sync-platform-stats
 * Requires: CRON_SECRET header for authentication
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

function getPlatformAddress(): string {
  return process.env.NEO_TESTNET_ADDRESS || "NLtL2v28d7TyMEaXcPqtekunkFRksJ7wxu";
}

interface SyncResult {
  timestamp: string;
  supabase_total: number;
  tables: {
    simulation_txs: number;
    service_requests: number;
    contract_events: number;
  };
  unique_users: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return apiError.unauthorized(res, "Unauthorized");
  }
  const authHeader = String(req.headers.authorization || "");
  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
    return apiError.unauthorized(res, "Unauthorized");
  }

  if (!isSupabaseConfigured) {
    return apiError.internal(res, "Database not configured");
  }

  try {
    const result = await syncPlatformStats();
    res.status(200).json(result);
  } catch (error) {
    logger.error("Sync error:", error instanceof Error ? error.message : "unknown error");
    return apiError.internal(res, "Sync failed");
  }
}

async function syncPlatformStats(): Promise<SyncResult> {
  const [simTxRes, serviceRes, eventsRes] = await Promise.all([
    supabase.from("simulation_txs").select("*", { count: "exact", head: true }),
    supabase.from("service_requests").select("*", { count: "exact", head: true }),
    supabase.from("contract_events").select("*", { count: "exact", head: true }),
  ]);

  const tables = {
    simulation_txs: simTxRes.count || 0,
    service_requests: serviceRes.count || 0,
    contract_events: eventsRes.count || 0,
  };

  const supabase_total = tables.simulation_txs + tables.service_requests + tables.contract_events;

  const uniqueUsers = new Set<string>();

  const { data: simUsers } = await supabase
    .from("simulation_txs")
    .select("account_address")
    .not("account_address", "is", null)
    .limit(10000);

  if (simUsers) {
    simUsers.forEach((u) => u.account_address && uniqueUsers.add(u.account_address));
  }

  const { data: reqUsers } = await supabase
    .from("service_requests")
    .select("requester")
    .not("requester", "is", null)
    .limit(10000);

  if (reqUsers) {
    reqUsers.forEach((u) => u.requester && uniqueUsers.add(u.requester));
  }

  const { error: upsertErr } = await supabase.from("platform_stats_sync").upsert(
    {
      id: 1,
      address: getPlatformAddress(),
      supabase_total,
      unique_users: uniqueUsers.size,
      last_synced: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (upsertErr) {
    logger.warn("Failed to store sync result:", upsertErr.message);
  }

  return {
    timestamp: new Date().toISOString(),
    supabase_total,
    tables,
    unique_users: uniqueUsers.size,
  };
}

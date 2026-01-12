import type { NextApiRequest, NextApiResponse } from "next";
import { getEdgeFunctionsBaseUrl } from "@/lib/edge";
import { supabaseAdmin } from "@/lib/supabase";

interface EventFilters {
  appId?: string;
  eventName?: string;
  contractHash?: string;
  limit: number;
  afterId?: string;
}

/**
 * Fetch events from Supabase contract_events table (fallback)
 */
async function fetchFromSupabase(filters: EventFilters) {
  if (!supabaseAdmin) {
    console.error("Supabase admin client not configured");
    return { events: [], has_more: false };
  }

  let query = supabaseAdmin
    .from("contract_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit + 1);

  if (filters.appId) {
    query = query.eq("app_id", filters.appId);
  }
  if (filters.eventName) {
    query = query.eq("event_name", filters.eventName);
  }
  if (filters.contractHash) {
    query = query.eq("contract_hash", filters.contractHash);
  }
  if (filters.afterId) {
    query = query.lt("id", filters.afterId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase query error:", error);
    return { events: [], has_more: false };
  }

  const hasMore = data && data.length > filters.limit;
  const events = (data || []).slice(0, filters.limit).map((evt) => ({
    id: evt.id,
    app_id: evt.app_id,
    event_name: evt.event_name,
    contract_hash: evt.contract_hash,
    tx_hash: evt.tx_hash,
    block_index: evt.block_index,
    payload: evt.payload,
    created_at: evt.created_at,
  }));

  const lastId = events.length > 0 ? events[events.length - 1].id : null;
  return { events, has_more: hasMore, last_id: lastId };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { app_id, event_name, contract_hash, limit, after_id } = req.query;
  const parsedLimit = limit ? parseInt(String(limit), 10) : 20;
  const limitNum = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 100);

  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    // Fallback to direct Supabase query when Edge functions not configured
    const result = await fetchFromSupabase({
      appId: app_id ? String(app_id) : undefined,
      eventName: event_name ? String(event_name) : undefined,
      contractHash: contract_hash ? String(contract_hash) : undefined,
      limit: limitNum,
      afterId: after_id ? String(after_id) : undefined,
    });
    return res.status(200).json(result);
  }

  const params = new URLSearchParams();

  if (app_id) params.set("app_id", String(app_id));
  if (event_name) params.set("event_name", String(event_name));
  if (contract_hash) params.set("contract_hash", String(contract_hash));
  params.set("limit", String(limitNum)); // Use validated limit
  if (after_id) params.set("after_id", String(after_id));

  try {
    const url = `${base}/events-list?${params}`;
    const upstream = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: String(req.headers.authorization) } : {}),
      },
    });

    if (!upstream.ok) {
      // Return empty data on upstream error (graceful degradation)
      return res.status(200).json({ events: [], has_more: false });
    }

    const data = await upstream.json();
    res.status(200).json(data);
  } catch {
    // Return empty data on network error (graceful degradation)
    res.status(200).json({ events: [], has_more: false });
  }
}

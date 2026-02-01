import type { NextApiRequest, NextApiResponse } from "next";
import { getEdgeFunctionsBaseUrl } from "@/lib/edge";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Fetch transactions from Supabase simulation_txs table (fallback)
 */
async function fetchFromSupabase(appId?: string, limit = 20, afterId?: string, chainId?: string) {
  if (!supabaseAdmin) {
    console.error("Supabase admin client not configured");
    return { transactions: [], has_more: false };
  }

  let query = supabaseAdmin
    .from("simulation_txs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (appId) {
    query = query.eq("app_id", appId);
  }
  if (afterId) {
    query = query.lt("id", afterId);
  }
  if (chainId) {
    query = query.eq("chain_id", chainId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase query error:", error);
    return { transactions: [], has_more: false };
  }

  const hasMore = data && data.length > limit;
  const transactions = (data || []).slice(0, limit).map((tx) => ({
    id: tx.id,
    app_id: tx.app_id,
    account_address: tx.account_address,
    tx_type: tx.tx_type,
    amount: tx.amount,
    status: tx.status,
    tx_hash: tx.tx_hash,
    created_at: tx.created_at,
  }));

  const lastId = transactions.length > 0 ? transactions[transactions.length - 1].id : null;
  return { transactions, has_more: hasMore, last_id: lastId };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const { app_id, limit, after_id, chain_id } = req.query;
    const parsedLimit = limit ? parseInt(String(limit), 10) : 20;
    const limitNum = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 100);

    const base = getEdgeFunctionsBaseUrl();
    if (!base) {
      // Fallback to direct Supabase query when Edge functions not configured
      const result = await fetchFromSupabase(
        app_id ? String(app_id) : undefined,
        limitNum,
        after_id ? String(after_id) : undefined,
        chain_id ? String(chain_id) : undefined,
      );
      return res.status(200).json(result);
    }

    const params = new URLSearchParams();
    if (app_id) params.set("app_id", String(app_id));
    params.set("limit", String(limitNum)); // Use validated limit
    if (after_id) params.set("after_id", String(after_id));
    if (chain_id) params.set("chain_id", String(chain_id));

    const url = `${base}/transactions-list?${params}`;
    const upstream = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: String(req.headers.authorization) } : {}),
      },
    });

    if (!upstream.ok) {
      return res.status(200).json({ transactions: [], has_more: false });
    }

    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Transactions API error:", err);
    return res.status(200).json({ transactions: [], has_more: false });
  }
}

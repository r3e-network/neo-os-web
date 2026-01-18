/**
 * Track MiniApp View Count (Multi-Chain Support)
 * POST: Increment view count for a miniapp on a specific chain
 * GET: Get current view count
 *
 * Query params:
 * - chain_id: Optional chain identifier (defaults to 'neo-n3-mainnet')
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase";

const DEFAULT_CHAIN_ID = "neo-n3-mainnet";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId, chain_id } = req.query;
  const chainId = typeof chain_id === "string" ? chain_id : DEFAULT_CHAIN_ID;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "appId is required" });
  }

  // Graceful degradation: return 0 if database not configured
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.status(200).json({ view_count: 0, cached: true });
  }

  try {
    if (req.method === "POST") {
      // Increment view count using RPC function (with chain_id support)
      const { data, error } = await supabaseAdmin.rpc("increment_miniapp_view_count", {
        p_app_id: appId,
        p_chain_id: chainId,
      });

      if (error) {
        // Fallback: manual increment if RPC doesn't exist or doesn't support chain_id
        const { data: current } = await supabaseAdmin
          .from("miniapp_stats_summary")
          .select("view_count, total_unique_users, total_transactions")
          .eq("app_id", appId)
          .eq("chain_id", chainId)
          .single();

        const newCount = (current?.view_count || 0) + 1;

        // Use upsert to create record if it doesn't exist
        await supabaseAdmin.from("miniapp_stats_summary").upsert(
          {
            app_id: appId,
            chain_id: chainId,
            view_count: newCount,
            total_unique_users: current?.total_unique_users || 0,
            total_transactions: current?.total_transactions || 0,
          },
          { onConflict: "app_id,chain_id" },
        );

        return res.status(200).json({ view_count: newCount, chain_id: chainId });
      }

      return res.status(200).json({ view_count: data, chain_id: chainId });
    }

    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("miniapp_stats_summary")
        .select("view_count")
        .eq("app_id", appId)
        .eq("chain_id", chainId)
        .single();

      if (error) {
        return res.status(200).json({ view_count: 0, chain_id: chainId });
      }

      return res.status(200).json({ view_count: data?.view_count || 0, chain_id: chainId });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("View tracking error:", error);
    return res.status(500).json({ error: "Failed to track view" });
  }
}

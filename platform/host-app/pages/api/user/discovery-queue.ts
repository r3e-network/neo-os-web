/**
 * Discovery Queue API - Personalized app recommendations
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHandler } from "@/lib/api";
import { discoveryQueueBody } from "@/lib/schemas";
import { logger } from "@/lib/logger";

export default createHandler({
  auth: "wallet",
  methods: {
    GET: (_req, res, ctx) => handleGet(ctx.db, ctx.address!, res),
    POST: { handler: (req, res, ctx) => handleAction(ctx.db, ctx.address!, req, res), schema: discoveryQueueBody },
  },
});

async function handleGet(db: SupabaseClient, walletAddress: string, res: NextApiResponse) {
  try {
    const { data, error } = await db
      .from("miniapp_discovery_queue")
      .select("*")
      .eq("wallet_address", walletAddress)
      .is("action", null)
      .order("score", { ascending: false })
      .limit(10);

    if (error) throw error;
    return res.status(200).json({ queue: data || [] });
  } catch (error) {
    logger.error("Get discovery queue error", error);
    return res.status(500).json({ error: "Failed to get queue" });
  }
}

async function handleAction(db: SupabaseClient, walletAddress: string, req: NextApiRequest, res: NextApiResponse) {
  const { app_id, action } = req.body;

  try {
    await db
      .from("miniapp_discovery_queue")
      .update({ action, shown_at: new Date().toISOString() })
      .eq("wallet_address", walletAddress)
      .eq("app_id", app_id);

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Update discovery action error", error);
    return res.status(500).json({ error: "Failed to update" });
  }
}

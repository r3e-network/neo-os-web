import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  // SECURITY: Verify wallet ownership via cryptographic signature
  const auth = requireWalletAuth(req.headers);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { appId } = req.query;

    let query = supabaseAdmin
      .from("automation_tasks")
      .select("*, schedules:automation_schedules(*)")
      .eq("wallet_address", auth.address)
      .order("created_at", { ascending: false });

    if (appId) {
      query = query.eq("app_id", appId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return res.status(200).json({ tasks: data || [] });
  } catch (error) {
    logger.error("[Automation] List error", error);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
}

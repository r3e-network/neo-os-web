import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
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
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "taskId required" });
    }

    // SECURITY: Verify the authenticated wallet owns this task (IDOR prevention)
    const { data: task } = await supabaseAdmin
      .from("automation_tasks")
      .select("id")
      .eq("id", taskId)
      .eq("wallet_address", auth.address)
      .single();

    if (!task) {
      return res.status(403).json({ error: "Task not found or access denied" });
    }

    const { error } = await supabaseAdmin
      .from("automation_tasks")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) throw error;
    return res.status(200).json({ success: true, status: "active" });
  } catch (error) {
    logger.error("[Automation] Enable error", error);
    return res.status(500).json({ error: String(error) });
  }
}

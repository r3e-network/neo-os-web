import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.status(503).json({ success: false, error: "Database not configured" });
  }

  // SECURITY: Verify wallet ownership via cryptographic signature
  const auth = requireWalletAuth(req.headers);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  try {
    const { appId, taskName } = req.body;

    if (!appId || !taskName) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const { error } = await supabaseAdmin
      .from("automation_tasks")
      .delete()
      .eq("app_id", appId)
      .eq("task_name", taskName);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Automation] Unregister error:", error);
    return res.status(500).json({ success: false, error: String(error) });
  }
}

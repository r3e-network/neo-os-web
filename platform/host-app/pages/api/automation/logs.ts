import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";

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
    const { taskId, appId, limit = "50", offset = "0" } = req.query;

    // SECURITY: If a specific taskId is requested, verify the wallet owns it (IDOR prevention)
    if (taskId) {
      const { data: task } = await supabaseAdmin
        .from("automation_tasks")
        .select("id")
        .eq("id", taskId as string)
        .eq("wallet_address", auth.address)
        .single();

      if (!task) {
        return res.status(403).json({ error: "Task not found or access denied" });
      }
    }

    // SECURITY: Scope logs to only tasks owned by the authenticated wallet
    const { data: ownedTasks } = await supabaseAdmin
      .from("automation_tasks")
      .select("id")
      .eq("wallet_address", auth.address);

    const ownedTaskIds = (ownedTasks || []).map((t) => t.id);

    if (ownedTaskIds.length === 0) {
      return res.status(200).json({ logs: [] });
    }

    let query = supabaseAdmin
      .from("automation_logs")
      .select("*")
      .in("task_id", ownedTaskIds)
      .order("executed_at", { ascending: false })
      .limit(parseInt(limit as string))
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (taskId) {
      query = query.eq("task_id", taskId);
    }

    if (appId) {
      query = query.eq("app_id", appId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return res.status(200).json({ logs: data || [] });
  } catch (error) {
    console.error("[Automation] Logs error:", error);
    return res.status(500).json({ error: "Failed to fetch logs" });
  }
}

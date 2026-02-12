import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import type { TaskStatusResponse } from "@/lib/db/types";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse<TaskStatusResponse>) {
  if (req.method !== "GET") {
    return res.status(405).json({ task: null, schedule: null, recentLogs: [] });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.status(503).json({ task: null, schedule: null, recentLogs: [] });
  }

  // SECURITY: Verify wallet ownership via cryptographic signature
  const auth = requireWalletAuth(req.headers);
  if (!auth.ok) {
    return res.status(auth.status).json({ task: null, schedule: null, recentLogs: [] });
  }

  try {
    const { appId, taskName } = req.query;

    if (!appId || !taskName) {
      return res.status(400).json({ task: null, schedule: null, recentLogs: [] });
    }

    // Get task
    const { data: task } = await supabaseAdmin
      .from("automation_tasks")
      .select("*")
      .eq("app_id", appId)
      .eq("task_name", taskName)
      .single();

    if (!task) {
      return res.status(404).json({ task: null, schedule: null, recentLogs: [] });
    }

    // Get schedule
    const { data: schedule } = await supabaseAdmin
      .from("automation_schedules")
      .select("*")
      .eq("task_id", task.id)
      .single();

    // Get recent logs
    const { data: logs } = await supabaseAdmin
      .from("automation_logs")
      .select("*")
      .eq("task_id", task.id)
      .order("executed_at", { ascending: false })
      .limit(10);

    return res.status(200).json({
      task,
      schedule,
      recentLogs: logs || [],
    });
  } catch (error) {
    logger.error("[Automation] Status error", error);
    return res.status(500).json({ task: null, schedule: null, recentLogs: [] });
  }
}

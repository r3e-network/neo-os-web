import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
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
    const { taskId, payload, schedule } = req.body;

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

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload !== undefined) updates.payload = payload;

    const { error: taskError } = await supabaseAdmin.from("automation_tasks").update(updates).eq("id", taskId);

    if (taskError) throw taskError;

    if (schedule) {
      const scheduleUpdates: Record<string, unknown> = {};
      if (schedule.intervalSeconds) scheduleUpdates.interval_seconds = schedule.intervalSeconds;
      if (schedule.cron) scheduleUpdates.cron_expression = schedule.cron;
      if (schedule.maxRuns) scheduleUpdates.max_runs = schedule.maxRuns;

      await supabaseAdmin.from("automation_schedules").update(scheduleUpdates).eq("task_id", taskId);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("[Automation] Update error", error);
    return res.status(500).json({ error: String(error) });
  }
}

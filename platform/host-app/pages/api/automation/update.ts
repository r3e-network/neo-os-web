import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { assertAutomationOwner, requireAutomationSession, resolveAutomationAppId } from "@/lib/automation/auth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await requireAutomationSession(req, res);
    if (!session) return;

    const { taskId, payload, schedule } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: "taskId required" });
    }

    const resolved = await resolveAutomationAppId({ taskId, supabase });
    if ("error" in resolved) {
      return res.status(resolved.error.status).json({ error: resolved.error.message });
    }

    const ownerCheck = await assertAutomationOwner({ appId: resolved.appId, userId: session.userId, supabase });
    if (!ownerCheck.ok) {
      return res.status(ownerCheck.status || 403).json({ error: ownerCheck.message || "Forbidden" });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload !== undefined) updates.payload = payload;

    const { error: taskError } = await supabase.from("automation_tasks").update(updates).eq("id", taskId);

    if (taskError) throw taskError;

    if (schedule) {
      const scheduleUpdates: Record<string, unknown> = {};
      if (schedule.intervalSeconds) scheduleUpdates.interval_seconds = schedule.intervalSeconds;
      if (schedule.cron) scheduleUpdates.cron_expression = schedule.cron;
      if (schedule.maxRuns) scheduleUpdates.max_runs = schedule.maxRuns;

      await supabase.from("automation_schedules").update(scheduleUpdates).eq("task_id", taskId);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Automation] Update error:", error);
    return res.status(500).json({ error: String(error) });
  }
}

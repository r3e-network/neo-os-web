import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import type { TaskStatusResponse } from "@/lib/db/types";
import { assertAutomationOwner, normalizeAutomationParam, requireAutomationSession } from "@/lib/automation/auth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse<TaskStatusResponse>) {
  if (req.method !== "GET") {
    return res.status(405).json({ task: null, schedule: null, recentLogs: [] });
  }

  try {
    const session = await requireAutomationSession(req, res);
    if (!session) return;

    const { appId, taskName } = req.query;

    if (!appId || !taskName) {
      return res.status(400).json({ task: null, schedule: null, recentLogs: [] });
    }

    const normalizedAppId = normalizeAutomationParam(appId);
    if (!normalizedAppId) {
      return res.status(400).json({ task: null, schedule: null, recentLogs: [] });
    }

    const ownerCheck = await assertAutomationOwner({ appId: normalizedAppId, userId: session.userId, supabase });
    if (!ownerCheck.ok) {
      return res.status(ownerCheck.status || 403).json({ task: null, schedule: null, recentLogs: [] });
    }

    // Get task
    const { data: task } = await supabase
      .from("automation_tasks")
      .select("*")
      .eq("app_id", normalizedAppId)
      .eq("task_name", taskName)
      .single();

    if (!task) {
      return res.status(404).json({ task: null, schedule: null, recentLogs: [] });
    }

    // Get schedule
    const { data: schedule } = await supabase.from("automation_schedules").select("*").eq("task_id", task.id).single();

    // Get recent logs
    const { data: logs } = await supabase
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
    console.error("[Automation] Status error:", error);
    return res.status(500).json({ task: null, schedule: null, recentLogs: [] });
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import type { RegisterTaskRequest, RegisterTaskResponse } from "@/lib/db/types";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse<RegisterTaskResponse>) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { appId, taskName, taskType, payload, schedule } = req.body as RegisterTaskRequest;

    if (!appId || !taskName || !taskType) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // Upsert task
    const { data: task, error: taskError } = await supabase
      .from("automation_tasks")
      .upsert(
        { app_id: appId, task_name: taskName, task_type: taskType, payload: payload || {} },
        { onConflict: "app_id,task_name" },
      )
      .select()
      .single();

    if (taskError) throw taskError;

    // Create schedule if provided
    if (schedule && task) {
      const nextRun = new Date();
      if (schedule.intervalSeconds) {
        nextRun.setSeconds(nextRun.getSeconds() + schedule.intervalSeconds);
      }

      await supabase.from("automation_schedules").upsert(
        {
          task_id: task.id,
          cron_expression: schedule.cron,
          interval_seconds: schedule.intervalSeconds,
          next_run_at: nextRun.toISOString(),
          max_runs: schedule.maxRuns,
        },
        { onConflict: "task_id" },
      );
    }

    return res.status(200).json({ success: true, taskId: task?.id });
  } catch (error) {
    console.error("[Automation] Register error:", error);
    return res.status(500).json({ success: false, error: String(error) });
  }
}

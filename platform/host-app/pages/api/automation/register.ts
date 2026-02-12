import type { NextApiRequest, NextApiResponse } from "next";
import type { RegisterTaskRequest, RegisterTaskResponse } from "@/lib/db/types";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { writeRateLimiter, withRateLimit } from "@/lib/security/ratelimit";
import { logger } from "@/lib/logger";

export default withRateLimit(
  writeRateLimiter,
  async function handler(req: NextApiRequest, res: NextApiResponse<RegisterTaskResponse>) {
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
      const { appId, taskName, taskType, payload, schedule } = req.body as RegisterTaskRequest;

      if (!appId || !taskName || !taskType) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      // Upsert task
      const { data: task, error: taskError } = await supabaseAdmin
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

        await supabaseAdmin.from("automation_schedules").upsert(
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
      logger.error("[Automation] Register error", error);
      return res.status(500).json({ success: false, error: "Failed to register automation task" });
    }
  },
);

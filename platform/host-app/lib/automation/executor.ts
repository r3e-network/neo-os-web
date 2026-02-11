import { supabaseAdmin } from "@/lib/supabase";
import type { AutomationTask, AutomationSchedule } from "@/lib/db/types";

/** Get DB client or throw */
function db() {
  if (!supabaseAdmin) throw new Error("Database not configured for automation executor");
  return supabaseAdmin;
}

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

export async function getReadyTasks(): Promise<Array<{ task: AutomationTask; schedule: AutomationSchedule }>> {
  const now = new Date().toISOString();

  const { data, error } = await db()
    .from("automation_schedules")
    .select("*, task:automation_tasks(*)")
    .lte("next_run_at", now)
    .eq("task.status", "active");

  if (error) {
    console.error("[Executor] Failed to get ready tasks:", error);
    return [];
  }

  return (data || []).map((row) => ({
    task: row.task as AutomationTask,
    schedule: row as AutomationSchedule,
  }));
}

export async function executeTask(task: AutomationTask, schedule: AutomationSchedule): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    // Import handler dynamically
    const { handleTask } = await import("./handlers");
    const result = await handleTask(task);

    const durationMs = Date.now() - startTime;

    // Log success
    await logExecution(task.id, "success", result, undefined, durationMs);

    // Update schedule
    await updateSchedule(schedule, true);

    return { taskId: task.id, success: true, result, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Log failure
    await logExecution(task.id, "failed", undefined, errorMsg, durationMs);

    return { taskId: task.id, success: false, error: errorMsg, durationMs };
  }
}

async function logExecution(
  taskId: string,
  status: string,
  result?: Record<string, unknown>,
  error?: string,
  durationMs?: number,
) {
  await db().from("automation_logs").insert({
    task_id: taskId,
    status,
    result,
    error,
    duration_ms: durationMs,
  });
}

async function updateSchedule(schedule: AutomationSchedule, _success: boolean) {
  const updates: Partial<AutomationSchedule> = {
    last_run_at: new Date().toISOString(),
    run_count: schedule.run_count + 1,
  };

  // Calculate next run
  if (schedule.interval_seconds) {
    const nextRun = new Date();
    nextRun.setSeconds(nextRun.getSeconds() + schedule.interval_seconds);
    updates.next_run_at = nextRun.toISOString();
  }

  // Check max runs
  if (schedule.max_runs && updates.run_count! >= schedule.max_runs) {
    await db().from("automation_tasks").update({ status: "completed" }).eq("id", schedule.task_id);
  }

  await db().from("automation_schedules").update(updates).eq("id", schedule.id);
}

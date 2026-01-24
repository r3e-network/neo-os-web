import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  assertAutomationOwner,
  normalizeAutomationParam,
  requireAutomationSession,
  resolveAutomationAppId,
} from "@/lib/automation/auth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await requireAutomationSession(req, res);
    if (!session) return;

    const { taskId, appId, limit = "50", offset = "0" } = req.query;

    const resolved = await resolveAutomationAppId({ appId, taskId, supabase });
    if ("error" in resolved) {
      return res.status(resolved.error.status).json({ error: resolved.error.message });
    }

    const ownerCheck = await assertAutomationOwner({ appId: resolved.appId, userId: session.userId, supabase });
    if (!ownerCheck.ok) {
      return res.status(ownerCheck.status || 403).json({ error: ownerCheck.message || "Forbidden" });
    }

    const normalizedTaskId = normalizeAutomationParam(taskId);

    let query = supabase
      .from("automation_logs")
      .select("*")
      .eq("app_id", resolved.appId)
      .order("executed_at", { ascending: false })
      .limit(parseInt(limit as string))
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (normalizedTaskId) {
      query = query.eq("task_id", normalizedTaskId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return res.status(200).json({ logs: data || [] });
  } catch (error) {
    console.error("[Automation] Logs error:", error);
    return res.status(500).json({ error: String(error) });
  }
}

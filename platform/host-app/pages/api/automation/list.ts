import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { assertAutomationOwner, normalizeAutomationParam, requireAutomationSession } from "@/lib/automation/auth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await requireAutomationSession(req, res);
    if (!session) return;

    const { appId } = req.query;
    const normalizedAppId = normalizeAutomationParam(appId);
    if (!normalizedAppId) {
      return res.status(400).json({ error: "appId required" });
    }

    const ownerCheck = await assertAutomationOwner({ appId: normalizedAppId, userId: session.userId, supabase });
    if (!ownerCheck.ok) {
      return res.status(ownerCheck.status || 403).json({ error: ownerCheck.message || "Forbidden" });
    }

    const query = supabase
      .from("automation_tasks")
      .select("*, schedules:automation_schedules(*)")
      .eq("app_id", normalizedAppId)
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ tasks: data || [] });
  } catch (error) {
    console.error("[Automation] List error:", error);
    return res.status(500).json({ error: String(error) });
  }
}

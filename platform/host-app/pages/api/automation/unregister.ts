import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { assertAutomationOwner, requireAutomationSession } from "@/lib/automation/auth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const session = await requireAutomationSession(req, res);
    if (!session) return;

    const { appId, taskName } = req.body;

    if (!appId || !taskName) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const ownerCheck = await assertAutomationOwner({ appId, userId: session.userId, supabase });
    if (!ownerCheck.ok) {
      return res
        .status(ownerCheck.status || 403)
        .json({ success: false, error: ownerCheck.message || "Forbidden" });
    }

    const { error } = await supabase.from("automation_tasks").delete().eq("app_id", appId).eq("task_name", taskName);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Automation] Unregister error:", error);
    return res.status(500).json({ success: false, error: String(error) });
  }
}

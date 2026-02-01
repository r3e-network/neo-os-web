import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { appId, taskName } = req.body;

    if (!appId || !taskName) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const { error } = await supabase.from("automation_tasks").delete().eq("app_id", appId).eq("task_name", taskName);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Automation] Unregister error:", error);
    return res.status(500).json({ success: false, error: String(error) });
  }
}

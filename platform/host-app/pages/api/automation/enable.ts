import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: "taskId required" });
    }

    const { error } = await supabase
      .from("automation_tasks")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) throw error;
    return res.status(200).json({ success: true, status: "active" });
  } catch (error) {
    console.error("[Automation] Enable error:", error);
    return res.status(500).json({ error: String(error) });
  }
}

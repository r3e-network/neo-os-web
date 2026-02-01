import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { taskId, appId, limit = "50", offset = "0" } = req.query;

    let query = supabase
      .from("automation_logs")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(parseInt(limit as string))
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (taskId) {
      query = query.eq("task_id", taskId);
    }

    if (appId) {
      query = query.eq("app_id", appId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return res.status(200).json({ logs: data || [] });
  } catch (error) {
    console.error("[Automation] Logs error:", error);
    return res.status(500).json({ error: String(error) });
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { appId } = req.query;

    let query = supabase
      .from("automation_tasks")
      .select("*, schedules:automation_schedules(*)")
      .order("created_at", { ascending: false });

    if (appId) {
      query = query.eq("app_id", appId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ tasks: data || [] });
  } catch (error) {
    console.error("[Automation] List error:", error);
    return res.status(500).json({ error: String(error) });
  }
}

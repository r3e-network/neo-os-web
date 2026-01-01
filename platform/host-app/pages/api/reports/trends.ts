import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { appId, days } = req.query;
  const daysNum = Math.min(parseInt(days as string) || 30, 90);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysNum);

  let query = supabase
    .from("app_trends")
    .select("*")
    .gte("date", startDate.toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (appId && typeof appId === "string") {
    query = query.eq("app_id", appId);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: "Failed to fetch trends" });
  }

  return res.status(200).json({ trends: data || [] });
}

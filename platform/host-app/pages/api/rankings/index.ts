import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type } = req.query;
  const rankType = typeof type === "string" ? type : "hot";

  const { data } = await supabase
    .from("app_rankings")
    .select("*")
    .eq("rank_type", rankType)
    .order("rank_position", { ascending: true })
    .limit(50);

  return res.status(200).json({ rankings: data || [] });
}

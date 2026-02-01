import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const { wallet } = req.query;
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "Missing wallet" });
  }

  if (req.method === "GET") {
    const { data } = await supabase
      .from("developer_stats")
      .select("*")
      .eq("developer_address", wallet)
      .order("date", { ascending: false })
      .limit(30);
    return res.status(200).json({ stats: data || [] });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

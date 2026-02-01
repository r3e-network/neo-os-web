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
    const { data } = await supabase.from("app_subscriptions").select("*").eq("wallet_address", wallet);
    return res.status(200).json({ subscriptions: data || [] });
  }

  if (req.method === "POST") {
    const { app_id, plan } = req.body;
    const { data, error } = await supabase
      .from("app_subscriptions")
      .upsert({ wallet_address: wallet, app_id, plan, status: "active" })
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Failed" });
    return res.status(201).json({ subscription: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

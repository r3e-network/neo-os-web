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
    const { data } = await supabase.from("collection_folders").select("*").eq("wallet_address", wallet);
    return res.status(200).json({ folders: data || [] });
  }

  if (req.method === "POST") {
    const { name, icon, color } = req.body;
    const { data, error } = await supabase
      .from("collection_folders")
      .insert({ wallet_address: wallet, name, icon, color })
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Failed" });
    return res.status(201).json({ folder: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const { wallet } = req.query;

  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "Missing wallet address" });
  }

  if (req.method === "GET") {
    return getPreferences(wallet, res);
  }

  if (req.method === "PUT") {
    return updatePreferences(wallet, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getPreferences(wallet: string, res: NextApiResponse) {
  const { data, error } = await supabase.from("user_preferences").select("*").eq("wallet_address", wallet).single();

  if (error && error.code !== "PGRST116") {
    return res.status(500).json({ error: "Failed to fetch preferences" });
  }

  // Return defaults if no preferences exist
  const defaults = {
    wallet_address: wallet,
    preferred_categories: [],
    notification_settings: { email: false, push: true, digest: "daily" },
    theme: "system",
    language: "en",
  };

  return res.status(200).json({ preferences: data || defaults });
}

async function updatePreferences(wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const { preferred_categories, notification_settings, theme, language } = req.body;

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        wallet_address: wallet,
        preferred_categories,
        notification_settings,
        theme,
        language,
      },
      { onConflict: "wallet_address" },
    )
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: "Failed to update preferences" });
  }

  return res.status(200).json({ preferences: data });
}

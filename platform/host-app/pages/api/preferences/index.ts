import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHandler } from "@/lib/api";
import { updatePreferencesBody } from "@/lib/schemas";

export default createHandler({
  auth: "wallet",
  methods: {
    GET: (req, res, ctx) => getPreferences(ctx.db, ctx.address!, res),
    PUT: {
      handler: (req, res, ctx) => updatePreferences(ctx.db, ctx.address!, req, res),
      schema: updatePreferencesBody,
    },
  },
});

async function getPreferences(db: SupabaseClient, wallet: string, res: NextApiResponse) {
  const { data, error } = await db.from("user_preferences").select("*").eq("wallet_address", wallet).single();

  if (error && error.code !== "PGRST116") {
    return res.status(500).json({ error: "Failed to fetch preferences" });
  }

  const defaults = {
    wallet_address: wallet,
    preferred_categories: [],
    notification_settings: { email: false, push: true, digest: "daily" },
    theme: "system",
    language: "en",
  };

  return res.status(200).json({ preferences: data || defaults });
}

async function updatePreferences(db: SupabaseClient, wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const { preferred_categories, notification_settings, theme, language } = req.body;

  const { data, error } = await db
    .from("user_preferences")
    .upsert(
      { wallet_address: wallet, preferred_categories, notification_settings, theme, language },
      { onConflict: "wallet_address" },
    )
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: "Failed to update preferences" });
  }

  return res.status(200).json({ preferences: data });
}

/**
 * Notification Preferences API
 * GET: Fetch user preferences
 * PUT: Update user preferences
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface NotificationPreferences {
  email: string | null;
  email_verified: boolean;
  notify_miniapp_results: boolean;
  notify_balance_changes: boolean;
  notify_chain_alerts: boolean;
  digest_frequency: "instant" | "hourly" | "daily";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const wallet = req.headers["x-wallet-address"] as string;

  if (!wallet) {
    return res.status(401).json({ error: "Wallet address required" });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
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
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("wallet_address", wallet)
    .single();

  if (error && error.code !== "PGRST116") {
    return res.status(500).json({ error: "Failed to fetch preferences" });
  }

  // Return defaults if not found
  const prefs: NotificationPreferences = data || {
    email: null,
    email_verified: false,
    notify_miniapp_results: true,
    notify_balance_changes: true,
    notify_chain_alerts: false,
    digest_frequency: "instant",
  };

  return res.status(200).json({ preferences: prefs });
}

async function updatePreferences(wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const updates = req.body;

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      wallet_address: wallet,
      ...updates,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wallet_address" },
  );

  if (error) {
    return res.status(500).json({ error: "Failed to update preferences" });
  }

  return res.status(200).json({ success: true });
}

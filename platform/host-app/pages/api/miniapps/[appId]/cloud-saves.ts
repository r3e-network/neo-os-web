/**
 * Cloud Saves API - Sync user save data
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }
  const db = supabaseAdmin;

  // SECURITY: Verify wallet ownership via cryptographic signature
  const auth = requireWalletAuth(req.headers);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const walletAddress = auth.address;

  const { appId } = req.query;
  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "App ID required" });
  }

  switch (req.method) {
    case "GET":
      return handleGet(db, res, appId, walletAddress);
    case "PUT":
      return handleSave(db, req, res, appId, walletAddress);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

async function handleGet(db: SupabaseClient, res: NextApiResponse, appId: string, walletAddress: string) {
  try {
    const { data, error } = await db
      .from("miniapp_cloud_saves")
      .select("*")
      .eq("app_id", appId)
      .eq("wallet_address", walletAddress);

    if (error) throw error;

    return res.status(200).json({ saves: data || [] });
  } catch (error) {
    console.error("Get saves error:", error);
    return res.status(500).json({ error: "Failed to get saves" });
  }
}

async function handleSave(
  db: SupabaseClient,
  req: NextApiRequest,
  res: NextApiResponse,
  appId: string,
  walletAddress: string,
) {
  const { slot_name = "default", save_data, client_timestamp } = req.body;

  if (!save_data) {
    return res.status(400).json({ error: "Save data required" });
  }

  try {
    const { data, error } = await db
      .from("miniapp_cloud_saves")
      .upsert(
        {
          app_id: appId,
          wallet_address: walletAddress,
          slot_name,
          save_data,
          client_timestamp,
          save_size_bytes: JSON.stringify(save_data).length,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "app_id,wallet_address,slot_name" },
      )
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ save: data });
  } catch (error) {
    console.error("Save error:", error);
    return res.status(500).json({ error: "Failed to save" });
  }
}

/**
 * Delete Collection API
 * DELETE: Remove MiniApp from user's collection
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface DeleteResponse {
  success: boolean;
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<DeleteResponse>) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const walletAddress = req.headers["x-wallet-address"] as string;
  const { appId } = req.query;

  if (!walletAddress) {
    return res.status(401).json({ success: false, error: "Wallet address required" });
  }

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ success: false, error: "appId is required" });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ success: false, error: "Database not configured" });
  }

  const { error } = await supabase
    .from("user_collections")
    .delete()
    .eq("wallet_address", walletAddress)
    .eq("app_id", appId);

  if (error) {
    console.error("Failed to delete collection:", error);
    return res.status(500).json({ success: false, error: "Failed to delete" });
  }

  return res.status(200).json({ success: true });
}

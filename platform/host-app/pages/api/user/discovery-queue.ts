/**
 * Discovery Queue API - Personalized app recommendations
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const walletAddress = req.headers["x-wallet-address"] as string;
  if (!walletAddress) {
    return res.status(401).json({ error: "Wallet address required" });
  }

  if (req.method === "GET") {
    return handleGet(res, walletAddress);
  }

  if (req.method === "POST") {
    return handleAction(req, res, walletAddress);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function handleGet(res: NextApiResponse, walletAddress: string) {
  try {
    const { data, error } = await supabaseAdmin!
      .from("miniapp_discovery_queue")
      .select("*")
      .eq("wallet_address", walletAddress)
      .is("action", null)
      .order("score", { ascending: false })
      .limit(10);

    if (error) throw error;
    return res.status(200).json({ queue: data || [] });
  } catch (error) {
    console.error("Get discovery queue error:", error);
    return res.status(500).json({ error: "Failed to get queue" });
  }
}

async function handleAction(req: NextApiRequest, res: NextApiResponse, walletAddress: string) {
  const { app_id, action } = req.body;

  if (!app_id || !action) {
    return res.status(400).json({ error: "App ID and action required" });
  }

  try {
    await supabaseAdmin!
      .from("miniapp_discovery_queue")
      .update({ action, shown_at: new Date().toISOString() })
      .eq("wallet_address", walletAddress)
      .eq("app_id", app_id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Update discovery action error:", error);
    return res.status(500).json({ error: "Failed to update" });
  }
}

/**
 * Wishlist API - Add/Remove apps from wishlist
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

  switch (req.method) {
    case "GET":
      return handleGet(res, walletAddress);
    case "POST":
      return handleAdd(req, res, walletAddress);
    case "DELETE":
      return handleRemove(req, res, walletAddress);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

async function handleGet(res: NextApiResponse, walletAddress: string) {
  try {
    const { data, error } = await supabaseAdmin!
      .from("miniapp_wishlist")
      .select("*")
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.status(200).json({ wishlist: data || [] });
  } catch (error) {
    console.error("Get wishlist error:", error);
    return res.status(500).json({ error: "Failed to get wishlist" });
  }
}

async function handleAdd(req: NextApiRequest, res: NextApiResponse, walletAddress: string) {
  const { app_id } = req.body;
  if (!app_id) {
    return res.status(400).json({ error: "App ID required" });
  }

  try {
    const { data, error } = await supabaseAdmin!
      .from("miniapp_wishlist")
      .upsert({ wallet_address: walletAddress, app_id }, { onConflict: "wallet_address,app_id" })
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ item: data });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    return res.status(500).json({ error: "Failed to add to wishlist" });
  }
}

async function handleRemove(req: NextApiRequest, res: NextApiResponse, walletAddress: string) {
  const { app_id } = req.body;
  if (!app_id) {
    return res.status(400).json({ error: "App ID required" });
  }

  try {
    await supabaseAdmin!.from("miniapp_wishlist").delete().eq("wallet_address", walletAddress).eq("app_id", app_id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    return res.status(500).json({ error: "Failed to remove from wishlist" });
  }
}

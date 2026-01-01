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
    return getFollowedDevelopers(wallet, res);
  }

  if (req.method === "POST") {
    return followDeveloper(wallet, req, res);
  }

  if (req.method === "DELETE") {
    return unfollowDeveloper(wallet, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getFollowedDevelopers(wallet: string, res: NextApiResponse) {
  const { data, error } = await supabase
    .from("followed_developers")
    .select("developer_address, created_at")
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: "Failed to fetch followed developers" });
  }

  return res.status(200).json({ developers: data || [] });
}

async function followDeveloper(wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const { developer_address } = req.body;

  if (!developer_address) {
    return res.status(400).json({ error: "Missing developer_address" });
  }

  const { error } = await supabase.from("followed_developers").insert({
    wallet_address: wallet,
    developer_address,
  });

  if (error?.code === "23505") {
    return res.status(409).json({ error: "Already following" });
  }

  if (error) {
    return res.status(500).json({ error: "Failed to follow developer" });
  }

  return res.status(201).json({ success: true });
}

async function unfollowDeveloper(wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const { developer_address } = req.body;

  if (!developer_address) {
    return res.status(400).json({ error: "Missing developer_address" });
  }

  const { error } = await supabase
    .from("followed_developers")
    .delete()
    .eq("wallet_address", wallet)
    .eq("developer_address", developer_address);

  if (error) {
    return res.status(500).json({ error: "Failed to unfollow developer" });
  }

  return res.status(200).json({ success: true });
}

/**
 * User Collections API
 * GET: Fetch user's collected MiniApps
 * POST: Add MiniApp to collection
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface CollectionItem {
  app_id: string;
  created_at: string;
}

interface CollectionsResponse {
  collections: CollectionItem[];
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<CollectionsResponse>) {
  const walletAddress = req.headers["x-wallet-address"] as string;

  if (!walletAddress) {
    return res.status(401).json({
      collections: [],
      error: "Wallet address required",
    });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({
      collections: [],
      error: "Database not configured",
    });
  }

  if (req.method === "GET") {
    return handleGet(walletAddress, res);
  }

  if (req.method === "POST") {
    return handlePost(walletAddress, req, res);
  }

  return res.status(405).json({
    collections: [],
    error: "Method not allowed",
  });
}

async function handleGet(walletAddress: string, res: NextApiResponse<CollectionsResponse>) {
  const { data, error } = await supabase
    .from("user_collections")
    .select("app_id, created_at")
    .eq("wallet_address", walletAddress)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch collections:", error);
    return res.status(500).json({
      collections: [],
      error: "Failed to fetch collections",
    });
  }

  return res.status(200).json({ collections: data || [] });
}

async function handlePost(walletAddress: string, req: NextApiRequest, res: NextApiResponse<CollectionsResponse>) {
  const { appId } = req.body;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({
      collections: [],
      error: "appId is required",
    });
  }

  const { error } = await supabase.from("user_collections").insert({
    wallet_address: walletAddress,
    app_id: appId,
  });

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        collections: [],
        error: "Already collected",
      });
    }
    console.error("Failed to add collection:", error);
    return res.status(500).json({
      collections: [],
      error: "Failed to add collection",
    });
  }

  return res.status(201).json({ collections: [{ app_id: appId, created_at: new Date().toISOString() }] });
}

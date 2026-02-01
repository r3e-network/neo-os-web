/**
 * API: Developer Tokens Management
 * GET /api/tokens - List all tokens
 * POST /api/tokens - Create new token
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase";
import { randomBytes, createHash } from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { walletAddress } = req.query;

  if (!walletAddress || typeof walletAddress !== "string") {
    return res.status(400).json({ error: "Missing wallet address" });
  }

  if (req.method === "GET") {
    return handleGet(walletAddress, res);
  } else if (req.method === "POST") {
    return handlePost(walletAddress, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function handleGet(walletAddress: string, res: NextApiResponse) {
  try {
    const { data, error } = await supabase
      .from("developer_tokens")
      .select("id, token_prefix, name, scopes, last_used_at, expires_at, created_at")
      .eq("wallet_address", walletAddress)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch tokens:", error);
      return res.status(500).json({ error: "Failed to fetch tokens" });
    }

    return res.status(200).json({ tokens: data || [] });
  } catch (error) {
    console.error("Tokens fetch error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handlePost(walletAddress: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const { name, scopes, expiresInDays } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Token name is required" });
    }

    // Generate random token
    const token = `neo_${randomBytes(32).toString("hex")}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const tokenPrefix = token.substring(0, 12);

    // Calculate expiration
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null;

    // Store token
    const { error } = await supabase.from("developer_tokens").insert({
      wallet_address: walletAddress,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      name,
      scopes: scopes || ["read"],
      expires_at: expiresAt,
    });

    if (error) {
      console.error("Failed to create token:", error);
      return res.status(500).json({ error: "Failed to create token" });
    }

    return res.status(201).json({ token, tokenPrefix });
  } catch (error) {
    console.error("Token creation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

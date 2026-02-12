/**
 * API: Developer Tokens Management
 * GET /api/tokens - List all tokens
 * POST /api/tokens - Create new token
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";
import { createHandler } from "@/lib/api";
import { createTokenBody } from "@/lib/schemas";
import { logger } from "@/lib/logger";

export default createHandler({
  auth: "wallet",
  methods: {
    GET: (req, res, ctx) => handleGet(ctx.db, ctx.address!, res),
    POST: {
      handler: (req, res, ctx) => handlePost(ctx.db, ctx.address!, req, res),
      schema: createTokenBody,
      rateLimit: "write",
    },
  },
});

async function handleGet(db: SupabaseClient, walletAddress: string, res: NextApiResponse) {
  try {
    const { data, error } = await db
      .from("developer_tokens")
      .select("id, token_prefix, name, scopes, last_used_at, expires_at, created_at")
      .eq("wallet_address", walletAddress)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      logger.error("Failed to fetch tokens", error);
      return res.status(500).json({ error: "Failed to fetch tokens" });
    }

    return res.status(200).json({ tokens: data || [] });
  } catch (error) {
    logger.error("Tokens fetch error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handlePost(db: SupabaseClient, walletAddress: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const { name, scopes, expiresInDays } = req.body;

    const token = `neo_${randomBytes(32).toString("hex")}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const tokenPrefix = token.substring(0, 12);

    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null;

    const { error } = await db.from("developer_tokens").insert({
      wallet_address: walletAddress,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      name,
      scopes: scopes || ["read"],
      expires_at: expiresAt,
    });

    if (error) {
      logger.error("Failed to create token", error);
      return res.status(500).json({ error: "Failed to create token" });
    }

    return res.status(201).json({ token, tokenPrefix });
  } catch (error) {
    logger.error("Token creation error", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

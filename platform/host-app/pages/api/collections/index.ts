/**
 * User Collections API
 * GET: Fetch user's collected MiniApps
 * POST: Add MiniApp to collection
 * SECURITY: Wallet-based authentication
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateCsrfToken } from "@/lib/csrf";
import { createHandler } from "@/lib/api";
import { addCollectionBody } from "@/lib/schemas";

export default createHandler({
  auth: "wallet",
  rateLimit: "api",
  methods: {
    GET: (req, res, ctx) => handleGet(ctx.db, ctx.address!, req, res),
    POST: {
      handler: (req, res, ctx) => handlePost(ctx.db, ctx.address!, req, res),
      schema: addCollectionBody,
    },
  },
});

async function handleGet(db: SupabaseClient, walletAddress: string, req: NextApiRequest, res: NextApiResponse) {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  const { data, error, count } = await db
    .from("user_collections")
    .select("app_id, created_at", { count: "exact" })
    .eq("wallet_address", walletAddress)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Failed to fetch collections:", error);
    return res.status(500).json({ collections: [], error: "Failed to fetch collections" });
  }

  return res.status(200).json({
    collections: data || [],
    total: count ?? 0,
    has_more: (count ?? 0) > offset + limit,
  });
}

async function handlePost(db: SupabaseClient, walletAddress: string, req: NextApiRequest, res: NextApiResponse) {
  // SECURITY: CSRF validation for state-changing POST
  if (!validateCsrfToken(req)) {
    return res.status(403).json({ collections: [], error: "Invalid CSRF token" });
  }

  const { appId } = req.body;

  const { error } = await db.from("user_collections").insert({
    wallet_address: walletAddress,
    app_id: appId,
  });

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ collections: [], error: "Already collected" });
    }
    console.error("Failed to add collection:", error);
    return res.status(500).json({ collections: [], error: "Failed to add collection" });
  }

  return res.status(201).json({
    collections: [{ app_id: appId, created_at: new Date().toISOString() }],
  });
}

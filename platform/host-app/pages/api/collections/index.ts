/**
 * User Collections API
 * GET: Fetch user's collected MiniApps
 * POST: Add MiniApp to collection
 * SECURITY: Requires Auth0 session + wallet ownership verification
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@auth0/nextjs-auth0";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { validateCsrfToken } from "@/lib/csrf";
import { apiRateLimiter } from "@/lib/security/ratelimit";

// Neo address validation regex
const NEO_ADDRESS_REGEX = /^N[A-Za-z0-9]{33}$/;

interface CollectionItem {
  app_id: string;
  created_at: string;
}

interface CollectionsResponse {
  collections: CollectionItem[];
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<CollectionsResponse>) {
  // SECURITY: Rate limiting
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
  const { allowed } = apiRateLimiter.check(ip);
  if (!allowed) {
    return res.status(429).json({ collections: [], error: "Too many requests" });
  }

  // SECURITY: Require Auth0 session
  const session = await getSession(req, res);
  if (!session?.user) {
    return res.status(401).json({ collections: [], error: "Authentication required" });
  }

  // SECURITY: CSRF protection for POST
  if (req.method === "POST") {
    if (!validateCsrfToken(req)) {
      return res.status(403).json({ collections: [], error: "Invalid CSRF token" });
    }
  }

  const walletAddress = req.headers["x-wallet-address"] as string;

  if (!walletAddress) {
    return res.status(400).json({ collections: [], error: "Wallet address required" });
  }

  // SECURITY: Validate wallet address format
  if (!NEO_ADDRESS_REGEX.test(walletAddress)) {
    return res.status(400).json({ collections: [], error: "Invalid wallet address format" });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.status(503).json({ collections: [], error: "Database configuration error" });
  }

  // SECURITY: Verify user owns this wallet
  const { data: neoAccount, error: neoError } = await supabaseAdmin
    .from("neo_accounts")
    .select("address")
    .eq("auth0_sub", session.user.sub)
    .eq("address", walletAddress)
    .single();

  if (neoError || !neoAccount) {
    return res.status(403).json({ collections: [], error: "Wallet not owned by user" });
  }

  if (req.method === "GET") {
    return handleGet(walletAddress, res);
  }

  if (req.method === "POST") {
    return handlePost(walletAddress, req, res);
  }

  return res.status(405).json({ collections: [], error: "Method not allowed" });
}

async function handleGet(walletAddress: string, res: NextApiResponse<CollectionsResponse>) {
  if (!supabaseAdmin) return; // Should be checked by caller

  const { data, error } = await supabaseAdmin
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
  if (!supabaseAdmin) return; // Should be checked by caller

  const { appId } = req.body;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({
      collections: [],
      error: "appId is required",
    });
  }

  const { error } = await supabaseAdmin.from("user_collections").insert({
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

/**
 * Developer App Detail API - Get, Update, Delete single app
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { normalizeContracts } from "@/lib/contracts";

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
  const developerAddress = auth.address;

  const { appId } = req.query;
  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "App ID required" });
  }

  switch (req.method) {
    case "GET":
      return handleGet(db, res, appId, developerAddress);
    case "PUT":
      return handleUpdate(db, req, res, appId, developerAddress);
    case "DELETE":
      return handleDelete(db, res, appId, developerAddress);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

async function handleGet(db: SupabaseClient, res: NextApiResponse, appId: string, developerAddress: string) {
  try {
    const { data, error } = await db
      .from("miniapp_registry")
      .select("*")
      .eq("app_id", appId)
      .eq("developer_address", developerAddress)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "App not found" });
    }

    return res.status(200).json({ app: data });
  } catch (error) {
    console.error("Get app error:", error);
    return res.status(500).json({ error: "Failed to get app" });
  }
}

async function handleUpdate(
  db: SupabaseClient,
  req: NextApiRequest,
  res: NextApiResponse,
  appId: string,
  developerAddress: string,
) {
  /** Allowlist: only these fields may be updated by the developer. */
  const ALLOWED_FIELDS = new Set([
    "name",
    "description",
    "icon_url",
    "banner_url",
    "category",
    "tags",
    "website",
    "source_url",
    "supported_chains",
    "contracts",
    "permissions",
    "metadata",
  ]);

  const raw = req.body ?? {};
  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (ALLOWED_FIELDS.has(key)) updates[key] = raw[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  if (updates.supported_chains && !Array.isArray(updates.supported_chains)) {
    updates.supported_chains = [];
  }

  if (updates.contracts) {
    updates.contracts = normalizeContracts(updates.contracts as Parameters<typeof normalizeContracts>[0]);
  }

  try {
    const { data, error } = await db
      .from("miniapp_registry")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("app_id", appId)
      .eq("developer_address", developerAddress)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ app: data });
  } catch (error) {
    console.error("Update app error:", error);
    return res.status(500).json({ error: "Failed to update app" });
  }
}

async function handleDelete(db: SupabaseClient, res: NextApiResponse, appId: string, developerAddress: string) {
  try {
    const { error } = await db
      .from("miniapp_registry")
      .delete()
      .eq("app_id", appId)
      .eq("developer_address", developerAddress);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete app error:", error);
    return res.status(500).json({ error: "Failed to delete app" });
  }
}

/**
 * Publish Version API - Publish a specific version
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }

  // SECURITY: Verify wallet ownership via cryptographic signature
  const auth = requireWalletAuth(req.headers);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const developerAddress = auth.address;

  const { appId, versionId } = req.query;

  // Verify ownership
  const { data: app } = await supabaseAdmin
    .from("miniapp_registry")
    .select("app_id")
    .eq("app_id", appId)
    .eq("developer_address", developerAddress)
    .single();

  if (!app) {
    return res.status(404).json({ error: "App not found" });
  }

  try {
    // Submit version for admin review (do not auto-publish)
    const { data, error } = await supabaseAdmin
      .from("miniapp_versions")
      .update({
        is_current: false,
        status: "pending_review",
      })
      .eq("id", versionId)
      .eq("app_id", appId)
      .select()
      .single();

    if (error) throw error;

    const supportedChains = Array.isArray(data?.supported_chains) ? data.supported_chains : [];
    const contractMap =
      data?.contracts && typeof data.contracts === "object" && !Array.isArray(data.contracts) ? data.contracts : {};

    // Update registry status for review queue
    await supabaseAdmin
      .from("miniapp_registry")
      .update({
        status: "pending_review",
        visibility: "unlisted",
        updated_at: new Date().toISOString(),
        supported_chains: supportedChains,
        contracts: contractMap,
      })
      .eq("app_id", appId);

    return res.status(200).json({ version: data, message: "Version submitted for review" });
  } catch (error) {
    console.error("Publish version error:", error);
    return res.status(500).json({ error: "Failed to submit version for review" });
  }
}

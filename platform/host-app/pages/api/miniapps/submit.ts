import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, isSupabaseConfigured } from "../../../lib/supabase";

export interface SubmitMiniAppRequest {
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  icon: string;
  category: "gaming" | "defi" | "social" | "nft" | "governance" | "utility";
  entry_url: string;
  supported_chains?: string[];
  contracts?: Record<string, { address?: string | null; active?: boolean; entry_url?: string }>;
  developer_address: string;
  developer_name?: string;
  short_description?: string;
  banner_url?: string;
  support_url?: string;
  privacy_policy_url?: string;
  permissions: {
    payments?: boolean;
    governance?: boolean;
    rng?: boolean;
    datafeed?: boolean;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const body = req.body as SubmitMiniAppRequest;

  // Validate required fields
  if (!body.name || !body.description || !body.entry_url || !body.developer_address) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Generate app_id from name (append timestamp for uniqueness)
  const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const app_id = `community-${slug}-${Date.now().toString(36)}`;
  const supportedChains =
    Array.isArray(body.supported_chains) && body.supported_chains.length > 0 ? body.supported_chains : [];
  const contracts =
    body.contracts && typeof body.contracts === "object" && !Array.isArray(body.contracts) ? body.contracts : {};

  try {
    const { data: registry, error: registryError } = await supabaseAdmin
      .from("miniapp_registry")
      .insert({
        app_id,
        developer_address: body.developer_address,
        name: body.name,
        name_zh: body.name_zh || null,
        description: body.description,
        description_zh: body.description_zh || null,
        short_description: body.short_description || null,
        icon_url: body.icon || null,
        banner_url: body.banner_url || null,
        category: body.category || "utility",
        permissions: body.permissions || {},
        status: "pending_review",
        visibility: "private",
        developer_name: body.developer_name || null,
        support_url: body.support_url || null,
        privacy_policy_url: body.privacy_policy_url || null,
        supported_chains: supportedChains,
        contracts: contracts,
      })
      .select()
      .single();

    if (registryError) throw registryError;

    const { error: versionError } = await supabaseAdmin
      .from("miniapp_versions")
      .insert({
        app_id,
        version: "1.0.0",
        version_code: 1,
        entry_url: body.entry_url,
        supported_chains: supportedChains,
        contracts: contracts,
        status: "pending_review",
        is_current: false,
      });

    if (versionError) throw versionError;

    res.status(201).json({
      success: true,
      app_id,
      message: "MiniApp submitted for review",
      submission: registry,
    });
  } catch (error) {
    console.error("Submit error:", error);
    res.status(500).json({ error: "Failed to submit MiniApp" });
  }
}

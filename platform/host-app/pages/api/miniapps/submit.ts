import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { writeRateLimiter, withRateLimit } from "@/lib/security/ratelimit";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { normalizeContracts } from "@/lib/contracts";

export interface SubmitMiniAppRequest {
  name: string;
  name_zh: string;
  description: string;
  description_zh: string;
  icon: string;
  category: "gaming" | "defi" | "social" | "nft" | "governance" | "utility";
  entry_url: string;
  build_url?: string;
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

export default withRateLimit(writeRateLimiter, async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }

  // SECURITY: Verify wallet ownership via cryptographic signature
  const auth = requireWalletAuth(req.headers);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const body = req.body as SubmitMiniAppRequest;
  const nameZh = typeof body.name_zh === "string" ? body.name_zh.trim() : "";
  const descriptionZh = typeof body.description_zh === "string" ? body.description_zh.trim() : "";

  // Validate required fields
  if (!body.name || !nameZh || !body.description || !descriptionZh || !body.entry_url) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!/^https?:\/\//i.test(body.entry_url)) {
    return res.status(400).json({ error: "Entry URL must be http(s)" });
  }

  // Generate app_id from name (append timestamp for uniqueness)
  const slug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const app_id = `community-${slug}-${Date.now().toString(36)}`;
  const supportedChains =
    Array.isArray(body.supported_chains) && body.supported_chains.length > 0 ? body.supported_chains : [];
  const contracts = normalizeContracts(body.contracts);
  const buildUrl = typeof body.build_url === "string" ? body.build_url.trim() : "";

  if (buildUrl && !/^https?:\/\//i.test(buildUrl)) {
    return res.status(400).json({ error: "Build URL must be http(s)" });
  }

  try {
    // Step 1: Insert registry entry
    const { data: registry, error: registryError } = await supabaseAdmin
      .from("miniapp_registry")
      .insert({
        app_id,
        developer_address: auth.address,
        name: body.name,
        name_zh: nameZh || null,
        description: body.description,
        description_zh: descriptionZh || null,
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

    // Step 2: Insert version entry (rollback registry on failure)
    const { error: versionError } = await supabaseAdmin.from("miniapp_versions").insert({
      app_id,
      version: "1.0.0",
      version_code: 1,
      entry_url: body.entry_url,
      supported_chains: supportedChains,
      contracts: contracts,
      status: "pending_review",
      is_current: false,
    });

    if (versionError) {
      await supabaseAdmin.from("miniapp_registry").delete().eq("app_id", app_id);
      throw versionError;
    }

    // Step 3: Insert build entry if provided (rollback registry + version on failure)
    if (buildUrl) {
      const { data: versionRow } = await supabaseAdmin
        .from("miniapp_versions")
        .select("id")
        .eq("app_id", app_id)
        .eq("version_code", 1)
        .single();

      if (versionRow?.id) {
        const { error: buildError } = await supabaseAdmin.from("miniapp_builds").insert({
          version_id: versionRow.id,
          build_number: 1,
          platform: "web",
          storage_path: buildUrl,
          storage_provider: "external",
          status: "ready",
          completed_at: new Date().toISOString(),
        });

        if (buildError) {
          await supabaseAdmin.from("miniapp_versions").delete().eq("app_id", app_id);
          await supabaseAdmin.from("miniapp_registry").delete().eq("app_id", app_id);
          throw buildError;
        }
      }
    }

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
});

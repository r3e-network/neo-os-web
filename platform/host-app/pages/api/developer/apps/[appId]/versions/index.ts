/**
 * App Versions API - List and Create Versions
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

type ContractConfig = {
  address?: string | null;
  active?: boolean;
  entry_url?: string;
};

function normalizeContracts(raw: unknown): Record<string, ContractConfig> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, ContractConfig> = {};

  Object.entries(raw as Record<string, unknown>).forEach(([chainId, value]) => {
    if (typeof value === "string") {
      result[chainId] = { address: value };
      return;
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const obj = value as Record<string, unknown>;
    const address = typeof obj.address === "string" ? obj.address : undefined;
    const entryUrl = typeof obj.entry_url === "string" ? obj.entry_url : typeof obj.entryUrl === "string" ? obj.entryUrl : undefined;
    const active = typeof obj.active === "boolean" ? obj.active : undefined;

    result[chainId] = {
      ...(address ? { address } : {}),
      ...(entryUrl ? { entry_url: entryUrl } : {}),
      ...(active !== undefined ? { active } : {}),
    };
  });

  return result;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const developerAddress = req.headers["x-developer-address"] as string;
  if (!developerAddress) {
    return res.status(401).json({ error: "Developer address required" });
  }

  const { appId } = req.query;
  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "App ID required" });
  }

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

  if (req.method === "GET") {
    return handleGet(res, appId);
  }

  if (req.method === "POST") {
    return handlePost(req, res, appId);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function handleGet(res: NextApiResponse, appId: string) {
  try {
    const { data, error } = await supabaseAdmin!
      .from("miniapp_versions")
      .select("*")
      .eq("app_id", appId)
      .order("version_code", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ versions: data || [] });
  } catch (error) {
    console.error("List versions error:", error);
    return res.status(500).json({ error: "Failed to list versions" });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, appId: string) {
  const { version, release_notes, entry_url, supported_chains, contracts, build_url } = req.body;

  if (!version || !entry_url) {
    return res.status(400).json({ error: "Version and entry_url required" });
  }

  const buildUrl = typeof build_url === "string" ? build_url.trim() : "";
  if (buildUrl && !/^https?:\/\//i.test(buildUrl)) {
    return res.status(400).json({ error: "Build URL must be http(s)" });
  }

  try {
    // Get next version code
    const { data: latest } = await supabaseAdmin!
      .from("miniapp_versions")
      .select("version_code")
      .eq("app_id", appId)
      .order("version_code", { ascending: false })
      .limit(1)
      .single();

    const version_code = (latest?.version_code || 0) + 1;

    const supportedChains = Array.isArray(supported_chains) ? supported_chains : [];
    const contractMap = normalizeContracts(contracts);

    const { data, error } = await supabaseAdmin!
      .from("miniapp_versions")
      .insert({
        app_id: appId,
        version,
        version_code,
        entry_url,
        supported_chains: supportedChains,
        contracts: contractMap,
        release_notes,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;

    if (buildUrl) {
      const buildNumber = 1;
      await supabaseAdmin!
        .from("miniapp_builds")
        .insert({
          version_id: data.id,
          build_number: buildNumber,
          platform: "web",
          storage_path: buildUrl,
          storage_provider: "external",
          status: "ready",
          completed_at: new Date().toISOString(),
        });
    }

    return res.status(201).json({ version: data });
  } catch (error) {
    console.error("Create version error:", error);
    return res.status(500).json({ error: "Failed to create version" });
  }
}

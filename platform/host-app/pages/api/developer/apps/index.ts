/**
 * Developer Apps API - List and Create Apps
 * GET: List developer's apps
 * POST: Create new app
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

export interface DeveloperApp {
  id: string;
  app_id: string;
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  category: string;
  status: string;
  visibility: string;
  icon_url?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const developerAddress = req.headers["x-developer-address"] as string;
  if (!developerAddress) {
    return res.status(401).json({ error: "Developer address required" });
  }

  if (req.method === "GET") {
    return handleGet(req, res, developerAddress);
  }

  if (req.method === "POST") {
    return handlePost(req, res, developerAddress);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, developerAddress: string) {
  try {
    const { data, error } = await supabaseAdmin!
      .from("miniapp_registry")
      .select("*")
      .eq("developer_address", developerAddress)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ apps: data || [] });
  } catch (error) {
    console.error("List apps error:", error);
    return res.status(500).json({ error: "Failed to list apps" });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, developerAddress: string) {
  const {
    name,
    name_zh,
    description,
    description_zh,
    category,
    supported_chains,
    contracts_json,
    contracts: rawContracts,
  } = req.body;
  const nameZh = typeof name_zh === "string" ? name_zh.trim() : "";
  const descriptionZh = typeof description_zh === "string" ? description_zh.trim() : "";

  if (!name || !description || !category || !nameZh || !descriptionZh) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Generate app_id from name
  const app_id = `dev-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

  try {
    const supportedChains = Array.isArray(supported_chains) ? supported_chains : [];
    const contractsPayload =
      contracts_json && typeof contracts_json === "object" && !Array.isArray(contracts_json)
        ? contracts_json
        : rawContracts;
    const contracts = normalizeContracts(contractsPayload);

    const { data, error } = await supabaseAdmin!
      .from("miniapp_registry")
      .insert({
        app_id,
        developer_address: developerAddress,
        name,
        name_zh: nameZh || null,
        description,
        description_zh: descriptionZh || null,
        category,
        status: "draft",
        visibility: "private",
        supported_chains: supportedChains,
        contracts,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ app: data });
  } catch (error) {
    console.error("Create app error:", error);
    return res.status(500).json({ error: "Failed to create app" });
  }
}

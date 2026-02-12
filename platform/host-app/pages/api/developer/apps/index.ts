/**
 * Developer Apps API - List and Create Apps
 * GET: List developer's apps
 * POST: Create new app
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHandler } from "@/lib/api";
import { createAppBody } from "@/lib/schemas";
import { normalizeContracts } from "@/lib/contracts";
import { logger } from "@/lib/logger";

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

export default createHandler({
  auth: "wallet",
  rateLimit: "api",
  methods: {
    GET: (req, res, ctx) => handleGet(ctx.db, ctx.address!, req, res),
    POST: {
      handler: (req, res, ctx) => handlePost(ctx.db, ctx.address!, req, res),
      schema: createAppBody,
    },
  },
});

async function handleGet(db: SupabaseClient, developerAddress: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const { data, error, count } = await db
      .from("miniapp_registry")
      .select("*", { count: "exact" })
      .eq("developer_address", developerAddress)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.status(200).json({
      apps: data || [],
      total: count ?? 0,
      has_more: (count ?? 0) > offset + limit,
    });
  } catch (error) {
    logger.error("List apps error", error);
    return res.status(500).json({ error: "Failed to list apps" });
  }
}

async function handlePost(db: SupabaseClient, developerAddress: string, req: NextApiRequest, res: NextApiResponse) {
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

  const app_id = `dev-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

  try {
    const supportedChains = Array.isArray(supported_chains) ? supported_chains : [];
    const contractsPayload =
      contracts_json && typeof contracts_json === "object" && !Array.isArray(contracts_json)
        ? contracts_json
        : rawContracts;
    const contracts = normalizeContracts(contractsPayload);

    const { data, error } = await db
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
    logger.error("Create app error", error);
    return res.status(500).json({ error: "Failed to create app" });
  }
}

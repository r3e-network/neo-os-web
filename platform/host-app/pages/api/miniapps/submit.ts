import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";

export interface SubmitMiniAppRequest {
  name: string;
  description: string;
  icon: string;
  category: "gaming" | "defi" | "social" | "nft" | "governance" | "utility";
  entry_url: string;
  supported_chains?: string[];
  contracts?: Record<string, { address?: string | null; active?: boolean; entry_url?: string }>;
  developer_address: string;
  developer_name?: string;
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

  if (!isSupabaseConfigured) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const body = req.body as SubmitMiniAppRequest;

  // Validate required fields
  if (!body.name || !body.description || !body.entry_url || !body.developer_address) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Generate app_id from name
  const app_id = `community-${body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const supportedChains =
    Array.isArray(body.supported_chains) && body.supported_chains.length > 0 ? body.supported_chains : [];
  const contracts =
    body.contracts && typeof body.contracts === "object" && !Array.isArray(body.contracts) ? body.contracts : {};

  try {
    const { data, error } = await supabase
      .from("miniapp_submissions")
      .insert({
        app_id,
        name: body.name,
        description: body.description,
        icon: body.icon || "📦",
        category: body.category || "utility",
        entry_url: body.entry_url,
        supported_chains: supportedChains,
        contracts: contracts,
        developer_address: body.developer_address,
        developer_name: body.developer_name,
        permissions: body.permissions || {},
        source: "community",
        status: "pending",
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      app_id,
      message: "MiniApp submitted for review",
      submission: data,
    });
  } catch (error) {
    console.error("Submit error:", error);
    res.status(500).json({ error: "Failed to submit MiniApp" });
  }
}

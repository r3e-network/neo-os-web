import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { relaxedLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  // Return empty array when Supabase is not configured
  if (!isSupabaseConfigured) {
    return res.status(200).json({ apps: [] });
  }

  const status = (req.query.status as string) || "active";
  const category = req.query.category as string;

  try {
    let query = supabase.from("miniapp_registry").select("*").eq("source", "community").eq("status", status);

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    // Return empty array on query error (table might not exist)
    if (error) {
      logger.warn("Community apps query error (table may not exist):", error.message);
      return res.status(200).json({ apps: [] });
    }

    const apps = (data || []).map((row) => ({
      app_id: row.app_id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      category: row.category,
      entry_url: row.entry_url,
      contract_hash: row.contract_hash,
      source: "community" as const,
      status: row.status,
      developer: {
        name: row.developer_name || "Community Developer",
        address: row.developer_address,
        verified: row.developer_verified || false,
      },
      permissions: row.permissions || {},
    }));

    res.status(200).json({ apps });
  } catch (error) {
    // Return empty array on any error
    logger.warn("Fetch community apps error:", error);
    res.status(200).json({ apps: [] });
  }
}

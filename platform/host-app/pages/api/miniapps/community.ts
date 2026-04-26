import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { relaxedLimit } from "@/lib/rate-limit";
import { loadMiniAppCatalog } from "@/lib/miniapp-catalog";

type CommunityApp = {
  app_id: string;
  name: string;
  description: string;
  icon: string;
  logo_url?: string | null;
  banner_url?: string | null;
  category: string;
  entry_url: string;
  contract_hash?: string | null;
  source: "community";
  status: string | null;
  developer: {
    name: string;
    address: string;
    verified?: boolean;
  };
  permissions: Record<string, unknown>;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  if (!isSupabaseConfigured) {
    // Graceful degradation: return empty list when Supabase is not configured
    res.status(200).json({ apps: [] });
    return;
  }

  const status = String(req.query.status || "active")
    .trim()
    .toLowerCase();
  const allowedStatuses = ["active", "pending", "rejected"];
  if (!allowedStatuses.includes(status)) {
    return apiError.badRequest(res, "Invalid status value");
  }
  const category = String(req.query.category || "")
    .trim()
    .toLowerCase();

  try {
    if (status === "active") {
      const catalog = await loadMiniAppCatalog("active");
      const apps = catalog
        .filter((app) => app.app_id.startsWith("community-"))
        .filter(
          (app) => !category || category === "all" || app.category === category,
        )
        .map((app) => ({
          app_id: app.app_id,
          name: app.name,
          description: app.description,
          icon: app.icon,
          logo_url: app.logo_url ?? null,
          banner_url: app.banner_url ?? null,
          category: app.category,
          entry_url: app.entry_url,
          contract_hash: app.contract_hash,
          source: "community" as const,
          status: app.status ?? "active",
          developer: {
            name: "Community Developer",
            address: "",
            verified: false,
          },
          permissions: app.permissions || {},
        }));

      res.setHeader(
        "Cache-Control",
        "s-maxage=300, stale-while-revalidate=600",
      );
      res.status(200).json({ apps });
      return;
    }

    const submissionStatus = status === "rejected" ? "rejected" : "pending";
    let query = supabase
      .from("miniapp_submissions")
      .select(
        "app_id,name,description,icon,category,entry_url,contract_hash,status,developer_name,developer_address,permissions",
      )
      .eq("source", "community")
      .eq("status", submissionStatus);

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query
      .order("submitted_at", { ascending: false })
      .limit(200);
    if (error) {
      logger.warn("Community submissions query failed:", error.message);
      // Graceful degradation: return empty list on DB error so UI remains functional
      res.status(200).json({ apps: [] });
      return;
    }

    const apps: CommunityApp[] = (data || []).map((row) => ({
      app_id: row.app_id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      logo_url: null,
      banner_url: null,
      category: row.category,
      entry_url: row.entry_url,
      contract_hash: row.contract_hash,
      source: "community",
      status: row.status,
      developer: {
        name: row.developer_name || "Community Developer",
        address: row.developer_address || "",
        verified: false,
      },
      permissions: row.permissions || {},
    }));

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ apps });
    return;
  } catch (error) {
    logger.warn(
      "Fetch community apps error:",
      error instanceof Error ? error.message : "unknown error",
    );
    // Graceful degradation: return empty list on error so UI remains functional
    res.status(200).json({ apps: [] });
    return;
  }
}

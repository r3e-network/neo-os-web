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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  if (!isSupabaseConfigured) {
    return res.status(200).json({ apps: [] });
  }

  const status = String(req.query.status || "active").trim().toLowerCase();
  const allowedStatuses = ["active", "pending", "rejected"];
  if (!allowedStatuses.includes(status)) {
    return apiError.badRequest(res, "Invalid status value");
  }
  const category = String(req.query.category || "").trim().toLowerCase();

  try {
    if (status === "active") {
      const catalog = await loadMiniAppCatalog("active");
      const apps = catalog
        .filter((app) => app.app_id.startsWith("community-"))
        .filter((app) => !category || category === "all" || app.category === category)
        .map((app) => ({
          app_id: app.app_id,
          name: app.name,
          description: app.description,
          icon: app.icon,
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

      return res.status(200).json({ apps });
    }

    const submissionStatus = status === "rejected" ? "rejected" : "pending";
    let query = supabase
      .from("miniapp_submissions")
      .select("*")
      .eq("source", "community")
      .eq("status", submissionStatus);

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query.order("submitted_at", { ascending: false });
    if (error) {
      logger.warn("Community submissions query failed:", error.message);
      return res.status(200).json({ apps: [] });
    }

    const apps: CommunityApp[] = (data || []).map((row) => ({
      app_id: row.app_id,
      name: row.name,
      description: row.description,
      icon: row.icon,
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

    return res.status(200).json({ apps });
  } catch (error) {
    logger.warn("Fetch community apps error:", error);
    return res.status(200).json({ apps: [] });
  }
}

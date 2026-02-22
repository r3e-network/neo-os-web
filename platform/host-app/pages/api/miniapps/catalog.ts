import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import { filterCatalogByAppId, loadMiniAppCatalog } from "@/lib/miniapp-catalog";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const statusRaw = String(req.query.status || "active").trim().toLowerCase();
  const status = statusRaw === "pending" || statusRaw === "disabled" ? statusRaw : "active";
  const appId = String(req.query.app_id || "").trim();
  const search = String(req.query.search || "").trim().toLowerCase();

  try {
    let catalog = await loadMiniAppCatalog(status, { includeManifest: Boolean(appId) });

    if (search) {
      catalog = catalog.filter((item) => {
        const id = String(item.app_id || "").toLowerCase();
        const name = String(item.name || "").toLowerCase();
        return id.includes(search) || name.includes(search);
      });
    }

    if (appId) {
      const app = filterCatalogByAppId(catalog, appId);
      if (!app) {
        return apiError.notFound(res, "MiniApp not found");
      }
      return res.status(200).json({ app });
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ apps: catalog });
  } catch (err) {
    logger.error("Failed to load miniapp catalog:", err instanceof Error ? err.message : "unknown error");
    return apiError.internal(res);
  }
}

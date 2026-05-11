import type { NextApiRequest, NextApiResponse } from "next";
import type { MiniAppInfo } from "@/components/types";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { relaxedLimit } from "@/lib/rate-limit";
import {
  filterCatalogByNetwork,
  filterCatalogByAppId,
  loadMiniAppCatalog,
  resolveCatalogNetwork,
  supportsCatalogNetwork,
} from "@/lib/miniapp-catalog";
import { getRpcNetwork } from "@/lib/rpc-helpers";
import {
  loadBundledMiniAppById,
  loadMiniAppDefinitions,
} from "@/lib/miniapp-definitions";
import { compactMiniAppManifestForCatalog } from "@/lib/miniapp-catalog-view";

// The bundled JSON definitions in `public/miniapp-definitions/` and the
// per-app `apps/<slug>/neo-manifest.json` files are version-controlled
// and ship with each release; the Supabase `miniapps` row mirrors them
// but can drift (e.g. an old testnet hash left over from an earlier
// deploy). When both sources have the same `app_id`, the bundled
// definition wins for authoritative on-chain fields. This stops the
// frontend from invoking a stale/wrong contract.
const BUNDLE_AUTHORITATIVE_FIELDS = [
  "name",
  "description",
  "category",
  "contract_hash",
  "manifest",
  "entry_url",
  "dapp_url",
  "permissions",
  "operations",
  "detail_template",
  "logo_url",
  "banner_url",
  "docs_url",
] as const;

type CatalogApp = Record<string, unknown> & { app_id?: string };

function mergeBundle(
  remote: CatalogApp,
  bundled: CatalogApp | null,
): CatalogApp {
  if (!bundled) return remote;
  const merged: CatalogApp = { ...remote };
  for (const field of BUNDLE_AUTHORITATIVE_FIELDS) {
    if (bundled[field] !== undefined && bundled[field] !== null) {
      merged[field] = bundled[field];
    }
  }
  return merged;
}

function compactCatalogResponseItem(item: CatalogApp): CatalogApp {
  const compact: CatalogApp = {};
  for (const field of [
    "app_id",
    "name",
    "description",
    "icon",
    "category",
    "entry_url",
    "dapp_url",
    "contract_hash",
    "status",
    "source",
    "permissions",
    "limits",
    "logo_url",
    "banner_url",
    "docs_url",
    "name_en",
    "name_zh",
    "name_ja",
    "name_ko",
    "description_en",
    "description_zh",
    "description_ja",
    "description_ko",
    "category_name",
    "category_name_zh",
    "category_name_ja",
    "category_name_ko",
  ] as const) {
    if (item[field] !== undefined && item[field] !== null) {
      (compact as Record<string, unknown>)[field] = item[field];
    }
  }
  const manifest = compactMiniAppManifestForCatalog(item.manifest);
  if (manifest) compact.manifest = manifest;
  return compact;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  const statusRaw = String(req.query.status || "active")
    .trim()
    .toLowerCase();
  const status =
    statusRaw === "pending" || statusRaw === "disabled" ? statusRaw : "active";
  const appId = String(req.query.app_id || "").trim();
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();
  const scope = String(req.query.scope || "")
    .trim()
    .toLowerCase();
  const includeAllEnabledApps = !appId && (scope === "all" || scope === "enabled");
  const network = resolveCatalogNetwork(req.query.network)
    || (includeAllEnabledApps ? null : resolveCatalogNetwork(getRpcNetwork()));

  try {
    const remoteCatalog = await loadMiniAppCatalog(status, {
      includeManifest: Boolean(appId),
    });

    if (appId) {
      const remote = filterCatalogByAppId(remoteCatalog, appId);
      const bundled = await loadBundledMiniAppById(appId);
      if (!remote && !bundled) {
        return apiError.notFound(res, "MiniApp not found");
      }
      const app = remote
        ? mergeBundle(remote as CatalogApp, bundled as CatalogApp | null)
        : (bundled as CatalogApp);
      if (!supportsCatalogNetwork(app as MiniAppInfo, network)) {
        return apiError.notFound(res, "MiniApp not found on requested network");
      }
      res.status(200).json({ app });
      return;
    }

    // Bulk path:
    //   1. Always overlay authoritative fields from the bundled definition
    //      onto any matching Supabase row (corrects stale contract_hash etc.)
    //   2. Append bundled-only entries ONLY when the requested status is
    //      "active" — bundled definitions ship as production-active; they
    //      shouldn't appear under the "pending" or "disabled" status filter
    //      which is meant for Supabase-tracked publish state.
    //   3. Apply the search filter LAST so it catches both merged and
    //      appended entries.
    const bundles = await loadMiniAppDefinitions();
    const bundleById = new Map<string, CatalogApp>();
    for (const b of bundles) {
      if (b?.app_id) bundleById.set(String(b.app_id), b as CatalogApp);
    }
    const seen = new Set<string>();
    let mergedCatalog: CatalogApp[] = [];
    for (const item of remoteCatalog) {
      const id = String(item.app_id || "");
      seen.add(id);
      mergedCatalog.push(
        mergeBundle(item as CatalogApp, bundleById.get(id) || null),
      );
    }
    if (status === "active") {
      for (const [id, b] of bundleById.entries()) {
        if (!seen.has(id)) mergedCatalog.push(b);
      }
    }
    if (!includeAllEnabledApps) {
      mergedCatalog = filterCatalogByNetwork(mergedCatalog as MiniAppInfo[], network) as CatalogApp[];
    }

    if (search) {
      mergedCatalog = mergedCatalog.filter((item) => {
        const id = String(item.app_id || "").toLowerCase();
        const name = String(item.name || "").toLowerCase();
        return id.includes(search) || name.includes(search);
      });
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ apps: mergedCatalog.map(compactCatalogResponseItem) });
    return;
  } catch (err) {
    logger.error(
      "Failed to load miniapp catalog:",
      err instanceof Error ? err.message : "unknown error",
    );
    return apiError.internal(res);
  }
}

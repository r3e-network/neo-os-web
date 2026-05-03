import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import {
  getServerSupabaseClient,
  hasServiceRoleSupabase,
} from "@/lib/server-supabase";
import {
  listTemplateEntries,
  normalizeTemplateKind,
  normalizeTemplateSourceType,
  type TemplateCatalogItem,
  type TemplateKind,
} from "@/lib/template-market";

const KIND_SET = new Set(["all", "frontend", "contract"]);
const VERIFIED_SET = new Set(["all", "true", "false"]);
const SOURCE_SET = new Set(["all", "miniapp", "community", "verified"]);

type PublicTemplateMarketResponse = {
  templates: Array<{
    template_kind: TemplateKind;
    template_id: string;
    version: string;
    name: string;
    description: string;
    category: string;
    source_type: "miniapp" | "community" | "verified";
    tags: string[];
    is_verified: boolean;
    usage_count: number;
    rating_avg: number | null;
    rating_count: number;
    schema: Record<string, unknown>;
    ui_schema: Record<string, unknown>;
    manifest: Record<string, unknown>;
    factory_template_ref: string | null;
    updated_at: string;
  }>;
  filters: {
    kind: "all" | "frontend" | "contract";
    category?: string;
    source: "all" | "miniapp" | "community" | "verified";
    verified: "all" | "true" | "false";
    search?: string;
    limit: number;
  };
};

function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function pickQueryString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return asTrimmedString(value[0]);
  return asTrimmedString(value);
}

function normalizeSimple(value: string): string {
  return value.trim().toLowerCase();
}

function parseLimit(value: string, fallback = 60): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(parsed, 200));
}

function toPublicTemplate(
  item: TemplateCatalogItem,
): PublicTemplateMarketResponse["templates"][number] {
  return {
    template_kind: item.template_kind,
    template_id: item.template_id,
    version: item.version,
    name: item.name,
    description: item.description,
    category: item.category,
    source_type: item.source_type,
    tags: item.tags,
    is_verified: item.is_verified,
    usage_count: item.usage_count,
    rating_avg: item.rating_avg,
    rating_count: item.rating_count,
    schema: item.schema,
    ui_schema: item.ui_schema,
    manifest: item.manifest,
    factory_template_ref: item.factory_template_ref,
    updated_at: item.updated_at,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    PublicTemplateMarketResponse | { error: { code: string; message: string } }
  >,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const rawKind = normalizeSimple(pickQueryString(req.query.kind) || "all");
  const rawCategory = pickQueryString(req.query.category);
  const rawSource = normalizeSimple(pickQueryString(req.query.source) || "all");
  const rawVerified = normalizeSimple(
    pickQueryString(req.query.verified) || "all",
  );
  const rawSearch = pickQueryString(req.query.search);
  const limit = parseLimit(pickQueryString(req.query.limit), 60);

  if (!KIND_SET.has(rawKind)) {
    return apiError.badRequest(res, "Invalid kind filter");
  }
  if (!SOURCE_SET.has(rawSource)) {
    return apiError.badRequest(res, "Invalid source filter");
  }
  if (!VERIFIED_SET.has(rawVerified)) {
    return apiError.badRequest(res, "Invalid verified filter");
  }

  const kind =
    rawKind === "all" ? "all" : normalizeTemplateKind(rawKind) || "all";
  const source =
    rawSource === "all" ? "all" : normalizeTemplateSourceType(rawSource);
  const verified = rawVerified === "all" ? "all" : rawVerified;

  const emptyPayload: PublicTemplateMarketResponse = {
    templates: [],
    filters: {
      kind,
      category: rawCategory || undefined,
      source,
      verified: verified as "all" | "true" | "false",
      search: rawSearch || undefined,
      limit,
    },
  };

  if (!hasServiceRoleSupabase()) {
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(emptyPayload);
    return;
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(emptyPayload);
    return;
  }

  try {
    const templates = await listTemplateEntries(supabase, {
      kind,
      category: rawCategory || undefined,
      source,
      active: "true",
      verified: verified === "true" || verified === "false" ? verified : "all",
      search: rawSearch || undefined,
      limit,
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({
      templates: templates.map(toPublicTemplate),
      filters: {
        kind,
        category: rawCategory || undefined,
        source,
        verified: verified as "all" | "true" | "false",
        search: rawSearch || undefined,
        limit,
      },
    });
    return;
  } catch (error) {
    logger.error(
      "public template market query failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError.internal(res, "Failed to load template marketplace");
  }
}

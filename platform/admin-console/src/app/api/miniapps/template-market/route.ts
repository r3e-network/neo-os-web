import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { HOST_PROXY_TIMEOUTS, proxyToHost, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

const KIND_SET = new Set(["all", "frontend", "contract"]);
const MODE_SET = new Set(["templates", "requests"]);
const ACTIVE_SET = new Set(["all", "true", "false"]);
const VERIFIED_SET = new Set(["all", "true", "false"]);
const SOURCE_SET = new Set(["all", "miniapp", "community", "verified"]);
const REQUEST_STATUS_SET = new Set(["all", "pending", "approved", "rejected", "cancelled"]);

function asNormalized(value: string | null): string {
  return String(value || "").trim().toLowerCase();
}

const upsertPayloadSchema = z.object({
  action: z.literal("upsert_template"),
  kind: z.enum(["frontend", "contract"]),
  template_id: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]*$/, "Invalid template_id format"),
  version: z.string().trim().min(1).optional(),
  owner_user_id: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  category: z.string().trim().optional(),
  source_type: z.enum(["miniapp", "community", "verified"]).optional(),
  tags: z.array(z.string().trim()).optional(),
  schema: z.record(z.unknown()).optional(),
  ui_schema: z.record(z.unknown()).optional(),
  manifest: z.record(z.unknown()),
  is_active: z.boolean().optional(),
  is_verified: z.boolean().optional(),
  factory_template_ref: z.string().trim().optional().nullable(),
});

const reviewPayloadSchema = z.object({
  action: z.literal("review_request"),
  request_id: z.string().uuid(),
  decision: z.enum(["approve", "reject", "cancel"]),
  review_note: z.string().max(2000).optional(),
});

const postSchema = z.union([upsertPayloadSchema, reviewPayloadSchema]);

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  const url = new URL(req.url);
  const mode = asNormalized(url.searchParams.get("mode")) || "templates";
  const kind = asNormalized(url.searchParams.get("kind")) || "all";
  const category = String(url.searchParams.get("category") || "").trim();
  const templateId = asNormalized(url.searchParams.get("template_id"));
  const active = asNormalized(url.searchParams.get("active")) || "all";
  const verified = asNormalized(url.searchParams.get("verified")) || "all";
  const source = asNormalized(url.searchParams.get("source")) || "all";
  const status = asNormalized(url.searchParams.get("status")) || "all";
  const search = String(url.searchParams.get("search") || "").trim();
  const limitRaw = Number.parseInt(asNormalized(url.searchParams.get("limit")) || "100", 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 300)) : 100;

  if (!MODE_SET.has(mode)) {
    return jsonError("Invalid mode filter", 400);
  }
  if (!KIND_SET.has(kind)) {
    return jsonError("Invalid kind filter", 400);
  }
  if (!ACTIVE_SET.has(active)) {
    return jsonError("Invalid active filter", 400);
  }
  if (!VERIFIED_SET.has(verified)) {
    return jsonError("Invalid verified filter", 400);
  }
  if (!SOURCE_SET.has(source)) {
    return jsonError("Invalid source filter", 400);
  }
  if (!REQUEST_STATUS_SET.has(status)) {
    return jsonError("Invalid status filter", 400);
  }

  if (templateId && !/^[a-z0-9][a-z0-9._-]*$/.test(templateId)) {
    return jsonError("Invalid template_id format", 400);
  }

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/template-market",
    searchParams: {
      mode,
      kind: kind !== "all" ? kind : undefined,
      category: category || undefined,
      template_id: templateId || undefined,
      active: active !== "all" ? active : undefined,
      verified: verified !== "all" ? verified : undefined,
      status: status !== "all" ? status : undefined,
      limit: String(limit),
    },
    timeoutMs: HOST_PROXY_TIMEOUTS.EXTENDED,
    notOkError: "Failed to load template market data",
    fallbackError: "Failed to reach host-app template market endpoint",
    logLabel: "[template-market]",
    onSuccess: (data) => {
      const payload = data as Record<string, unknown>;

      if (mode === "templates") {
        const templates = Array.isArray(payload.templates) ? payload.templates : [];
        const filtered = templates
          .filter((item) => {
            if (!item || typeof item !== "object") return false;
            const row = item as Record<string, unknown>;
            const rowSource = asNormalized(String(row.source_type || ""));
            if (source !== "all" && rowSource !== source) return false;
            if (!search) return true;

            const text = [
              row.template_id,
              row.name,
              row.description,
              row.category,
              ...(Array.isArray(row.tags) ? row.tags : []),
            ]
              .map((value) => String(value || "").toLowerCase())
              .join(" ");
            return text.includes(search.toLowerCase());
          })
          .slice(0, limit);

        return NextResponse.json({
          mode: "templates",
          templates: filtered,
          approval_required: Boolean(payload.approval_required),
        });
      }

      return NextResponse.json({
        mode: "requests",
        requests: Array.isArray(payload.requests) ? payload.requests : [],
      });
    },
  });
}

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  let payload: z.infer<typeof postSchema>;
  try {
    const body = await req.json();
    payload = postSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.errors[0]?.message || "Invalid input", 400);
    }
    return jsonError("Invalid JSON body", 400);
  }

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/template-market",
    method: "POST",
    body: payload,
    timeoutMs: HOST_PROXY_TIMEOUTS.EXTENDED,
    notOkError: "Template market request failed",
    fallbackError: "Failed to reach host-app template market endpoint",
    logLabel: "[template-market POST]",
    parseFallback: { success: true },
  });
}

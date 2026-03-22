import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { createProxyHeaders, parseHostErrorPayload, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const STATUS_SET = new Set(["all", "pending", "approved", "rejected", "applied", "cancelled"]);

function normalized(value: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function toCsvCell(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(payload: Array<Record<string, unknown>>): string {
  const headers = [
    "id",
    "app_id",
    "status",
    "requested_version_no",
    "requested_by",
    "requested_at",
    "reviewed_by",
    "reviewed_at",
    "applied_version_id",
    "applied_at",
    "request_note",
    "review_note",
    "age_minutes",
    "sla_breached",
    "escalated",
  ];

  const rows = payload.map((item) => {
    const timing = (item.timing && typeof item.timing === "object" ? item.timing : {}) as Record<string, unknown>;
    return [
      toCsvCell(item.id),
      toCsvCell(item.app_id),
      toCsvCell(item.status),
      toCsvCell(item.requested_version_no),
      toCsvCell(item.requested_by),
      toCsvCell(item.requested_at),
      toCsvCell(item.reviewed_by),
      toCsvCell(item.reviewed_at),
      toCsvCell(item.applied_version_id),
      toCsvCell(item.applied_at),
      toCsvCell(item.request_note),
      toCsvCell(item.review_note),
      toCsvCell(timing.ageMinutes),
      toCsvCell(timing.isSlaBreached),
      toCsvCell(timing.isEscalated),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  const url = new URL(req.url);
  const appId = normalized(url.searchParams.get("app_id"));
  const status = normalized(url.searchParams.get("status")) || "all";

  if (appId && !APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }
  if (!STATUS_SET.has(status)) {
    return jsonError("Invalid status filter", 400);
  }

  try {
    const upstream = new URL("/api/miniapps/admin/publish-requests", hostAppBaseURL);
    if (appId) upstream.searchParams.set("app_id", appId);
    if (status !== "all") upstream.searchParams.set("status", status);

    const response = await fetch(upstream.toString(), {
      headers: createProxyHeaders(req),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to load publish requests for export");
      return jsonError(message, response.status);
    }

    const payload = await response.json().catch((e: unknown) => { console.warn("[publish-requests/export] failed to parse response JSON:", e instanceof Error ? e.message : String(e)); return { requests: [] }; }) as {
      requests?: Array<Record<string, unknown>>;
    };
    const requests = Array.isArray(payload.requests) ? payload.requests : [];

    const csv = toCsv(requests);
    const now = new Date().toISOString().replace(/[:.]/g, "-");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="miniapp-publish-requests-${now}.csv"`,
        "Cache-Control": "no-store, private",
      },
    });
  } catch {
    return jsonError("Failed to reach host-app publish request endpoint", 502);
  }
}

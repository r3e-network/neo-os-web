import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { createProxyHeaders, parseHostErrorPayload, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const REQUEST_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

function normalized(value: string | null): string {
  return String(value || "").trim().toLowerCase();
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
  const requestId = normalized(url.searchParams.get("request_id"));
  const limit = normalized(url.searchParams.get("limit"));

  if (appId && !APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }
  if (requestId && !REQUEST_ID_PATTERN.test(requestId)) {
    return jsonError("Invalid request_id format", 400);
  }

  try {
    const upstream = new URL("/api/miniapps/admin/publish-audit-verify", hostAppBaseURL);
    if (appId) upstream.searchParams.set("app_id", appId);
    if (requestId) upstream.searchParams.set("request_id", requestId);
    if (limit) upstream.searchParams.set("limit", limit);

    const response = await fetch(upstream.toString(), {
      headers: createProxyHeaders(req),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to verify audit chain");
      return jsonError(message, response.status);
    }

    const payload = await response.json().catch((e: unknown) => { console.warn("[verify-audit] failed to parse response JSON:", e instanceof Error ? e.message : String(e)); return { ok: false, issues: [] }; });
    return NextResponse.json(payload);
  } catch {
    return jsonError("Failed to reach host-app audit verify endpoint", 502);
  }
}

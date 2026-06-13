import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { HOST_PROXY_TIMEOUTS, proxyToHost, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

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

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/publish-audit-verify",
    searchParams: {
      app_id: appId || undefined,
      request_id: requestId || undefined,
      limit: limit || undefined,
    },
    timeoutMs: HOST_PROXY_TIMEOUTS.EXTENDED,
    notOkError: "Failed to verify audit chain",
    fallbackError: "Failed to reach host-app audit verify endpoint",
    logLabel: "[verify-audit]",
    parseFallback: { ok: false, issues: [] },
    onSuccess: (payload) => NextResponse.json(payload),
  });
}

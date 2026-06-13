import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { HOST_PROXY_TIMEOUTS, proxyToHost, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const ALLOWED_STATUS = new Set(["active", "pending", "disabled"]);

function normalizeSearchParam(value: string | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  const url = new URL(req.url);
  const appId = normalizeSearchParam(url.searchParams.get("app_id"));
  const status = normalizeSearchParam(url.searchParams.get("status"));
  const search = normalizeSearchParam(url.searchParams.get("search"));

  if (appId && !APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }

  if (status && !ALLOWED_STATUS.has(status)) {
    return jsonError("Invalid status filter", 400);
  }

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/catalog",
    searchParams: { status, app_id: appId, search },
    timeoutMs: HOST_PROXY_TIMEOUTS.STANDARD,
    parseHostError: false,
    notOkError: "Failed to fetch miniapps",
    fallbackError: "Failed to reach host-app catalog endpoint",
    logLabel: "[miniapps]",
    onSuccess: (data) => {
      const apps = Array.isArray((data as { apps?: unknown })?.apps) ? (data as { apps: unknown[] }).apps : [];
      return NextResponse.json(apps);
    },
  });
}

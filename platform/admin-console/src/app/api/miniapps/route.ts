import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { createProxyHeaders, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

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

  try {
    const upstream = new URL("/api/miniapps/catalog", hostAppBaseURL);
    if (status) upstream.searchParams.set("status", status);
    if (appId) upstream.searchParams.set("app_id", appId);
    if (search) upstream.searchParams.set("search", search);

    const response = await fetch(upstream.toString(), {
      headers: createProxyHeaders(req),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return jsonError("Failed to fetch miniapps", response.status);
    }

    const data = await response.json().catch((e: unknown) => { console.warn("[miniapps] failed to parse response JSON:", e instanceof Error ? e.message : String(e)); return ({}); });
    const apps = Array.isArray(data?.apps) ? data.apps : [];
    return NextResponse.json(apps);
  } catch {
    return jsonError("Failed to reach host-app catalog endpoint", 502);
  }
}

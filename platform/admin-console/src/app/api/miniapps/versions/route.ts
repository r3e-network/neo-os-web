import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { createProxyHeaders, parseHostErrorPayload, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const RELEASE_CHANNELS = new Set(["all", "draft", "published"]);

function normalize(value: string | null): string {
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
  const appId = normalize(url.searchParams.get("app_id"));
  const releaseChannel = normalize(url.searchParams.get("release_channel")) || "all";

  if (!APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }
  if (!RELEASE_CHANNELS.has(releaseChannel)) {
    return jsonError("Invalid release_channel filter", 400);
  }

  try {
    const upstream = new URL("/api/miniapps/admin/versions", hostAppBaseURL);
    upstream.searchParams.set("app_id", appId);
    upstream.searchParams.set("include_payload", "true");
    if (releaseChannel !== "all") {
      upstream.searchParams.set("release_channel", releaseChannel);
    }

    const response = await fetch(upstream.toString(), {
      headers: createProxyHeaders(req),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to fetch miniapp versions");
      return jsonError(message, response.status);
    }

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload || { app_id: appId, versions: [] });
  } catch {
    return jsonError("Failed to reach host-app versions endpoint", 502);
  }
}

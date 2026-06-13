import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { HOST_PROXY_TIMEOUTS, proxyToHost, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

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

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/versions",
    searchParams: {
      app_id: appId,
      include_payload: "true",
      release_channel: releaseChannel !== "all" ? releaseChannel : undefined,
    },
    timeoutMs: HOST_PROXY_TIMEOUTS.STANDARD,
    notOkError: "Failed to fetch miniapp versions",
    fallbackError: "Failed to reach host-app versions endpoint",
    logLabel: "[miniapps/versions]",
    parseFallback: null,
    onSuccess: (payload) => NextResponse.json(payload || { app_id: appId, versions: [] }),
  });
}

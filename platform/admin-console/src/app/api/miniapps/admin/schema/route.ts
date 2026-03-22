import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { createProxyHeaders, parseHostErrorPayload, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  try {
    const upstream = new URL("/api/miniapps/admin/schema", hostAppBaseURL);
    const response = await fetch(upstream.toString(), {
      headers: createProxyHeaders(req),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to load admin schema");
      return jsonError(message, response.status);
    }

    const payload = await response.json().catch((e: unknown) => { console.warn("[admin/schema] failed to parse response JSON:", e instanceof Error ? e.message : String(e)); return ({}); });
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return jsonError("Failed to reach host-app admin schema endpoint", 502);
  }
}

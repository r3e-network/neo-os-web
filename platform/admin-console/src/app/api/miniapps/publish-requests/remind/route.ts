import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { createProxyHeaders, parseHostErrorPayload, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

function parseDryRun(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  let dryRun = false;
  try {
    const body = await req.json().catch((e: unknown) => { console.warn("[publish-requests/remind] failed to parse request body JSON:", e instanceof Error ? e.message : String(e)); return ({}); });
    if (body && typeof body === "object") {
      dryRun = parseDryRun((body as Record<string, unknown>).dry_run);
    }
  } catch (_e: unknown) {
    console.warn("[publish-requests/remind] dry_run parse failed:", _e instanceof Error ? _e.message : String(_e));
  }

  try {
    const upstream = new URL("/api/miniapps/admin/publish-reminders", hostAppBaseURL);
    const response = await fetch(upstream.toString(), {
      method: "POST",
      headers: createProxyHeaders(req),
      body: JSON.stringify({ dry_run: dryRun }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to trigger publish reminders");
      return jsonError(message, response.status);
    }

    const payload = await response.json().catch((e: unknown) => { console.warn("[publish-requests/remind] failed to parse response JSON:", e instanceof Error ? e.message : String(e)); return { success: true, reminders: [] }; });
    return NextResponse.json(payload);
  } catch {
    return jsonError("Failed to reach host-app publish reminder endpoint", 502);
  }
}

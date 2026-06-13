import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { HOST_PROXY_TIMEOUTS, proxyToHost, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

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

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/publish-reminders",
    method: "POST",
    body: { dry_run: dryRun },
    timeoutMs: HOST_PROXY_TIMEOUTS.EXTENDED,
    notOkError: "Failed to trigger publish reminders",
    fallbackError: "Failed to reach host-app publish reminder endpoint",
    logLabel: "[publish-requests/remind]",
    parseFallback: { success: true, reminders: [] },
    onSuccess: (payload) => NextResponse.json(payload),
  });
}

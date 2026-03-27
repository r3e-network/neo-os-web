import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { miniAppConfigBaseSchema } from "@/lib/schemas";
import { createProxyHeaders, parseHostErrorPayload, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  let payload: Record<string, unknown>;
  let action = "save_draft";
  try {
    const body = await req.json();
    const parsed = miniAppConfigBaseSchema.passthrough().parse(body);
    payload = parsed as Record<string, unknown>;
    const rawAction = String((body as Record<string, unknown>)?.action || "").trim();
    if (rawAction) action = rawAction;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  try {
    const upstream = new URL("/api/miniapps/admin/upsert", hostAppBaseURL);
    const response = await fetch(upstream.toString(), {
      method: "POST",
      headers: createProxyHeaders(req),
      body: JSON.stringify({
        ...payload,
        action,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to create MiniApp");
      return jsonError(message, response.status);
    }

    const data = await response.json().catch((e: unknown) => { console.warn("[miniapps/create] failed to parse response JSON:", e instanceof Error ? e.message : String(e)); return null; });
    return NextResponse.json(data || { success: true }, { status: response.status });
  } catch {
    return jsonError("Failed to reach host-app admin endpoint", 502);
  }
}

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { miniAppConfigBaseSchema } from "@/lib/schemas";
import { createProxyHeaders, parseHostErrorPayload, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAdminAuth(_req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  const { id } = await params;
  const appId = String(id || "").trim();
  if (!APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }

  try {
    const upstream = new URL("/api/miniapps/catalog", hostAppBaseURL);
    upstream.searchParams.set("app_id", appId);
    const response = await fetch(upstream.toString(), {
      headers: createProxyHeaders(_req),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return jsonError("Failed to fetch", response.status);
    }
    const data = await response.json().catch((e: unknown) => { console.warn("[miniapps/id GET] failed to parse response JSON:", e instanceof Error ? e.message : String(e)); return ({}); });
    if (!data || !data.app || typeof data.app !== "object") {
      return jsonError("Not found", 404);
    }
    return NextResponse.json(data.app);
  } catch {
    return jsonError("Failed to reach host-app catalog endpoint", 502);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  const { id } = await params;
  const appId = String(id || "").trim();
  if (!APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }

  try {
    const upstream = new URL("/api/miniapps/admin/status", hostAppBaseURL);
    const response = await fetch(upstream.toString(), {
      method: "POST",
      headers: createProxyHeaders(req),
      body: JSON.stringify({ app_id: appId, status: "disabled" }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to disable miniapp");
      return jsonError(message, response.status);
    }
    await response.json().catch((e: unknown) => { console.warn("[miniapps/id DELETE] failed to parse response JSON:", e instanceof Error ? e.message : String(e)); });
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Failed to reach host-app admin endpoint", 502);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const action = String(body.action || "save_draft");
  const normalizedBody = { ...body };
  delete normalizedBody.action;

  // Validate partial config
  const partial = miniAppConfigBaseSchema.partial().safeParse(normalizedBody);
  if (!partial.success) {
    return jsonError(partial.error.errors[0]?.message || "Invalid input", 400);
  }

  const { id } = await params;
  const appId = String(id || "").trim();
  if (!APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }

  try {
    const response = await fetch(new URL("/api/miniapps/admin/upsert", hostAppBaseURL).toString(), {
      method: "POST",
      headers: createProxyHeaders(req),
      body: JSON.stringify({
        ...partial.data,
        app_id: appId,
        action,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to update miniapp");
      return jsonError(message, response.status);
    }
    await response.json().catch((e: unknown) => { console.warn("[miniapps/id PATCH] failed to parse response JSON:", e instanceof Error ? e.message : String(e)); });
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("Failed to reach host-app admin endpoint", 502);
  }
}

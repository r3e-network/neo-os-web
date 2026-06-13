import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { miniAppConfigBaseSchema } from "@/lib/schemas";
import { HOST_PROXY_TIMEOUTS, proxyToHost, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

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

  return proxyToHost(_req, {
    hostAppBaseURL,
    path: "/api/miniapps/catalog",
    searchParams: { app_id: appId },
    timeoutMs: HOST_PROXY_TIMEOUTS.STANDARD,
    parseHostError: false,
    notOkError: "Failed to fetch",
    fallbackError: "Failed to reach host-app catalog endpoint",
    logLabel: "[miniapps/id GET]",
    onSuccess: (data) => {
      const app = (data as { app?: unknown })?.app;
      if (!data || !app || typeof app !== "object") {
        return jsonError("Not found", 404);
      }
      return NextResponse.json(app);
    },
  });
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

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/status",
    method: "POST",
    body: { app_id: appId, status: "disabled" },
    timeoutMs: HOST_PROXY_TIMEOUTS.STANDARD,
    notOkError: "Failed to disable miniapp",
    fallbackError: "Failed to reach host-app admin endpoint",
    logLabel: "[miniapps/id DELETE]",
    onSuccess: () => NextResponse.json({ success: true }),
  });
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

  // Validate partial config. `.passthrough()` mirrors the create route so
  // extended keys accepted on create are not silently stripped on update.
  const partial = miniAppConfigBaseSchema.partial().passthrough().safeParse(normalizedBody);
  if (!partial.success) {
    return jsonError(partial.error.errors[0]?.message || "Invalid input", 400);
  }

  const { id } = await params;
  const appId = String(id || "").trim();
  if (!APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/upsert",
    method: "POST",
    body: { ...partial.data, app_id: appId, action },
    timeoutMs: HOST_PROXY_TIMEOUTS.STANDARD,
    notOkError: "Failed to update miniapp",
    fallbackError: "Failed to reach host-app admin endpoint",
    logLabel: "[miniapps/id PATCH]",
    onSuccess: () => NextResponse.json({ success: true }),
  });
}

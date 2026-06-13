import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { miniAppConfigBaseSchema } from "@/lib/schemas";
import { HOST_PROXY_TIMEOUTS, proxyToHost, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

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
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(err.errors[0]?.message || "Invalid input", 400);
    }
    return jsonError("Invalid JSON body", 400);
  }

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/upsert",
    method: "POST",
    body: { ...payload, action },
    timeoutMs: HOST_PROXY_TIMEOUTS.STANDARD,
    notOkError: "Failed to create MiniApp",
    fallbackError: "Failed to reach host-app admin endpoint",
    logLabel: "[miniapps/create]",
    parseFallback: null,
    onSuccess: (data, response) =>
      NextResponse.json(data || { success: true }, { status: response.status }),
  });
}

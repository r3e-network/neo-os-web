import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { HOST_PROXY_TIMEOUTS, proxyToHost, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const STATUS_SET = new Set(["all", "pending", "approved", "rejected", "applied", "cancelled"]);

const reviewSchema = z.object({
  request_id: z.string().uuid(),
  decision: z.enum(["approve", "reject", "cancel"]),
  review_note: z.string().max(2000).optional(),
});

function normalized(value: string | null): string {
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
  const appId = normalized(url.searchParams.get("app_id"));
  const status = normalized(url.searchParams.get("status")) || "all";

  if (appId && !APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }
  if (!STATUS_SET.has(status)) {
    return jsonError("Invalid status filter", 400);
  }

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/publish-requests",
    searchParams: {
      app_id: appId || undefined,
      status: status !== "all" ? status : undefined,
    },
    timeoutMs: HOST_PROXY_TIMEOUTS.STANDARD,
    notOkError: "Failed to load publish requests",
    fallbackError: "Failed to reach host-app publish request endpoint",
    logLabel: "[publish-requests]",
    parseFallback: { requests: [] },
    onSuccess: (payload) => NextResponse.json(payload),
  });
}

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const hostAppBaseURL = resolveHostAppBaseURL();
  if (!hostAppBaseURL) {
    return jsonError("MINIAPP_HOST_APP_BASE_URL is not configured", 500);
  }

  let payload: z.infer<typeof reviewSchema>;
  try {
    const body = await req.json();
    payload = reviewSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(error.errors[0]?.message || "Invalid input", 400);
    }
    return jsonError("Invalid JSON body", 400);
  }

  return proxyToHost(req, {
    hostAppBaseURL,
    path: "/api/miniapps/admin/publish-requests",
    method: "POST",
    body: payload,
    timeoutMs: HOST_PROXY_TIMEOUTS.EXTENDED,
    notOkError: "Failed to review publish request",
    fallbackError: "Failed to reach host-app publish request endpoint",
    logLabel: "[publish-requests POST]",
    parseFallback: { success: true },
    onSuccess: (data) => NextResponse.json(data),
  });
}

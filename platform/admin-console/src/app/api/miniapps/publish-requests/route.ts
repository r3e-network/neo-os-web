import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { createProxyHeaders, parseHostErrorPayload, resolveHostAppBaseURL } from "@/lib/host-admin-proxy";

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

  try {
    const upstream = new URL("/api/miniapps/admin/publish-requests", hostAppBaseURL);
    if (appId) upstream.searchParams.set("app_id", appId);
    if (status !== "all") upstream.searchParams.set("status", status);

    const response = await fetch(upstream.toString(), {
      headers: createProxyHeaders(req),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to load publish requests");
      return jsonError(message, response.status);
    }

    const payload = await response.json().catch(() => ({ requests: [] }));
    return NextResponse.json(payload);
  } catch {
    return jsonError("Failed to reach host-app publish request endpoint", 502);
  }
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

  try {
    const upstream = new URL("/api/miniapps/admin/publish-requests", hostAppBaseURL);
    const response = await fetch(upstream.toString(), {
      method: "POST",
      headers: createProxyHeaders(req),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const message = await parseHostErrorPayload(response, "Failed to review publish request");
      return jsonError(message, response.status);
    }

    const data = await response.json().catch(() => ({ success: true }));
    return NextResponse.json(data);
  } catch {
    return jsonError("Failed to reach host-app publish request endpoint", 502);
  }
}

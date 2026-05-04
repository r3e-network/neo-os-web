import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import {
  createProxyHeaders,
  resolveHostAppBaseURL,
} from "@/lib/host-admin-proxy";

function parseDryRun(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
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
    const body = (await req.json()) as Record<string, unknown>;
    dryRun = parseDryRun(body?.dry_run);
  } catch {
    dryRun = false;
  }

  let upstreamURL: URL;
  try {
    upstreamURL = new URL(
      "/api/miniapps/admin/import-definitions",
      hostAppBaseURL,
    );
  } catch {
    return jsonError("Invalid MINIAPP_HOST_APP_BASE_URL", 500);
  }
  if (dryRun) upstreamURL.searchParams.set("dry_run", "true");

  try {
    const response = await fetch(upstreamURL.toString(), {
      method: "POST",
      headers: createProxyHeaders(req),
      body: JSON.stringify({ dry_run: dryRun }),
      signal: AbortSignal.timeout(10_000),
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      return jsonError(
        `Unexpected import response: ${text || response.statusText}`,
        502,
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return jsonError("Failed to reach host-app import endpoint", 502);
  }
}

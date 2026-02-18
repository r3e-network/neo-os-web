import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "@/lib/constants";

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const ALLOWED_STATUS = new Set(["active", "pending", "disabled"]);

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeSearchParam(value: string | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonError("Supabase service role not configured");
  }

  const url = new URL(req.url);
  const appId = normalizeSearchParam(url.searchParams.get("app_id"));
  const status = normalizeSearchParam(url.searchParams.get("status"));
  const search = normalizeSearchParam(url.searchParams.get("search"));

  if (appId && !APP_ID_PATTERN.test(appId)) {
    return jsonError("Invalid app_id format", 400);
  }

  if (status && !ALLOWED_STATUS.has(status)) {
    return jsonError("Invalid status filter", 400);
  }

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "created_at.desc");

  if (appId) params.set("app_id", `eq.${appId}`);
  if (status) params.set("status", `eq.${status}`);
  if (search) {
    const escaped = search.replace(/[%_\\,().]/g, "\\$&");
    params.set("or", `app_id.ilike.%${escaped}%,name.ilike.%${escaped}%`);
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/miniapps?${params.toString()}`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return jsonError(text || "Failed to fetch miniapps", response.status);
    }

    const data = await response.json();
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return jsonError("Failed to connect to database", 502);
  }
}

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "@/lib/constants";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const userId = normalizeSearchParam(url.searchParams.get("id"));
  const search = normalizeSearchParam(url.searchParams.get("search"));

  if (userId && !UUID_PATTERN.test(userId)) {
    return jsonError("Invalid user ID format", 400);
  }

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "created_at.desc");
  params.set("limit", "200");

  if (userId) params.set("id", `eq.${userId}`);
  if (search) {
    const escaped = search.replace(/[%_\\,().]/g, "\\$&");
    params.set("or", `address.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/users?${params.toString()}`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return jsonError("Failed to fetch users", response.status);
    }

    const data = await response.json();
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return jsonError("Failed to connect to database", 502);
  }
}

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { getSupabaseServiceEnv } from "@/lib/env";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeSearchParam(value: string | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  let supabase: ReturnType<typeof getSupabaseServiceEnv>;
  try {
    supabase = getSupabaseServiceEnv({ strict: true });
  } catch {
    return jsonError("Admin Supabase environment is not configured");
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
    const response = await fetch(`${supabase.url}/rest/v1/users?${params.toString()}`, {
      headers: {
        apikey: supabase.serviceRoleKey,
        Authorization: `Bearer ${supabase.serviceRoleKey}`,
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

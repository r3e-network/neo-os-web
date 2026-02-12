// =============================================================================
// API Route: Users
// Server-side proxy to Supabase for user data
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://supabase.localhost";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20")));
  const offset = (page - 1) * pageSize;

  const params = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: String(pageSize),
    offset: String(offset),
  });

  if (search) {
    // Sanitize to prevent PostgREST filter injection
    const sanitized = search
      .replace(/[,.()\[\]]/g, "")
      .replace(/\b(eq|neq|gt|gte|lt|lte|like|ilike|is|in|not|or|and|fts|plfts|phfts|wfts)\b/gi, "");
    if (sanitized) {
      params.set("or", `(address.ilike.%${sanitized}%,email.ilike.%${sanitized}%)`);
    }
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/users?${params.toString()}`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "count=exact",
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "Failed to fetch users", detail }, { status: response.status });
    }

    const users = await response.json();
    const total = parseInt(response.headers.get("content-range")?.split("/")[1] || "0");

    return NextResponse.json({ users, total, page, pageSize });
  } catch (error) {
    console.error("Users API error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

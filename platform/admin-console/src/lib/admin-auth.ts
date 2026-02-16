import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const ADMIN_API_KEY = String(process.env.ADMIN_CONSOLE_API_KEY || process.env.ADMIN_API_KEY || "").trim();

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function extractAdminKey(req: Request): string {
  const headerKey = req.headers.get("x-admin-key");
  if (headerKey) return headerKey.trim();

  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  return "";
}

export function requireAdminAuth(req: Request): Response | null {
  if (!ADMIN_API_KEY) {
    return NextResponse.json({ error: "Admin API key not configured" }, { status: 500 });
  }

  const token = extractAdminKey(req);
  if (!token || !safeCompare(token, ADMIN_API_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

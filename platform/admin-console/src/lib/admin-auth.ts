import { NextResponse } from "next/server";

const ADMIN_API_KEY = String(process.env.ADMIN_CONSOLE_API_KEY || process.env.ADMIN_API_KEY || "").trim();

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
  // Allow explicitly disabling auth (e.g. local dev) via ADMIN_AUTH_DISABLED=true
  if (process.env.ADMIN_AUTH_DISABLED === "true") {
    return null;
  }

  if (!ADMIN_API_KEY) {
    return NextResponse.json({ error: "Admin API key not configured" }, { status: 500 });
  }

  const token = extractAdminKey(req);
  if (!token || token !== ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

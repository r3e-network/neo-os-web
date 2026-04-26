import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  const adminKey = String(
    process.env.ADMIN_CONSOLE_API_KEY || process.env.ADMIN_API_KEY || "",
  ).trim();

  if (
    adminKey &&
    !requestHeaders.has("x-admin-key") &&
    !requestHeaders.has("authorization")
  ) {
    requestHeaders.set("x-admin-key", adminKey);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/api/:path*"],
};

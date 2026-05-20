import { NextRequest, NextResponse } from "next/server";

/**
 * Audit fix C-5: removed silent auto-injection of ADMIN_CONSOLE_API_KEY into
 * every browser /api/* request.
 *
 * Previously, the middleware copied the server-side admin key onto any request
 * lacking an x-admin-key / Authorization header. The effect was that anyone
 * who could reach the admin console URL got full admin privileges without
 * ever authenticating — no login, no SSO, no IP allowlist enforced in code.
 *
 * The admin console must now obtain the admin key through an explicit
 * authenticated channel (e.g. operator login form posting to /api/auth/admin,
 * server-side proxy with a signed session cookie). Until that channel is
 * implemented, /api/* routes will reject any request that does not carry a
 * valid `x-admin-key` or `Authorization: Bearer` header (see requireAdminAuth
 * in src/lib/admin-auth.ts).
 *
 * IMPORTANT: deploy the admin console behind network-level access control
 * (VPN / IP allowlist) until a real session-based auth wrapper lands. The
 * absence of auto-injection is necessary, not sufficient, to secure the
 * console.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};

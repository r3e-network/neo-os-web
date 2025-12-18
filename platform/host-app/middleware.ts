import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function buildCSP(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";

  const frameOrigins = (process.env.MINIAPP_FRAME_ORIGINS || "").trim();
  const frameSrc = frameOrigins
    ? `'self' ${frameOrigins}`
    : isDev
      ? "'self' https:"
      : "'self'";

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const connectSrc = supabaseUrl
    ? `'self' ${supabaseUrl}`
    : isDev
      ? "'self' https:"
      : "'self'";

  const csp = [
    "default-src 'self'",
    // Next.js uses inline scripts; nonce-based CSP keeps this strict without 'unsafe-inline'.
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    // Prevent the host itself being embedded.
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return csp.join("; ");
}

export function middleware(req: NextRequest) {
  // Skip CSP for Next.js internals and static assets.
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon") || pathname.startsWith("/robots")) {
    return NextResponse.next();
  }

  const nonce = randomNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-csp-nonce", nonce);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  res.headers.set("Content-Security-Policy", buildCSP(nonce));

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

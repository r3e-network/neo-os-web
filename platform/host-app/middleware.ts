import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function parseFederatedOrigins(): string[] {
  const raw = (process.env.NEXT_PUBLIC_MF_REMOTES || "").trim();
  if (!raw) return [];

  const origins = new Set<string>();
  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separator = entry.includes("@") ? "@" : entry.includes("=") ? "=" : null;
    if (!separator) continue;
    const [, urlRaw] = entry.split(separator);
    const url = String(urlRaw || "").trim();
    if (!url) continue;
    try {
      origins.add(new URL(url).origin);
    } catch {
      continue;
    }
  }

  return Array.from(origins);
}

function buildCSP(nonce: string, allowFrameAncestors: boolean = false): string {
  const isDev = process.env.NODE_ENV !== "production";
  const federatedOrigins = parseFederatedOrigins();

  const frameOrigins = (process.env.MINIAPP_FRAME_ORIGINS || "").trim();
  const frameSrc = frameOrigins ? `'self' ${frameOrigins}` : isDev ? "'self' https:" : "'self'";

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const connectSources = ["'self'"];
  if (supabaseUrl) connectSources.push(supabaseUrl);
  else if (isDev) connectSources.push("https:");
  connectSources.push(...federatedOrigins);
  const connectSrc = connectSources.join(" ");

  const scriptSources = ["'self'", `'nonce-${nonce}'`, ...federatedOrigins];
  // Module Federation requires 'unsafe-eval' for dynamic code loading
  if (isDev) {
    scriptSources.push("'unsafe-eval'");
  }
  const scriptSrc = scriptSources.join(" ");

  const styleSources = ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"];
  const styleSrc = styleSources.join(" ");

  const fontSources = ["'self'", "data:", "https://fonts.gstatic.com"];
  const fontSrc = fontSources.join(" ");

  const csp = [
    "default-src 'self'",
    // Next.js uses inline scripts; nonce-based CSP keeps this strict without 'unsafe-inline'.
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: https:",
    `font-src ${fontSrc}`,
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    // Allow miniapps to be embedded in same-origin iframes (for /launch pages)
    `frame-ancestors ${allowFrameAncestors ? "'self'" : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return csp.join("; ");
}

export function middleware(req: NextRequest) {
  // Skip CSP for Next.js internals, static assets, and miniapps static files.
  const pathname = req.nextUrl.pathname;
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/miniapps/")
  ) {
    return NextResponse.next();
  }

  const nonce = randomNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-csp-nonce", nonce);

  // Allow miniapps to be embedded in iframes (for /launch pages)
  const allowFrameAncestors = pathname.startsWith("/miniapps/");

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  res.headers.set("Content-Security-Policy", buildCSP(nonce, allowFrameAncestors));

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

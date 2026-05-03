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
    const separator = entry.includes("@")
      ? "@"
      : entry.includes("=")
        ? "="
        : null;
    if (!separator) continue;
    const [, urlRaw] = entry.split(separator);
    const url = String(urlRaw || "").trim();
    if (!url) continue;
    try {
      origins.add(new URL(url).origin);
    } catch {
      // Skip malformed URL entries in ALLOWED_ORIGINS
      continue;
    }
  }

  return Array.from(origins);
}

function buildCSP(nonce: string, options: { allowMiniAppEmbedding?: boolean } = {}): string {
  const isDev = process.env.NODE_ENV !== "production";
  const federatedOrigins = parseFederatedOrigins();
  const externalFontStyleSources = [
    "https://fonts.googleapis.com",
    "https://api.fontshare.com",
  ];
  const styleSources = ["'self'", "'unsafe-inline'"];
  if (options.allowMiniAppEmbedding) {
    styleSources.push(...externalFontStyleSources);
  }

  const trustedMiniAppFrameOrigins = ["https://vote.r3e.network"];
  const frameOrigins = (process.env.MINIAPP_FRAME_ORIGINS || "").trim();
  const frameSrc = frameOrigins
    ? `'self' ${frameOrigins}`
    : isDev
      ? "'self' https:"
      : ["'self'", ...trustedMiniAppFrameOrigins].join(" ");

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const connectSources = ["'self'"];
  if (supabaseUrl) {
    // Project-specific Supabase URL (https) — Realtime needs the wss
    // counterpart on the same origin, otherwise the websocket fails CSP.
    connectSources.push(supabaseUrl);
    try {
      const wssOrigin = new URL(supabaseUrl).origin.replace(/^https:/, "wss:");
      connectSources.push(wssOrigin);
    } catch {
      /* malformed env, fall through */
    }
  } else if (isDev) {
    connectSources.push("https:");
    connectSources.push("wss:");
  }
  // Wildcard Supabase + platform infrastructure origins. Without these
  // the realtime websocket, edge gateway, sentry, and Neo RPCs all
  // fail at the CSP layer when a project-specific override is set.
  connectSources.push(
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.r3e.network",
    "https://*.seed.r3e.network",
    "https://*.neo.coz.io",
    "https://api.n3index.dev",
    "https://*.sentry.io",
    "https://oracle.meshmini.app",
    "https://edge.meshmini.app",
    "https://control.meshmini.app",
  );
  connectSources.push(...federatedOrigins);
  const auth0Issuer = (process.env.AUTH0_ISSUER_BASE_URL || "").trim();
  if (auth0Issuer) {
    connectSources.push(auth0Issuer);
  }
  const connectSrc = connectSources.join(" ");

  const scriptSources = ["'self'", `'nonce-${nonce}'`, ...federatedOrigins];
  // Module Federation requires 'unsafe-eval' for dynamic code loading
  if (isDev) {
    scriptSources.push("'unsafe-eval'");
  }
  const scriptSrc = scriptSources.join(" ");

  const csp = [
    "default-src 'self'",
    // Next.js uses inline scripts; nonce-based CSP keeps this strict without 'unsafe-inline'.
    `script-src ${scriptSrc}`,
    `style-src ${styleSources.join(" ")}`,
    `style-src-elem ${styleSources.join(" ")}`,
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    options.allowMiniAppEmbedding
      ? "frame-ancestors 'self' https://neomini.app https://*.miniapp.r3e.network"
      : "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self'${auth0Issuer ? ` ${auth0Issuer}` : ""}`,
  ];

  return csp.join("; ");
}

function setSecurityHeaders(
  res: NextResponse,
  options: { frameOptions?: "DENY" | "SAMEORIGIN" | null } = {},
): void {
  const frameOptions = options.frameOptions === undefined ? "DENY" : options.frameOptions;
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (frameOptions) {
    res.headers.set("X-Frame-Options", frameOptions);
  } else {
    res.headers.delete("X-Frame-Options");
  }
}

export function middleware(req: NextRequest) {
  // Skip CSP for Next.js internals and static assets.
  const pathname = req.nextUrl.pathname;
  const isMiniAppRuntimeAsset = pathname.startsWith("/miniapps/");
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots")
  ) {
    const res = NextResponse.next();
    setSecurityHeaders(res);
    return res;
  }

  const nonce = randomNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-csp-nonce", nonce);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  res.headers.set(
    "Content-Security-Policy",
    buildCSP(nonce, { allowMiniAppEmbedding: isMiniAppRuntimeAsset }),
  );
  setSecurityHeaders(res, {
    frameOptions: isMiniAppRuntimeAsset ? null : "DENY",
  });

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

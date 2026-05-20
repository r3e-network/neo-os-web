import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function buildCSP(
  nonce: string,
  options: {
    allowMiniAppEmbedding?: boolean;
    allowNativeWalletEval?: boolean;
  } = {},
): string {
  const isDev = process.env.NODE_ENV !== "production";
  const externalFontStyleSources = [
    "https://fonts.googleapis.com",
    "https://api.fontshare.com",
  ];
  const styleSources = ["'self'", "'unsafe-inline'"];
  if (options.allowMiniAppEmbedding) {
    styleSources.push(...externalFontStyleSources);
  }

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
  const auth0Issuer = (process.env.AUTH0_ISSUER_BASE_URL || "").trim();
  if (auth0Issuer) {
    connectSources.push(auth0Issuer);
  }
  const connectSrc = connectSources.join(" ");

  // Audit fix H-1 (revised): the audit's H-1 finding was conditional on C-4 —
  // "combined with [no iframe sandbox], any injection in miniapp content
  // becomes XSS in the host origin." Now that C-4 ships and miniapps run in
  // a same-origin-DENIED sandbox, an XSS in a miniapp stays confined to the
  // sandboxed origin and cannot read host JWTs, the parent SDK, or the
  // wallet store. We therefore keep `'unsafe-inline'` for miniapp paths to
  // preserve compatibility with Vite-built miniapps that runtime-inject
  // inline scripts (theme loaders, polyfills, OneGate dAPI). The OneGate
  // vault path additionally needs `'unsafe-eval'`.
  const scriptSources = options.allowMiniAppEmbedding
    ? ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "blob:"]
    : ["'self'", `'nonce-${nonce}'`];
  if (options.allowNativeWalletEval) {
    scriptSources.push("'unsafe-eval'");
  }
  if (isDev) {
    scriptSources.push("'unsafe-eval'");
  }
  const scriptSrc = scriptSources.join(" ");

  // Audit fix H-2: pin frame-ancestors to exact hosts (no wildcard subdomain).
  // The previous `https://*.onegate.space` / `https://*.miniapp.r3e.network`
  // wildcards permitted any subdomain or a subdomain takeover to clickjack
  // wallet-signing flows. Additional explicit hosts can be added via the
  // `FRAME_ANCESTORS_EXTRA` env var at deploy time.
  const baseFrameAncestors = [
    "'self'",
    "https://neomini.app",
    "https://onegate.space",
    "https://app.miniapp.r3e.network",
  ];
  const extraFrameAncestors = (process.env.FRAME_ANCESTORS_EXTRA || "")
    .split(",")
    .map((host) => host.trim())
    .filter((host) => host && /^https:\/\/[A-Za-z0-9.-]+$/.test(host));
  const frameAncestors = [...baseFrameAncestors, ...extraFrameAncestors].join(" ");

  const csp = [
    "default-src 'self'",
    // Next.js uses inline scripts; nonce-based CSP keeps this strict without 'unsafe-inline'.
    `script-src ${scriptSrc}`,
    `style-src ${styleSources.join(" ")}`,
    `style-src-elem ${styleSources.join(" ")}`,
    "img-src 'self' data: https:",
    "font-src 'self' data: https:",
    `connect-src ${connectSrc}`,
    options.allowMiniAppEmbedding ? "frame-src 'self' blob:" : "frame-src 'none'",
    options.allowMiniAppEmbedding ? `frame-ancestors ${frameAncestors}` : "frame-ancestors 'none'",
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

function isOneGateVaultHtmlPath(pathname: string): boolean {
  return (
    pathname === "/miniapps/miniapp-gas-lucky-pool" ||
    pathname === "/miniapps/miniapp-gas-lucky-pool/" ||
    pathname === "/miniapps/onegate-vault" ||
    pathname === "/miniapps/onegate-vault/" ||
    pathname === "/miniapps/gas-lucky-pool/index.html"
  );
}

function resolveMiniAppDetailRewriteId(pathname: string): string | null {
  const match = pathname.match(/^\/miniapps\/([^/.][^/]*)\/?$/);
  return match?.[1] || null;
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
  const detailRewriteId = resolveMiniAppDetailRewriteId(pathname);

  const res = detailRewriteId
    ? NextResponse.rewrite(
        new URL(`/miniapp-detail/${detailRewriteId}`, req.url),
        {
          request: { headers: requestHeaders },
        },
      )
    : NextResponse.next({
        request: { headers: requestHeaders },
      });

  res.headers.set(
    "Content-Security-Policy",
    buildCSP(nonce, {
      allowMiniAppEmbedding: isMiniAppRuntimeAsset,
      allowNativeWalletEval: isOneGateVaultHtmlPath(pathname),
    }),
  );
  setSecurityHeaders(res, {
    frameOptions: isMiniAppRuntimeAsset ? null : "DENY",
  });
  if (isOneGateVaultHtmlPath(pathname)) {
    res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

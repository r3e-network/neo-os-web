const { withSentryConfig } = require("@sentry/nextjs");

function dedupe(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseFederatedOrigins() {
  const raw = (process.env.NEXT_PUBLIC_MF_REMOTES || "").trim();
  if (!raw) return [];

  const origins = new Set();
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

function parseOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

// Content Security Policy (static baseline for routes that bypass middleware CSP)
function buildContentSecurityPolicy({ allowFrameAncestors }) {
  const isDev = process.env.NODE_ENV !== "production";
  const federatedOrigins = parseFederatedOrigins();
  const frameOrigins = (process.env.MINIAPP_FRAME_ORIGINS || "").trim();
  const frameSrc = frameOrigins ? `'self' ${frameOrigins}` : "'self' https:";

  const scriptSources = dedupe(["'self'", "'unsafe-inline'", ...federatedOrigins]);
  const styleSources = dedupe(["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]);
  const fontSources = dedupe(["'self'", "data:", "https://fonts.gstatic.com"]);
  const imgSources = dedupe(["'self'", "data:", "blob:", "https:"]);

  const connectSources = dedupe([
    "'self'",
    "https:",
    "wss:",
    isDev ? "http:" : null,
    isDev ? "ws:" : null,
  ]);

  const supabaseOrigin = parseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (supabaseOrigin) {
    connectSources.push(supabaseOrigin);
    connectSources.push(supabaseOrigin.replace(/^https:/, "wss:"));
  }

  const auth0Origin = parseOrigin(process.env.AUTH0_ISSUER_BASE_URL || process.env.AUTH0_BASE_URL);
  if (auth0Origin) connectSources.push(auth0Origin);

  const sentryOrigin = parseOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (sentryOrigin) connectSources.push(sentryOrigin);

  connectSources.push(...federatedOrigins);

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    `style-src ${styleSources.join(" ")}`,
    `style-src-elem ${styleSources.join(" ")}`,
    `img-src ${imgSources.join(" ")}`,
    `font-src ${fontSources.join(" ")}`,
    `connect-src ${dedupe(connectSources).join(" ")}`,
    `frame-src ${frameSrc}`,
    `frame-ancestors ${allowFrameAncestors ? "'self'" : "'none'"}`,
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ];

  return csp.join("; ");
}

const miniappsCsp = buildContentSecurityPolicy({ allowFrameAncestors: true })
  .replace(/\s{2,}/g, " ")
  .trim();
const defaultCsp = buildContentSecurityPolicy({ allowFrameAncestors: false })
  .replace(/\s{2,}/g, " ")
  .trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ["page.tsx", "page.ts", "tsx", "ts"].filter((ext) => !ext.includes("test")),
  transpilePackages: ["../shared"],
  experimental: {
    externalDir: true,
  },
  async headers() {
    return [
      {
        source: "/miniapps/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: miniappsCsp },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/((?!miniapps).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: defaultCsp },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
};

const sentryOptions = {
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
};

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions, sentryOptions)
  : nextConfig;

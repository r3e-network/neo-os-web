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

function parseOriginList(raw) {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parseOrigin(entry))
    .filter(Boolean);
}

// Content Security Policy (static baseline for routes that bypass middleware CSP)
function buildContentSecurityPolicy({ allowFrameAncestors }) {
  const isDev = process.env.NODE_ENV !== "production";
  const federatedOrigins = parseFederatedOrigins();
  const frameOrigins = (process.env.MINIAPP_FRAME_ORIGINS || "").trim();
  const frameSrc = frameOrigins ? `'self' ${frameOrigins}` : isDev ? "'self' http: https:" : "'self'";

  const scriptSources = dedupe(["'self'", "'unsafe-inline'", ...federatedOrigins]);
  const styleSources = dedupe(["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]);
  const fontSources = dedupe(["'self'", "data:", "https://fonts.gstatic.com"]);
  const imgSources = dedupe(["'self'", "data:", "blob:", "https:"]);

  const connectSources = ["'self'"];
  if (isDev) {
    connectSources.push("http:", "https:", "ws:", "wss:");
  }

  const rpcOrigins = [
    "https://mainnet1.neo.coz.io",
    "https://mainnet2.neo.coz.io",
    "https://neo1.neo.coz.io",
    "https://testnet1.neo.coz.io",
    "https://testnet2.neo.coz.io",
    "https://mainnet-1.rpc.banelabs.org",
    "https://neoxt4seed1.ngd.network",
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com",
    "https://rpc.sepolia.org",
    "https://rpc2.sepolia.org",
    "https://polygon-rpc.com",
    "https://rpc-amoy.polygon.technology",
    "https://bsc-dataseed.binance.org",
    "https://data-seed-prebsc-1-s1.binance.org:8545",
    "https://eth-mainnet.g.alchemy.com",
    "https://eth-sepolia.g.alchemy.com",
    "https://polygon-mainnet.g.alchemy.com",
    "https://polygon-amoy.g.alchemy.com",
    "https://bnb-mainnet.g.alchemy.com",
    "https://bnb-testnet.g.alchemy.com",
  ];

  const rpcWsOrigins = ["wss://mainnet-1.rpc.banelabs.org", "wss://neoxt4wss1.ngd.network"];

  connectSources.push(
    "https://api.coingecko.com",
    ...rpcOrigins,
    ...rpcWsOrigins,
    ...parseOriginList(process.env.RPC_ALLOWED_ORIGINS || ""),
  );

  const supabaseOrigin = parseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (supabaseOrigin) {
    connectSources.push(supabaseOrigin);
    connectSources.push(supabaseOrigin.replace(/^https:/, "wss:"));
  }

  const edgeOrigin = parseOrigin(process.env.EDGE_BASE_URL);
  if (edgeOrigin) connectSources.push(edgeOrigin);

  const apiOrigin = parseOrigin(process.env.NEXT_PUBLIC_API_URL);
  if (apiOrigin) connectSources.push(apiOrigin);

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

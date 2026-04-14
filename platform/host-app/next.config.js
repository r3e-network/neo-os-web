const path = require("path");
let withSentryConfig;
try { withSentryConfig = require("@sentry/nextjs").withSentryConfig; } catch {};

const MINIAPP_CORS_ORIGIN = "https://neomini.app";

const MiniAppCSP = `
  default-src 'self' 'unsafe-inline' data: blob:;
  script-src 'self' 'unsafe-inline' 'unsafe-hashes' blob:;
  script-src-elem 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  style-src-elem 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data: https:;
  connect-src 'self' https://*.r3e.network https://*.neo.coz.io https://*.supabase.co https://*.sentry.io wss://*.supabase.co https://rpc*.seed.r3e.network https://mainnet*.neo.coz.io https://testnet*.neo.coz.io;
  frame-src 'none';
  frame-ancestors 'self' https://neomini.app https://*.miniapp.r3e.network;
  form-action 'self';
  base-uri 'self';
  object-src 'none';
`
  .replace(/\s{2,}/g, " ")
  .trim();

const MainCSP = `
  default-src 'self' 'unsafe-inline';
  script-src 'self' 'unsafe-inline' blob: 'unsafe-hashes';
  script-src-elem 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  style-src-elem 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data: https:;
  connect-src 'self' https://*.r3e.network https://*.neo.coz.io https://*.supabase.co https://*.sentry.io wss://*.supabase.co;
  frame-src 'self' blob:;
  frame-ancestors 'self';
  form-action 'self';
  base-uri 'self';
  object-src 'none';
`
  .replace(/\s{2,}/g, " ")
  .trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 24h
    remotePatterns: [
      {
        protocol: "https",
        hostname: "neomini.app",
        pathname: "/miniapps/**",
      },
    ],
    unoptimized: process.env.NODE_ENV === "development",
  },
  transpilePackages: ["../shared"],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },
  experimental: {
    externalDir: true,
    scrollRestoration: true,
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
  outputFileTracingIncludes: {
    "/api/**/*": ["./public/miniapp-definitions/**/*"],
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/miniapps/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: MINIAPP_CORS_ORIGIN },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: MiniAppCSP },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/miniapp-assets/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: MINIAPP_CORS_ORIGIN },
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400, immutable" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/((?!miniapps|miniapp-assets).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: MainCSP },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
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

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN && withSentryConfig
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions, sentryOptions)
  : nextConfig;

const path = require("path");
const { withSentryConfig } = require("@sentry/nextjs");

// Content Security Policy
// MiniApp CSP: allows inline scripts (uni-app requirement) but restricts external script loading.
// SECURITY: unsafe-eval removed — uni-app works without it in production builds.
// connect-src whitelisted to known Neo RPC endpoints instead of wildcard.
// Allowed origins for MiniApp CORS — restrict to known platform domains.
const MINIAPP_CORS_ORIGIN = "https://neomini.app";

const MiniAppCSP = `
  default-src 'self' 'unsafe-inline' data: blob:;
  script-src 'self' 'unsafe-inline' 'unsafe-hashes' blob:;
  script-src-elem 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  style-src-elem 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data: https:;
  connect-src 'self' https://*.neo.org https://*.neo.coz.io https://*.supabase.co https://*.sentry.io wss://*.supabase.co https://rpc*.seed.neo.org https://mainnet*.neo.coz.io https://testnet*.neo.coz.io;
  frame-src 'none';
  frame-ancestors 'self' https://neomini.app https://*.miniapp.neo.org;
  form-action 'self';
  base-uri 'self';
  object-src 'none';
`
  .replace(/\s{2,}/g, " ")
  .trim();

// CSP for main application - allows wallet/RPC connections but restricts framing
// SECURITY: unsafe-eval removed to prevent arbitrary code execution via XSS.
const MainCSP = `
  default-src 'self' 'unsafe-inline';
  script-src 'self' 'unsafe-inline' blob: 'unsafe-hashes';
  script-src-elem 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  style-src-elem 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data: https:;
  connect-src 'self' https://*.neo.org https://*.neo.coz.io https://*.supabase.co https://*.sentry.io wss://*.supabase.co;
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "neomini.app",
        pathname: "/miniapps/**",
      },
    ],
    // Allow unoptimized images for local development
    unoptimized: process.env.NODE_ENV === "development",
  },
  // Use default page extensions (tsx, ts, jsx, js)
  transpilePackages: ["../shared"],
  experimental: {
    externalDir: true,
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
  // Prevent Next from inferring an incorrect repo root when multiple lockfiles exist.
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  // Type checks run during build — do NOT skip in production.
  typescript: {
    ignoreBuildErrors: false,
  },
  productionBrowserSourceMaps: false,
  // MiniApps are served locally from public/miniapp-assets/.
  // Static assets (logo, banner) use /miniapp-assets/ to avoid page route conflicts.
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
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: MiniAppCSP },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/miniapp-assets/:appId/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, immutable" }],
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

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions, sentryOptions)
  : nextConfig;

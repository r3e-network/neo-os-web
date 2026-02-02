const { withSentryConfig } = require("@sentry/nextjs");

// Content Security Policy
// Permissive CSP for miniapp iframes (allows inline scripts)
const MiniAppCSP = `
  default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;
  script-src * 'unsafe-inline' 'unsafe-eval' 'unsafe-hashes' blob:;
  script-src-elem * 'unsafe-inline';
  style-src * 'unsafe-inline';
  style-src-elem * 'unsafe-inline';
  img-src * data: blob:;
  font-src * data:;
  connect-src *;
  frame-src *;
  frame-ancestors *;
  form-action *;
  base-uri 'self';
  object-src 'none';
`
  .replace(/\s{2,}/g, " ")
  .trim();

// CSP for main application - more permissive to allow wallet connections
const MainCSP = `
  default-src 'self' 'unsafe-inline' 'unsafe-eval';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: 'unsafe-hashes';
  script-src-elem 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  style-src-elem 'self' 'unsafe-inline';
  img-src 'self' data: blob: *;
  font-src 'self' data: *;
  connect-src 'self' *;
  frame-src 'self' *;
  frame-ancestors 'self' *;
  form-action 'self';
  base-uri 'self';
  object-src 'none';
`
  .replace(/\s{2,}/g, " ")
  .trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Performance optimizations
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
  // Disable TypeScript type checking during build (handled separately by tsc)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build (handled separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Reduce build output size
  productionBrowserSourceMaps: false,
  // Disable Sentry's automatic instrumentation to avoid CSP nonce issues
  sentry: {
    disableServerWebpackPlugin: true,
    disableClientWebpackPlugin: true,
  },
  // MiniApps are now served locally from public/miniapp-assets/
  // Static assets (logo, banner) use /miniapp-assets/ path to avoid conflict with pages router
  async headers() {
    return [
      {
        source: "/miniapps/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: MiniAppCSP },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/miniapp-assets/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: MiniAppCSP },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Cache MiniApp static assets
      {
        source: "/miniapp-assets/:appId/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, immutable" },
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

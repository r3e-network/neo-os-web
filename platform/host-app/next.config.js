const { withSentryConfig } = require("@sentry/nextjs");

// Content Security Policy
const ContentSecurityPolicy = `
  default-src 'self' 'unsafe-inline' 'unsafe-eval' *;
  script-src 'self' 'unsafe-inline' 'unsafe-eval' * blob:;
  style-src 'self' 'unsafe-inline' * blob:;
  style-src-elem 'self' 'unsafe-inline' * blob:;
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
  pageExtensions: ["page.tsx", "page.ts", "tsx", "ts"].filter((ext) => !ext.includes("test")),
  transpilePackages: ["../shared"],
  experimental: {
    externalDir: true,
  },
  // Disable TypeScript type checking during build (handled separately by tsc)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build (handled separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: "/miniapps/:path*",
        destination: "https://meshmini.app/miniapps/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/miniapps/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" }, // ALLOW SANDBOXED IFRAMES
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Cache MiniApp static assets (images, etc) in /static/ folders
      {
        source: "/miniapps/:appId/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" }, // 1 day cache
        ],
      },
      {
        source: "/((?!miniapps).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
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

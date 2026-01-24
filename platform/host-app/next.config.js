const { withSentryConfig } = require("@sentry/nextjs");

// Content Security Policy
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.auth0.com https://*.sentry.io;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.auth0.com https://*.sentry.io https://api.coingecko.com https://*.neo.org https://*.neo.coz.io https://*.banelabs.org https://*.ngd.network https://*.ngd.network:* https://*.alchemy.com https://*.llamarpc.com https://*.polygon-rpc.com;
  frame-src 'self' https://*.auth0.com;
  frame-ancestors 'self';
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
  async headers() {
    return [
      {
        source: "/miniapps/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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

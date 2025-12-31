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
        // Allow miniapps to be embedded in iframes (same-origin only for /launch pages)
        source: "/miniapps/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // Block iframe embedding for all other pages
        source: "/((?!miniapps).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

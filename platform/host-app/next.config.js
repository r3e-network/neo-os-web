/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // CSP Configuration:
    // - MINIAPP_FRAME_ORIGINS: Space-separated list of allowed iframe origins for MiniApps
    //   Example: "https://cdn.miniapps.example.com https://trusted-apps.example.com"
    // - SUPABASE_URL: Supabase project URL for connect-src
    // - In development, falls back to permissive defaults
    const isDev = process.env.NODE_ENV !== "production";

    // Frame sources for MiniApp iframes
    const frameOrigins = process.env.MINIAPP_FRAME_ORIGINS || "";
    const frameSrc = frameOrigins.trim()
      ? `'self' ${frameOrigins.trim()}`
      : isDev
        ? "'self' https:" // Permissive in dev
        : "'self'"; // Restrictive in prod (must configure MINIAPP_FRAME_ORIGINS)

    // Connect sources for API calls
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const connectSrc = supabaseUrl.trim() ? `'self' ${supabaseUrl.trim()}` : isDev ? "'self' https:" : "'self'";

    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      `connect-src ${connectSrc}`,
      `frame-src ${frameSrc}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

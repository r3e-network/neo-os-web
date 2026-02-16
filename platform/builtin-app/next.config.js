const path = require("path");
const { NextFederationPlugin } = require("@module-federation/nextjs-mf");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Let Next.js transpile the shared workspace package natively (no ts-loader needed)
  transpilePackages: [path.resolve(__dirname, "../shared")],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:; frame-ancestors 'self'" },
        ],
      },
    ];
  },
  webpack(config) {
    // Force React singleton — prevents duplicate React from shared modules
    const reactPath = path.dirname(require.resolve("react/package.json"));
    const reactDomPath = path.dirname(require.resolve("react-dom/package.json"));
    config.resolve.alias = {
      ...config.resolve.alias,
      react: reactPath,
      "react-dom": reactDomPath,
    };

    config.plugins.push(
      new NextFederationPlugin({
        name: "builtin",
        filename: "static/chunks/remoteEntry.js",
        exposes: {
          "./App": "./src/components/BuiltinApp",
        },
        shared: {
          react: { singleton: true, requiredVersion: false },
          "react-dom": { singleton: true, requiredVersion: false },
        },
      }),
    );

    return config;
  },
};

module.exports = nextConfig;

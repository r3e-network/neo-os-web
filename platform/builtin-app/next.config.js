const path = require("path");

process.env.NEXT_PRIVATE_LOCAL_WEBPACK = "true";
process.env.FEDERATION_WEBPACK_PATH = path.resolve(
  __dirname,
  "node_modules/webpack/lib/index.js",
);

const { NextFederationPlugin } = require("@module-federation/nextjs-mf");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["../shared"],
  experimental: {
    externalDir: true,
  },
  webpack(config, { isServer }) {
    if (!isServer) {
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
    }

    return config;
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["../shared"],
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

module.exports = nextConfig;

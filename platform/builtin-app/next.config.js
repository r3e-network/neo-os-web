/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["../shared"],
  experimental: {
    externalDir: true,
  },
};

module.exports = nextConfig;

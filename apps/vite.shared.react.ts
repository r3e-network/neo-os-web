/**
 * Shared Vite configuration for React-based miniapps.
 *
 * React 18 + Vite setup — parallel to vite.shared.ts (Vue).
 * Each miniapp is a standard SPA (Single Page Application).
 *
 * Usage in app vite.config.react.ts:
 *   import { createReactAppConfig } from "../vite.shared.react";
 *   export default createReactAppConfig(__dirname);
 */
import { defineConfig, UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

export interface ReactAppConfigOptions {
  /** Custom plugins to add (in addition to react()) */
  plugins?: UserConfig["plugins"];
  /** Override or extend resolve.alias */
  alias?: Record<string, string>;
  /** Override build options */
  build?: UserConfig["build"];
  /** Override server options */
  server?: UserConfig["server"];
  /** Override optimizeDeps options */
  optimizeDeps?: UserConfig["optimizeDeps"];
  /** Override define options */
  define?: UserConfig["define"];
  /** Override publicDir */
  publicDir?: string;
}

/**
 * Creates a standard Vite configuration for a React miniapp.
 *
 * @param appDir - The __dirname of the app's vite.config.react.ts
 * @param options - Optional customizations
 */
export function createReactAppConfig(appDir: string, options: ReactAppConfigOptions = {}) {
  // rootDir is the miniapps/ directory (one level up from app directory)
  const rootDir = path.resolve(appDir, "..");
  const sharedDir = path.resolve(rootDir, "shared");
  const nobleHashesAssertShim = path.resolve(sharedDir, "shims/noble-hashes-assert.ts");
  const nobleHashesRipemdShim = path.resolve(sharedDir, "shims/noble-hashes-ripemd160.js");
  const nobleHashesSha256Shim = path.resolve(sharedDir, "shims/noble-hashes-sha256.js");
  const nobleHashesSha512Shim = path.resolve(sharedDir, "shims/noble-hashes-sha512.js");
  const nobleCurvesAbstractUtilsShim = path.resolve(sharedDir, "shims/noble-curves-abstract-utils.js");
  const nobleCurvesP256Shim = path.resolve(sharedDir, "shims/noble-curves-p256.js");
  const polyfillShimsRoot = path.resolve(appDir, "node_modules/vite-plugin-node-polyfills/shims");
  const polyfillAliases: { find: string; replacement: string }[] = [];

  const addPolyfillAlias = (find: string, relativePath: string) => {
    const replacement = path.resolve(polyfillShimsRoot, relativePath);
    if (fs.existsSync(replacement)) {
      polyfillAliases.push({ find, replacement });
    }
  };

  addPolyfillAlias("vite-plugin-node-polyfills/shims/buffer", "buffer/dist/index.js");
  addPolyfillAlias("vite-plugin-node-polyfills/shims/global", "global/dist/index.js");
  addPolyfillAlias("vite-plugin-node-polyfills/shims/process", "process/dist/index.js");
  const optionAliases = options.alias
    ? Object.entries(options.alias).map(([find, replacement]) => ({ find, replacement }))
    : [];

  return defineConfig({
    plugins: [react(), ...(options.plugins ?? [])],
    base: "./",
    resolve: {
      alias: [
        ...optionAliases,
        { find: "@", replacement: path.resolve(appDir, "src") },
        { find: "@shared", replacement: sharedDir },
        ...polyfillAliases,
        { find: "@noble/curves/p256", replacement: nobleCurvesP256Shim },
        { find: "@noble/curves/p256.js", replacement: nobleCurvesP256Shim },
        { find: "@noble/curves/p384", replacement: "@noble/curves/nist.js" },
        { find: "@noble/curves/p384.js", replacement: "@noble/curves/nist.js" },
        { find: "@noble/curves/p521", replacement: "@noble/curves/nist.js" },
        { find: "@noble/curves/p521.js", replacement: "@noble/curves/nist.js" },
        { find: "@noble/curves/abstract/utils", replacement: nobleCurvesAbstractUtilsShim },
        { find: /^@noble\/curves\/abstract\/(.+?)(?:\.js)?$/, replacement: "@noble/curves/abstract/$1.js" },
        { find: /^@noble\/curves\/([^./]+)$/, replacement: "@noble/curves/$1.js" },
        { find: "@noble/hashes/_assert", replacement: nobleHashesAssertShim },
        { find: "@noble/hashes/ripemd160", replacement: nobleHashesRipemdShim },
        { find: "@noble/hashes/ripemd160.js", replacement: nobleHashesRipemdShim },
        { find: "@noble/hashes/sha256", replacement: nobleHashesSha256Shim },
        { find: "@noble/hashes/sha256.js", replacement: nobleHashesSha256Shim },
        { find: "@noble/hashes/sha512", replacement: nobleHashesSha512Shim },
        { find: "@noble/hashes/sha512.js", replacement: nobleHashesSha512Shim },
        { find: /^@noble\/hashes\/(.+?)\.js$/, replacement: "@noble/hashes/$1" },
      ],
    },
    css: {
      preprocessorOptions: {
        scss: {},
      },
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      copyPublicDir: true,
      // Keep chunk sizes small for faster loading across 60+ miniapps
      chunkSizeWarningLimit: 300,
      // esbuild minification is fastest and sufficient for production
      minify: "esbuild",
      // Source maps add ~30% to bundle size; disable in production builds
      sourcemap: false,
      rollupOptions: {
        external: [
          // Public folder assets accessed via absolute paths
          /^\/logo\.(png|jpg|svg)$/,
          /^\/banner\.(png|jpg|svg)$/,
          /^\/static\//,
        ],
        output: {
          /**
           * Split vendor and platform code into dedicated chunks so that:
           * 1. React runtime is cached independently from app code.
           * 2. Shared platform services/composables are cached across
           *    miniapp navigations (all 60+ apps share the same files).
           * 3. Noble crypto libraries form their own chunk (they're heavy
           *    and only needed by apps that do on-chain signing).
           *
           * We use a function because @shared/* paths are Vite aliases
           * resolved to absolute filesystem paths, not npm packages.
           */
          manualChunks(id: string) {
            if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
              return "react-vendor";
            }
            if (id.includes("node_modules/@noble/")) {
              return "noble-crypto";
            }
            if (id.includes("/shared/services/") || id.includes("/shared/composables/")) {
              return "platform-sdk";
            }
          },
        },
      },
      ...options.build,
    },
    server: {
      port: 5173,
      host: true,
      ...options.server,
    },
    optimizeDeps: options.optimizeDeps,
    define: options.define,
    publicDir: options.publicDir,
  });
}

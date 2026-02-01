/**
 * Shared Vite configuration for all miniapps.
 *
 * This module provides common configuration that should be used by all miniapp
 * vite.config.ts files to ensure consistency and reduce duplication.
 *
 * Usage in app vite.config.ts:
 *   import { createAppConfig } from "../vite.shared";
 *   export default createAppConfig(__dirname);
 */
import { defineConfig, UserConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import path from "path";

export interface AppConfigOptions {
  /** Custom plugins to add (in addition to uni()) */
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
 * Creates a standard Vite configuration for a miniapp.
 *
 * @param appDir - The __dirname of the app's vite.config.ts
 * @param options - Optional customizations
 */
export function createAppConfig(appDir: string, options: AppConfigOptions = {}) {
  // rootDir is the miniapps/ directory (one level up from app directory)
  const rootDir = path.resolve(appDir, "..");
  const sharedDir = path.resolve(rootDir, "shared");
  const nobleHashesAssertShim = path.resolve(sharedDir, "shims/noble-hashes-assert.ts");
  const nobleHashesRipemdShim = path.resolve(sharedDir, "shims/noble-hashes-ripemd160.js");
  const nobleHashesSha256Shim = path.resolve(sharedDir, "shims/noble-hashes-sha256.js");
  const nobleHashesSha512Shim = path.resolve(sharedDir, "shims/noble-hashes-sha512.js");
  const nobleCurvesAbstractUtilsShim = path.resolve(sharedDir, "shims/noble-curves-abstract-utils.js");
  const nobleCurvesP256Shim = path.resolve(sharedDir, "shims/noble-curves-p256.js");
  const optionAliases = options.alias
    ? Object.entries(options.alias).map(([find, replacement]) => ({ find, replacement }))
    : [];

  return defineConfig({
    plugins: [uni(), ...(options.plugins ?? [])],
    base: "./",
    resolve: {
      alias: [
        ...optionAliases,
        { find: "@", replacement: path.resolve(appDir, "src") },
        { find: "@shared", replacement: sharedDir },
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
        { find: /^@noble\/hashes\/([^./]+)$/, replacement: "@noble/hashes/$1.js" },
      ],
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Sass importer to resolve @shared alias
          importer: [
            (url: string) => {
              if (url.startsWith("@shared/")) {
                return { file: url.replace("@shared/", sharedDir + "/") };
              }
              return null;
            },
          ],
        },
      },
    },
    build: {
      outDir: "dist/build/h5",
      assetsDir: "static",
      copyPublicDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "vue-vendor": ["vue", "@dcloudio/uni-app", "@dcloudio/uni-h5"],
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

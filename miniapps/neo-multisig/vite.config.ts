import { createAppConfig } from "../vite.shared";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

// @ts-expect-error __dirname is provided by Vite at runtime
export default createAppConfig(__dirname, {
  plugins: [
    nodePolyfills({
      include: ["buffer", "process", "util", "stream", "events", "string_decoder", "crypto"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  alias: {
    "@noble/hashes/scrypt": path.resolve(__dirname, "node_modules/@noble/hashes/esm/scrypt.js"),
    "@noble/hashes": path.resolve(__dirname, "node_modules/@noble/hashes/esm/index.js"),
    "vite-plugin-node-polyfills/shims/buffer": path.resolve(
      __dirname,
      "node_modules/vite-plugin-node-polyfills/shims/buffer/dist/index.js"
    ),
  },
  optimizeDeps: {
    include: ["@cityofzion/neon-core", "jspdf", "qrcode"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  define: {
    "process.env": {},
  },
});

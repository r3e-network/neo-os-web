import { createReactAppConfig } from "../vite.shared.react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

declare const __dirname: string;
export default createReactAppConfig(__dirname, {
  alias: {
    html2canvas: path.resolve(__dirname, "../shared/shims/html2canvas-stub.js"),
  },
  plugins: [
    nodePolyfills({
      include: ["buffer", "process", "util", "stream", "events", "string_decoder"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  optimizeDeps: {
    include: ["@r3e/neo-js-sdk/core", "jspdf", "qrcode"],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});

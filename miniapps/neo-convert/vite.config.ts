import { createAppConfig } from "../vite.shared";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// @ts-expect-error __dirname is provided by Vite at runtime
export default createAppConfig(__dirname, {
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
    include: ["@cityofzion/neon-core", "jspdf", "qrcode"],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});

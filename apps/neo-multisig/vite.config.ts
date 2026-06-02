import { createReactAppConfig } from "../vite.shared.react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

declare const __dirname: string;
export default createReactAppConfig(__dirname, {
  plugins: [
    nodePolyfills({
      include: ["buffer", "process", "util", "stream", "events"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  optimizeDeps: {
    include: ["@r3e/neo-js-sdk/browser"],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});

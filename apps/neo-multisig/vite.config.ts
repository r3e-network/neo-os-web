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
    rollupOptions: {
      external: [/^\/logo\.(png|jpg|svg)$/, /^\/banner\.(png|jpg|svg)$/, /^\/static\//],
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) return "react-vendor";
          if (id.includes("node_modules/@douyinfe/") || id.includes("node_modules/lucide-react/")) return "ui-vendor";
          if (id.includes("node_modules/@r3e/neo-js-sdk/")) return "neo-sdk";
          if (id.includes("node_modules/@noble/")) return "noble-crypto";
          if (id.includes("/shared/services/") || id.includes("/shared/composables/")) return "platform-sdk";
        },
      },
    },
  },
});

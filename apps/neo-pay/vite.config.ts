import { createReactAppConfig } from "../vite.shared.react";

export default createReactAppConfig(__dirname, {
  build: {
    rollupOptions: {
      external: [/^\/logo\.(png|jpg|svg)$/, /^\/banner\.(png|jpg|svg)$/, /^\/static\//],
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) return "react-vendor";
          if (id.includes("node_modules/@douyinfe/") || id.includes("node_modules/lucide-react/")) return "ui-vendor";
          if (id.includes("node_modules/@noble/")) return "noble-crypto";
          if (id.includes("/shared/services/") || id.includes("/shared/composables/")) return "platform-sdk";
        },
      },
    },
  },
});

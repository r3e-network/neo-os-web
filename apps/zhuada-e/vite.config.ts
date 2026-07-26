import { createReactAppConfig } from "../vite.shared.react";

declare const __dirname: string;
export default createReactAppConfig(__dirname, {
  build: {
    // Both style chunks are required by the entry shell, so emit one stylesheet
    // and avoid retaining a redundant dynamic-import CSS preload reference.
    cssCodeSplit: false,
    // Supported mobile targets (current Safari/Chrome/WebView) implement
    // modulepreload natively, so do not ship Vite's legacy fetch polyfill in
    // every entry. Chunk discovery still uses native modulepreload links.
    modulePreload: {
      polyfill: false,
      // React/platform/UI vendors and their CSS are already preload/style
      // dependencies of index.html. Keep only genuinely lazy scene chunks in
      // dynamic-import preload maps to avoid shipping duplicate URL metadata.
      resolveDependencies: (_filename, dependencies, context) => (
        context.hostType === "html"
          ? dependencies
          : dependencies.filter(
            (dependency) => dependency.endsWith(".js")
              && !/(react-vendor|platform-sdk|noble-crypto|ui-vendor)/.test(dependency),
          )
      ),
    },
    // Goose Basket Shuffle intentionally splits Three.js into a cacheable
    // vendor chunk. The gzip budget gate keeps this honest, while this raw
    // threshold prevents Vite from warning on the expected 3D runtime chunk.
    chunkSizeWarningLimit: 560,
  },
});

import { createReactAppConfig } from "../vite.shared.react";

declare const __dirname: string;
export default createReactAppConfig(__dirname, {
  build: {
    // Goose Basket Shuffle intentionally splits Three.js into a cacheable
    // vendor chunk. The gzip budget gate keeps this honest, while this raw
    // threshold prevents Vite from warning on the expected 3D runtime chunk.
    chunkSizeWarningLimit: 560,
  },
});

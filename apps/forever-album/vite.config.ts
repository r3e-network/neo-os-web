import { createReactAppConfig } from "../vite.shared.react";

declare const __dirname: string;
export default createReactAppConfig(__dirname, {
  build: { publicDir: "src/static" },
});

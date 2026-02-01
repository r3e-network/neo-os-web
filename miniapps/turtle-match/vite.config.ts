import { createAppConfig } from "../vite.shared";

// @ts-expect-error __dirname is provided by Vite at runtime
export default createAppConfig(__dirname, {
  build: { publicDir: "src/static" },
});

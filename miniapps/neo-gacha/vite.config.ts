import { createAppConfig } from "../vite.shared";

declare const __dirname: string;
export default createAppConfig(__dirname, {
  build: { publicDir: "src/static" },
});

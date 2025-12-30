/**
 * TypeScript and Vite config templates
 */

// Generate vite.config.ts
function genViteConfig(app) {
  return `import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import path from "path";

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist/build/h5",
    assetsDir: "static",
  },
  server: {
    port: 5173,
    host: true,
  },
});
`;
}

// Generate tsconfig.json
function genTsConfig() {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        jsx: "preserve",
        resolveJsonModule: true,
        isolatedModules: true,
        esModuleInterop: true,
        lib: ["ESNext", "DOM"],
        skipLibCheck: true,
        noEmit: true,
        paths: {
          "@/*": ["./src/*"],
        },
        types: ["@dcloudio/types"],
      },
      include: ["src/**/*.ts", "src/**/*.vue"],
      exclude: ["node_modules", "dist"],
    },
    null,
    2,
  );
}

module.exports = { genViteConfig, genTsConfig };

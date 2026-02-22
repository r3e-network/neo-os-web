/**
 * TypeScript and Vite config templates
 */

const CATEGORY_PORT_OFFSET = {
  gaming: 0,
  defi: 20,
  social: 40,
  nft: 60,
  governance: 80,
  utility: 100,
};

function pickPort(app) {
  const base = 5173;
  const offset = CATEGORY_PORT_OFFSET[app.category] || 0;
  return base + offset;
}

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
    port: ${pickPort(app)},
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

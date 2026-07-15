import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = resolve(
  fileURLToPath(import.meta.url),
  "..",
  "..",
  "..",
  "fruit-funnel",
);

describe("Fruit Funnel browser entry", () => {
  it("provides the defineMiniApp mount target and production social assets", () => {
    const html = readFileSync(resolve(appRoot, "index.html"), "utf8");
    expect(html).toContain('<div id="app"></div>');
    expect(html).not.toContain('<div id="root">');
    // Relative "./src/main.tsx" is the 77-app fleet convention enforced by the
    // deploy gate (miniapp_runtime_entrypoints); the absolute Vite-scaffold
    // "/src/main.tsx" this test previously pinned was the regression.
    expect(html).toContain('src="./src/main.tsx"');
    expect(html).toContain('rel="icon" href="./logo.webp"');
    expect(html).toContain('property="og:image" content="./banner.webp"');
  });

  it("aligns manifest entry and artwork with the standalone browser surface", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(appRoot, "neo-manifest.json"), "utf8"),
    ) as { urls: { entry: string; icon: string; banner: string } };
    expect(manifest.urls).toEqual({
      entry: "/miniapps/fruit-funnel/index.html",
      icon: "/miniapps/fruit-funnel/logo.webp",
      banner: "/miniapps/fruit-funnel/banner.webp",
    });
  });
});

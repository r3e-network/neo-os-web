import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = resolve(
  fileURLToPath(import.meta.url),
  "..",
  "..",
  "..",
  "bead-workshop",
);

describe("Bead Workshop browser entry", () => {
  it("provides the default defineMiniApp mount target and production social assets", () => {
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

  it("keeps manifest entry and artwork aligned with the standalone browser surface", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(appRoot, "neo-manifest.json"), "utf8"),
    ) as {
      urls: { entry: string; icon: string; banner: string };
    };
    expect(manifest.urls).toEqual({
      entry: "/miniapps/bead-workshop/index.html",
      icon: "/miniapps/bead-workshop/logo.webp",
      banner: "/miniapps/bead-workshop/banner.webp",
    });
  });
});

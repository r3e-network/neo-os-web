import { existsSync, readFileSync, statSync } from "node:fs";
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
const read = (path: string) => readFileSync(resolve(appRoot, path), "utf8");

describe("Fruit Funnel production boundary", () => {
  it("registers a forced-guest, transaction-free game", () => {
    const publicManifest = JSON.parse(read("neo-manifest.json")) as Record<string, unknown>;
    expect(publicManifest).toMatchObject({
      id: "miniapp-fruit-funnel",
      category: "games",
      contracts: {},
      permissions: [],
      features: { offlineSupport: true },
      platform: { transactions: false },
    });
    expect((publicManifest.operation_panel as { operations: unknown[] }).operations).toEqual([]);

    const manifest = read("src/manifest.ts");
    const main = read("src/main.tsx");
    expect(manifest).toContain('category: "game"');
    expect(manifest).toContain("supportsGuest: true");
    expect(manifest).toContain("supportsGameFi: false");
    expect(manifest).toContain("walletRequired: false");
    expect(manifest).toContain("payments: false");
    expect(manifest).toContain("oracle: false");
    expect(main).toContain('app.mode.set("guest")');
    expect(main).not.toMatch(/ChainService|app\.wallet|contract\.invoke|transactions?\./i);
  });

  it("mounts Phaser 3 through the root framework with no legacy Canvas renderer", () => {
    const wrapper = read("src/PhaserPlayArea.tsx");
    const main = read("src/main.tsx");
    const scene = read("src/scenes/FruitFunnelScene.ts");
    const engine = read("src/logic/fruit-engine.ts");
    const allSource = [wrapper, main, scene, engine].join("\n");
    expect(wrapper).toContain("@framework/phaser/LazyPhaserGameComponent");
    expect(wrapper).toContain("loadScene={loadFruitFunnelScene}");
    expect(main).toContain('import PhaserPlayArea from "./PhaserPlayArea"');
    expect(main).toContain("playArea: PhaserPlayArea");
    expect(scene).toContain("extends BaseScene");
    expect(scene).toContain("this.load.image(ASSETS.stage");
    expect(allSource).not.toMatch(/CanvasRenderingContext2D|getContext\(["']2d["']\)|requestAnimationFrame\(/);
    expect(allSource).not.toContain("Math.random");
  });

  it("ships original gameplay art and auditable provenance", () => {
    const assets = [
      "public/banner.webp",
      "public/banner.avif",
      "public/logo.webp",
      "public/logo.avif",
      "public/art/orchard-stage.webp",
      "public/art/funnel-basket.webp",
      "public/art/vine-rack.webp",
      "public/art/fruit-apple.webp",
      "public/art/fruit-orange.webp",
      "public/art/fruit-lemon.webp",
      "public/art/fruit-grape.webp",
      "public/art/fruit-berry.webp",
      "public/art/fruit-peach.webp",
    ];
    for (const asset of assets) {
      const path = resolve(appRoot, asset);
      expect(existsSync(path), asset).toBe(true);
      expect(statSync(path).size, asset).toBeGreaterThan(1_000);
    }
    const attribution = read("public/art/ATTRIBUTION.md");
    expect(attribution).toContain("73bb72fa6b144148fc7c7e93c83ffd47f3d9f173");
    expect(attribution).toContain("no `LICENSE` file is present");
    expect(attribution).toContain("No reference source file, screenshot, Canvas architecture");
    expect(attribution).toContain("OpenAI image generation");
    expect(attribution).toContain("scripts/build-art-assets.mjs");
  });

  it("keeps the full-height game surface tactile, recoverable, audible, and accessible", () => {
    const css = read("src/PlayArea.scss");
    const wrapper = read("src/PhaserPlayArea.tsx");
    const scene = read("src/scenes/FruitFunnelScene.ts");
    const engine = read("src/logic/fruit-engine.ts");
    expect(wrapper).toContain("height: 844");
    expect(css).toContain("--phaser-mobile-height-ratio: 2.1641026");
    expect(css).toContain("min-height: 100dvh");
    expect(css).toContain("width: min(100%, 390px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(wrapper).toContain('aria-live="polite"');
    expect(scene).toContain("vine-rack.webp");
    expect(scene).toContain('this.sfx.play("combo")');
    expect(scene).toContain("this.reducedMotion");
    expect(scene).toContain('this.input.keyboard?.on("keydown"');
    expect(engine).toContain("hasCertifiedCompletion");
    expect(engine).toContain("Math.min(settledRemainingMs, frame.remainingMs)");
  });

  it("documents pair rules, controls, solver, recovery, guest boundary, and no-copy reference use", () => {
    const readme = read("README.md");
    const zh = read("README.zh-CN.md");
    expect(readme).toContain("adjacent **pair** rule, not match-three");
    expect(readme).toContain("bounded memoized solver");
    expect(readme).toContain("never rewinds elapsed time");
    expect(readme).toContain("explicitly forces guest mode");
    expect(readme).toContain("No reference source, screenshot, Canvas architecture");
    expect(zh).toContain("相邻**成对消除**，不是三消");
    expect(zh).toContain("仅游客模式边界");
  });
});

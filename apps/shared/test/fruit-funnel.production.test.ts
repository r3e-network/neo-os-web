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

  it("uses an original user-facing name, not any third-party product name", () => {
    const manifest = read("src/manifest.ts");
    const messages = read("src/locale/messages.ts");
    const publicManifest = read("neo-manifest.json");
    const surfaces = `${manifest}\n${messages}\n${publicManifest}`;
    // The genre reference (Suika Game / 合成大西瓜 / Watermelon Game) must never
    // surface as the product's own name. Code identifiers are out of scope here.
    expect(surfaces).not.toMatch(/スイカ|合成大?西瓜|Watermelon Game/i);
    expect(manifest).toContain('name: "Fruit Funnel"');
  });

  it("mounts Phaser 3 through the root framework with no legacy Canvas renderer", () => {
    const wrapper = read("src/PhaserPlayArea.tsx");
    const main = read("src/main.tsx");
    const scene = read("src/scenes/SuikaScene.ts");
    const engine = read("src/logic/suika-engine.ts");
    const allSource = [wrapper, main, scene, engine].join("\n");
    expect(wrapper).toContain("@framework/phaser/LazyPhaserGameComponent");
    expect(wrapper).toContain("loadScene={loadSuikaScene}");
    expect(main).toContain('import PhaserPlayArea from "./PhaserPlayArea"');
    expect(main).toContain("playArea: PhaserPlayArea");
    expect(scene).toContain("extends BaseScene");
    expect(scene).toContain("this.load.image");
    expect(allSource).not.toMatch(/CanvasRenderingContext2D|getContext\(["']2d["']\)|requestAnimationFrame\(/);
  });

  it("ships original gameplay art and auditable provenance", () => {
    const assets = [
      "public/banner.webp",
      "public/banner.avif",
      "public/logo.webp",
      "public/logo.avif",
      "public/art/orchard-stage.webp",
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
    const scene = read("src/scenes/SuikaScene.ts");
    const engine = read("src/logic/suika-engine.ts");
    expect(wrapper).toContain("height: 844");
    expect(css).toContain("--phaser-mobile-height-ratio: 2.1641026");
    expect(css).toContain("min-height: 100dvh");
    expect(css).toContain("width: min(100%, 390px)");
    expect(wrapper).toContain('aria-live="polite"');
    expect(scene).toContain("orchard-stage.webp");
    expect(scene).toContain('this.sfx.play("combo")');
    expect(scene).toContain("this.reducedMotion");
    expect(scene).toContain('this.input.keyboard?.on("keydown"');
    // Engine, not the physics scene, owns the merge/score/danger truth model.
    expect(engine).toContain("mergeFruits");
    expect(engine).toContain("setGameOver");
    expect(engine).toContain("WATERMELON_BONUS");
  });

  it("documents the merge rules, controls, recovery, guest boundary, and no-copy reference use", () => {
    const readme = read("README.md");
    const zh = read("README.zh-CN.md");
    expect(readme).toMatch(/Phaser 3/);
    expect(readme).toMatch(/merge/i);
    expect(readme).toContain("explicitly forces guest mode");
    expect(readme).toContain("No reference source, screenshot, Canvas architecture");
    expect(zh).toMatch(/合成/);
    expect(zh).toMatch(/游客模式边界/);
  });
});

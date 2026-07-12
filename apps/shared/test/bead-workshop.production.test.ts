import { existsSync, readFileSync, statSync } from "node:fs";
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
const read = (path: string) => readFileSync(resolve(appRoot, path), "utf8");

describe("Bead Workshop production boundary", () => {
  it("registers a guest-only, transaction-free game manifest", () => {
    const publicManifest = JSON.parse(read("neo-manifest.json")) as Record<
      string,
      unknown
    >;
    const platform = publicManifest.platform as Record<string, unknown>;
    expect(publicManifest).toMatchObject({
      id: "miniapp-bead-workshop",
      category: "games",
      contracts: {},
      permissions: [],
      features: { offlineSupport: true },
    });
    expect(platform.transactions).toBe(false);
    expect(
      (publicManifest.operation_panel as { operations: unknown[] }).operations,
    ).toEqual([]);

    const manifestSource = read("src/manifest.ts");
    const mainSource = read("src/main.tsx");
    expect(manifestSource).toContain('category: "game"');
    expect(manifestSource).toContain("supportsGuest: true");
    expect(manifestSource).toContain("supportsGameFi: false");
    expect(manifestSource).toContain("walletRequired: false");
    expect(manifestSource).toContain("payments: false");
    expect(manifestSource).toContain("oracle: false");
    expect(mainSource).toContain('app.mode.set("guest")');
  });

  it("mounts Phaser 3 through the root framework with no legacy Canvas renderer", () => {
    const wrapper = read("src/PhaserPlayArea.tsx");
    const main = read("src/main.tsx");
    const scene = read("src/scenes/BeadWorkshopScene.ts");
    const allSource = [
      wrapper,
      main,
      scene,
      read("src/logic/ColorDistributor.ts"),
    ].join("\n");
    expect(wrapper).toContain("@framework/phaser/LazyPhaserGameComponent");
    expect(wrapper).toContain("loadScene={loadBeadWorkshopScene}");
    expect(main).toContain('import PhaserPlayArea from "./PhaserPlayArea"');
    expect(main).toContain("playArea: PhaserPlayArea");
    expect(scene).toContain("extends BaseScene");
    expect(scene).toContain("this.animateMove(action)");
    expect(scene).toContain("this.reducedMotion");
    expect(allSource).not.toMatch(
      /CanvasRenderingContext2D|getContext\(["']2d["']\)|requestAnimationFrame\(/,
    );
    expect(allSource).not.toContain("Math.random");
  });

  it("ships original runtime artwork and auditable provenance", () => {
    const assets = [
      "public/banner.webp",
      "public/banner.avif",
      "public/logo.webp",
      "public/logo.avif",
      "public/art/workshop-bg.webp",
      "public/art/bead-highlight.png",
      "public/art/beads/coral.webp",
      "public/art/beads/sunflower.webp",
      "public/art/beads/mint.webp",
      "public/art/beads/sky.webp",
      "public/art/beads/tangerine.webp",
      "public/art/beads/cocoa.webp",
      "public/art/beads/raspberry.webp",
    ];
    for (const asset of assets) {
      const path = resolve(appRoot, asset);
      expect(existsSync(path), asset).toBe(true);
      expect(statSync(path).size, asset).toBeGreaterThan(1_000);
    }
    const attribution = read("public/art/ATTRIBUTION.md");
    expect(attribution).toContain("73bb72fa6b144148fc7c7e93c83ffd47f3d9f173");
    expect(attribution).toContain("no `LICENSE` file is present");
    expect(attribution).toContain(
      "No reference screenshot, image, Canvas architecture, source file",
    );
    expect(attribution).toContain("OpenAI image generation");
    expect(attribution).toContain("scripts/build-bead-assets.mjs");
  });

  it("keeps the game-first surface responsive, recoverable, audible, and accessible", () => {
    const css = read("src/PlayArea.scss");
    const wrapper = read("src/PhaserPlayArea.tsx");
    const scene = read("src/scenes/BeadWorkshopScene.ts");
    const engine = read("src/logic/BeadEngine.ts");
    expect(css).toContain("--phaser-mobile-height-ratio: 2.1641");
    expect(css).toContain("width: min(100%, 390px)");
    expect(css).toContain("margin-inline: auto");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain('url("/art/workshop-bg.webp")');
    expect(wrapper).toContain('aria-live="polite"');
    expect(wrapper).toContain("gameAriaLabel");
    expect(scene).toContain('keyboard.on("keydown"');
    expect(scene).toContain('this.sfx.play("win")');
    expect(scene).toContain("restartConfirm");
    expect(engine).toContain('this.state.phase = "stuck"');
    expect(engine).toMatch(
      /messageKey:\s*raw\.phase === "playing"\s*\? "statusRecoveredPaused"/,
    );
    expect(engine).toContain("historyFrameInvariant");
  });

  it("documents local-only behavior, controls, reference caveat, and MIT status", () => {
    const readme = read("README.md");
    const zh = read("README.zh-CN.md");
    expect(readme).toContain("constructive solution certificate");
    expect(readme).toContain(
      "no wallet prompt, contract, transaction, token, oracle call",
    );
    expect(readme).toContain("does not contain a `LICENSE` file");
    expect(readme).toContain("root [MIT License](../../LICENSE)");
    expect(zh).toContain("构造式可解证明");
    expect(zh).toContain("不连接钱包");
  });
});

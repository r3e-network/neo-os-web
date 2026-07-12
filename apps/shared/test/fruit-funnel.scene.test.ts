import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scenePath = resolve(
  fileURLToPath(import.meta.url),
  "..",
  "..",
  "..",
  "fruit-funnel",
  "src/scenes/FruitFunnelScene.ts",
);
const scene = readFileSync(scenePath, "utf8");

describe("Fruit Funnel Phaser scene contract", () => {
  it("uses authored orchard, rack, funnel, and six independent fruit resources as gameplay objects", () => {
    expect(scene).toContain('stage: "fruit-funnel-stage"');
    expect(scene).toContain('rack: "fruit-funnel-vine-rack"');
    expect(scene).toContain('funnel: "fruit-funnel-basket"');
    for (const color of ["apple", "orange", "lemon", "grape", "berry", "peach"]) {
      expect(scene).toContain(`${color}: "fruit-${color}"`);
    }
    expect(scene).toContain("this.add.image(DESIGN_W / 2, 215, ASSETS.rack)");
    expect(scene).toContain("this.add.image(DESIGN_W / 2, 600, ASSETS.funnel)");
    expect(scene).toContain("ASSETS.fruit[token.color]");
  });

  it("keeps the core release, pair burst, overflow recovery, clock, keyboard, audio, and reduced-motion loop alive", () => {
    expect(scene).toContain('this.dispatch("tapLane", laneIndex)');
    expect(scene).toContain("this.playPairBurst(previous, actionColor, ghost, targetX)");
    expect(scene).toContain('this.dispatch("undoMove")');
    expect(scene).toContain('this.dispatch("requestHint")');
    expect(scene).toContain('this.dispatch("togglePause")');
    expect(scene).toContain("delay: 1_000");
    expect(scene).toContain('this.sfx.play("throw")');
    expect(scene).toContain('this.sfx.play("combo")');
    expect(scene).toContain("if (!this.reducedMotion) this.cameras.main.flash");
    expect(scene).toContain("hoverScale: baseScale * 1.05");
    expect(scene).toContain("scale: pairScale * 1.34");
    expect(scene).toContain("scale: sparkleScale * 0.35");
    expect(scene).not.toMatch(/targets:\s*\[incoming, partner\][\s\S]{0,80}scale:\s*1\.34/);
    expect(scene).toContain('this.input.keyboard?.on("keydown"');
    expect(scene).toContain("Phaser.Scenes.Events.SHUTDOWN");
  });

  it("puts the seven authored basket compartments at center stage without fake slot art", () => {
    expect(scene).toContain("const CHANNEL_X = [64, 108, 151, 195, 239, 282, 326]");
    expect(scene).toContain("const CHANNEL_Y = 642");
    const renderChannel = scene.slice(
      scene.indexOf("private renderChannel"),
      scene.indexOf("private updateHud"),
    );
    expect(renderChannel).toContain("game.channel.length");
    expect(renderChannel).toContain("ASSETS.fruit[token.color]");
    expect(renderChannel).not.toContain("this.add.circle");
  });
});

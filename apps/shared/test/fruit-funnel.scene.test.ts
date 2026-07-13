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
  "src/scenes/SuikaScene.ts",
);
const scene = readFileSync(scenePath, "utf8");

describe("Fruit Funnel Phaser scene contract", () => {
  it("runs a real Matter physics world with gravity, bounds, and collision merging", () => {
    expect(scene).toContain("extends BaseScene");
    expect(scene).toContain('from "@framework/phaser"');
    expect(scene).toContain("this.matter.world.setGravity");
    expect(scene).toContain("this.matter.world.setBounds");
    expect(scene).toContain('this.matter.world.on("collisionstart"');
    expect(scene).toContain("this.matter.add.circle");
  });

  it("keeps the drop, merge, danger-line game over, aim, pause, and restart loop wired to the engine", () => {
    expect(scene).toContain('this.dispatch("dropCurrent"');
    expect(scene).toContain('this.dispatch("mergeFruits"');
    expect(scene).toContain('this.dispatch("setGameOver")');
    expect(scene).toContain('this.dispatch("setAim"');
    expect(scene).toContain('this.dispatch("togglePause")');
    expect(scene).toContain('this.dispatch("restartGame")');
    expect(scene).toContain("this.drawDangerLine");
  });

  it("keeps keyboard, audio, and reduced-motion accessibility alive", () => {
    expect(scene).toContain('this.input.keyboard?.on("keydown"');
    expect(scene).toContain('this.sfx.play("combo")');
    expect(scene).toContain("this.reducedMotion");
    expect(scene).toContain("if (!this.reducedMotion) this.cameras.main.flash");
  });

  it("loads real illustrated art and draws it, not emoji or text placeholders", () => {
    expect(scene).toContain("this.load.image");
    expect(scene).toContain("orchard-stage.webp");
    expect(scene).toContain("fruit-berry.webp");
    expect(scene).toContain("this.textures.exists");
    // fruit sprites are placed through the loaded texture keys
    expect(scene).toContain("FRUIT_TEXTURE_KEYS");
    expect(scene).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it("presents a resolved run outcome on game over", () => {
    expect(scene).toMatch(/outcome|newRecord/);
    expect(scene).toContain('this.loc("gameOverTitle"');
  });
});

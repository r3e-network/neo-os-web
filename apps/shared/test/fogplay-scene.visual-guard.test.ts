import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync(
  resolve(process.cwd(), "../fogplay/src/scenes/FogplayScene.ts"),
  "utf8",
);

describe("FogplayScene visual polish guard", () => {
  it("uses official token artwork and a warm game-table scene instead of the old dark grid prototype", () => {
    expect(sceneSource).toContain("officialGasTokenPhaserUrl");
    expect(sceneSource).toContain("this.load.image(ASSET_GAS, officialGasTokenPhaserUrl)");
    expect(sceneSource).toContain("FOGPLAY FLIP TABLE");
    expect(sceneSource).toContain("C.page");
    expect(sceneSource).toContain("C.felt");
    expect(sceneSource).toContain("C.table");

    expect(sceneSource).not.toContain("0x0d1117");
    expect(sceneSource).not.toContain("Subtle grid");
    expect(sceneSource).not.toContain("dark atmospheric arena");
  });

  it("keeps the Phaser layout responsive to framework-owned mobile canvas sizing", () => {
    expect(sceneSource).toContain("protected onResize");
    expect(sceneSource).toContain("rebuildScene");
    expect(sceneSource).toContain("this.children.removeAll(true)");
    expect(sceneSource).toContain("this.scale.width");
    expect(sceneSource).toContain("this.scale.height");
  });

  it("maps win/loss outcomes to the correct landed coin side", () => {
    expect(sceneSource).toContain("landedSide(choice, result)");
    expect(sceneSource).toContain('result === "lost"');
    expect(sceneSource).toContain('choice === "heads" ? "tails" : "heads"');
    expect(sceneSource).toContain("this.showResult(result, landedSide(choice, result))");
  });
});

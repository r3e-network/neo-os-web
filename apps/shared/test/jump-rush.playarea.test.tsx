import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("jump-rush legacy playarea entry", () => {
  it("delegates to the single Phaser 3 production surface", () => {
    const root = resolve(__dirname, "../..");
    const source = readFileSync(resolve(root, "jump-rush/src/PlayArea.tsx"), "utf8");

    expect(source).toContain('export { default } from "./PhaserPlayArea"');
    expect(source).not.toContain("generatePlatforms");
    expect(source).not.toContain("requestAnimationFrame");
    expect(source).not.toContain("jr-lobby-preview");
  });
});

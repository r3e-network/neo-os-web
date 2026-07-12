import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("merge-kingdom PlayArea compatibility entry", () => {
  it("routes legacy imports to the single production Phaser surface", () => {
    const source = readFileSync(
      resolve(__dirname, "../../merge-kingdom/src/PlayArea.tsx"),
      "utf8",
    );

    expect(source.trim()).toBe('export { default } from "./PhaserPlayArea";');
    expect(source).not.toMatch(/<form\b|PlayStage|useMessages|recordMove:\s*\(/);
  });
});

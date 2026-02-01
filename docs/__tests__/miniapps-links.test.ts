import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const files = [
  "docs/manifest-spec.md",
  "docs/tutorials/TUTORIAL_INDEX.md",
  "docs/tutorials/01-payment-miniapp/README.md",
  "docs/tutorials/02-provably-fair-game/README.md",
  "docs/tutorials/03-governance-voting/README.md",
];

describe("docs miniapps links", () => {
  it("does not reference miniapps-uniapp", () => {
    const contents = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(contents.includes("miniapps-uniapp")).toBe(false);
  });
});

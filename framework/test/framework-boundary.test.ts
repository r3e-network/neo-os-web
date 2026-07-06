import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sharedRoot = resolve(repoRoot, "apps/shared");
const frameworkRoot = resolve(repoRoot, "framework");

describe("framework package boundary", () => {
  it("keeps SDK implementation outside apps/shared", () => {
    expect(existsSync(frameworkRoot)).toBe(true);

    for (const name of ["game", "gamefi", "logic", "phaser"]) {
      expect(
        existsSync(resolve(sharedRoot, name)),
        `${name} should live under framework/`,
      ).toBe(false);
    }
  });

  it("does not expose framework modules from the shared UI package", () => {
    const pkg = JSON.parse(readFileSync(resolve(sharedRoot, "package.json"), "utf8")) as {
      exports?: Record<string, string>;
    };
    const exported = Object.keys(pkg.exports ?? {});

    expect(exported).not.toContain("./game");
    expect(exported).not.toContain("./game/*");
    expect(exported).not.toContain("./gamefi");
    expect(exported).not.toContain("./gamefi/*");
    expect(exported).not.toContain("./logic/*");
    expect(exported).not.toContain("./phaser");
    expect(exported).not.toContain("./phaser/*");
  });
});

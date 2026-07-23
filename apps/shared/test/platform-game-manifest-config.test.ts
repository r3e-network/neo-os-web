import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { platformGameConfigFromManifest } from "../react/defineMiniApp";
import type { MiniAppManifest } from "../types/miniapp-manifest";

const manifest = (contract: MiniAppManifest["contract"]): MiniAppManifest => ({
  name: "Config test",
  contract,
});

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("platformGameConfigFromManifest", () => {
  it("derives the shared engine hash from a platform-game binding", () => {
    expect(platformGameConfigFromManifest(manifest({
      mode: "shared",
      moduleId: "platform-game",
      engine: `0x${"ab".repeat(20)}`,
    }))).toEqual({ gameHash: `0x${"ab".repeat(20)}` });
  });

  it("does not reroute custom or unrelated shared contracts", () => {
    expect(platformGameConfigFromManifest(manifest({
      mode: "custom",
      engine: `0x${"ab".repeat(20)}`,
    }))).toBeUndefined();
    expect(platformGameConfigFromManifest(manifest({
      mode: "shared",
      moduleId: "platform-vault",
      engine: `0x${"ab".repeat(20)}`,
    }))).toBeUndefined();
  });

  it("pins shared Solved event payout slots after the score field", () => {
    for (const slug of ["aim-master", "curve-arrow", "flappy-dash", "snake-bounty", "sudoku"]) {
      const source = fs.readFileSync(path.join(repoRoot, "apps", slug, "src", "main.tsx"), "utf8");
      const slots = source.match(/const SOLVED_SLOTS\s*=\s*\{([\s\S]*?)\};/)?.[1] ?? "";
      expect(slots, slug).toMatch(/solvedPayout:\s*5/);
      expect(slots, slug).toMatch(/totalWon:\s*6/);
      expect(slots, slug).toMatch(/undos:\s*7/);
    }
  });
});

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const GAMES = [
  "aim-master",
  "burn-league",
  "color-clash",
  "dice-game",
  "flappy-dash",
  "fogplay",
  "game-2048",
  "gas-lucky-pool",
  "jump-rush",
  "last-survivor",
  "merge-kingdom",
  "on-chain-tarot",
  "pet-potion",
  "red-envelope",
  "sheep-solitaire",
  "snake-bounty",
  "sudoku",
] as const;

function pathOf(app: string, file: string): string {
  return resolve(repoRoot, "apps", app, "src", file);
}

function read(app: string, file: string): string {
  return readFileSync(pathOf(app, file), "utf8");
}

describe("game guest/gamefi mode adoption", () => {
  it.each(GAMES)("opts %s into the two-mode launcher", (app) => {
    const manifest = read(app, "manifest.ts");
    expect(
      /supportsGuest:\s*true/.test(manifest) ||
        /modes:\s*\{[^}]*guest:\s*true[^}]*\}/s.test(manifest),
    ).toBe(true);
  });

  it.each(GAMES)("keeps %s guest play on a local guest engine", (app) => {
    const main = read(app, "main.tsx");

    expect(existsSync(pathOf(app, "logic/guest-engine.ts"))).toBe(true);
    expect(main).toMatch(/from\s+["']\.\/logic\/guest-engine["']/);
    expect(main).toContain("app.mode.guestLeaderboard");
    expect(main).toContain("app.mode.onChange");
    expect(main).toContain("app.mode.isGuest()");
  });

  it.each(GAMES)("exposes %s mode to the Phaser wrapper", (app) => {
    const main = read(app, "main.tsx");
    const playArea = read(app, "PhaserPlayArea.tsx");
    const stateReturn = main.slice(main.lastIndexOf("state:"));

    expect(main).toMatch(/createObservable(?:<[^>]+>)?\(app\.mode\.get\(\)\)/);
    expect(stateReturn).toMatch(/\b(appMode|mode)\b/);
    expect(playArea).toMatch(/str\(["'](?:appMode|mode)["'],\s*["']gamefi["']\)/);
    expect(playArea).toMatch(/\bisGuest\b|\bguest\b/);
  });
});

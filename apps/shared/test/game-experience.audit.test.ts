import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const APPS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

interface GameApp {
  name: string;
  srcDir: string;
}

const GAME_LIKE_SOCIAL_APPS = new Set([
  "gas-lucky-pool",
  "red-envelope",
]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".scss"]);
const ASSET_PATTERN =
  /(<picture\b|<img\b|from\s+["'][^"']+\.(?:png|jpe?g|webp|avif|svg)["']|url\(["']?[^)]+\.(?:png|jpe?g|webp|avif|svg))/i;
const PLAY_SURFACE_PATTERN =
  /(arena|stage|machine|table|plaza|workbench|lane|route|deck)/i;

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function discoverGameApps(): GameApp[] {
  const apps: GameApp[] = [];
  for (const entry of readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "shared" || entry.name === "host-app") continue;

    const appDir = path.join(APPS_DIR, entry.name);
    const manifestPath = path.join(appDir, "src", "manifest.ts");
    if (!existsSync(manifestPath)) continue;

    const manifest = readFileSync(manifestPath, "utf8");
    const isDeclaredGame = /category:\s*"game"|shell:\s*"game"/.test(manifest);
    const isGameLikeSocialApp = GAME_LIKE_SOCIAL_APPS.has(entry.name);
    if (!isDeclaredGame && !isGameLikeSocialApp) continue;

    apps.push({
      name: entry.name,
      srcDir: path.join(appDir, "src"),
    });
  }
  return apps.sort((a, b) => a.name.localeCompare(b.name));
}

function readAppSources(app: GameApp): string {
  return collectSourceFiles(app.srcDir)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

const gameApps = discoverGameApps();

describe("game miniapp experience audit", () => {
  it("discovers the committed game catalog", () => {
    expect(gameApps.map((app) => app.name)).toEqual([
      "burn-league",
      "daily-checkin",
      "dice-game",
      "fogplay",
      "gas-lucky-pool",
      "gasbox",
      "last-survivor",
      "on-chain-tarot",
      "red-envelope",
      "time-capsule",
      "unbreakable-vault",
    ]);
  });

  for (const app of gameApps) {
    it(`${app.name} keeps a game-like surface with real assets, motion, staging, and reduced-motion fallback`, () => {
      const source = readAppSources(app);
      const animationCount = (source.match(/animation\s*:/g) ?? []).length;
      const keyframeCount = (source.match(/@keyframes\s+/g) ?? []).length;

      expect(
        source,
        `${app.name}: game surfaces need a visible scene/asset, not just form controls`,
      ).toMatch(ASSET_PATTERN);
      expect(
        source,
        `${app.name}: the core flow needs a staged play surface instead of raw form controls`,
      ).toMatch(PLAY_SURFACE_PATTERN);
      expect(
        keyframeCount,
        `${app.name}: games need explicit keyframe motion for the core interaction`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        animationCount,
        `${app.name}: game states need visible animated feedback`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        source,
        `${app.name}: motion-heavy game UI must honor reduced-motion users`,
      ).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    });
  }
});

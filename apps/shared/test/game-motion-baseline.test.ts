import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appsRoot = resolve(process.cwd(), "..");
const gamifiedAppOverrides = new Set(["gas-lucky-pool", "red-envelope"]);

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function isGameApp(app: string): boolean {
  const manifest = readIfExists(resolve(appsRoot, app, "src/manifest.ts"));
  const neoManifest = readIfExists(resolve(appsRoot, app, "neo-manifest.json"));
  const combined = `${manifest}\n${neoManifest}`;
  return (
    gamifiedAppOverrides.has(app) ||
    /category:\s*["']game["']/.test(combined) ||
    /"category"\s*:\s*"games"/.test(combined)
  );
}

function gameApps(): string[] {
  return readdirSync(appsRoot)
    .filter((app) => existsSync(resolve(appsRoot, app)))
    .filter(isGameApp)
    .sort();
}

describe("Game miniapp motion baseline", () => {
  it("keeps every game surface animated, asset-led, and reduced-motion safe", () => {
    const games = gameApps();

    expect(games.length).toBeGreaterThanOrEqual(11);

    const failures = games.flatMap((app) => {
      const appRoot = resolve(appsRoot, app);
      const playAreaScss = readIfExists(resolve(appRoot, "src/PlayArea.scss"));
      const playAreaTsx = readIfExists(resolve(appRoot, "src/PlayArea.tsx"));
      const publicAssets = existsSync(resolve(appRoot, "public"))
        ? readdirSync(resolve(appRoot, "public")).filter((file) =>
            /\.(?:avif|webp|jpe?g|png)$/i.test(file),
          )
        : [];
      const checks = [
        {
          ok: (playAreaScss.match(/@keyframes/g) ?? []).length >= 3,
          reason: "needs at least three named keyframe sequences",
        },
        {
          ok: /animation:/.test(playAreaScss),
          reason: "needs active animation rules",
        },
        {
          ok: /prefers-reduced-motion:\s*reduce/.test(playAreaScss),
          reason: "needs reduced-motion coverage",
        },
        {
          ok: publicAssets.length > 0 && /\.(?:avif|webp|jpe?g|png)/i.test(`${playAreaScss}\n${playAreaTsx}`),
          reason: "needs real raster assets referenced by the play surface",
        },
      ];

      return checks
        .filter((check) => !check.ok)
        .map((check) => `${app}: ${check.reason}`);
    });

    expect(failures).toEqual([]);
  });
});

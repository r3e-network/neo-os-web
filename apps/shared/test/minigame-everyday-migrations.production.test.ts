import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const APPS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REFERENCE_COMMIT = "73bb72fa6b144148fc7c7e93c83ffd47f3d9f173";

const MIGRATIONS = [
  { slug: "bead-workshop", scene: "BeadWorkshopScene.ts" },
  { slug: "screw-sort", scene: "ScrewSortScene.ts" },
  { slug: "arrow-escape", scene: "ArrowEscapeScene.ts" },
  // fruit-funnel's root scene is now SuikaScene.ts after its rebuild into a
  // real-physics fruit-merge game (retired match-2 FruitFunnelScene.ts deleted).
  { slug: "fruit-funnel", scene: "SuikaScene.ts" },
] as const;

function appPath(slug: string, path: string): string {
  return resolve(APPS_ROOT, slug, path);
}

function read(slug: string, path: string): string {
  return readFileSync(appPath(slug, path), "utf8");
}

function attributionPath(slug: string): string {
  const candidates = ["ATTRIBUTION.md", "public/art/ATTRIBUTION.md"];
  const match = candidates.find((path) => existsSync(appPath(slug, path)));
  if (!match) throw new Error(`${slug} has no asset attribution file`);
  return match;
}

function runtimeArt(slug: string): string[] {
  const directory = appPath(slug, "public/art");
  if (!existsSync(directory)) return [];
  const paths: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if ([".avif", ".png", ".webp"].includes(extname(path))) paths.push(path);
    }
  };
  walk(directory);
  return paths;
}

describe("minigame-everyday production migrations", () => {
  for (const { slug, scene } of MIGRATIONS) {
    it(`${slug} is an executable, offline, guest-only Phaser game`, () => {
      for (const path of [
        "index.html",
        "package.json",
        "neo-manifest.json",
        "src/main.tsx",
        "src/manifest.ts",
        "src/PhaserPlayArea.tsx",
        `src/scenes/${scene}`,
      ]) {
        expect(existsSync(appPath(slug, path)), `${slug}/${path}`).toBe(true);
      }

      const html = read(slug, "index.html");
      const main = read(slug, "src/main.tsx");
      const manifestSource = read(slug, "src/manifest.ts");
      const wrapper = read(slug, "src/PhaserPlayArea.tsx");
      const sceneSource = read(slug, `src/scenes/${scene}`);

      expect(html).toContain('<div id="app"></div>');
      expect(html).toMatch(/src\/main\.tsx/);
      expect(main).toContain('app.mode.set("guest")');
      expect(manifestSource).toContain("supportsGuest: true");
      expect(manifestSource).toContain("supportsGameFi: false");
      expect(wrapper).toContain("LazyPhaserGameComponent");
      expect(sceneSource).toContain("extends BaseScene");
      expect(sceneSource).toMatch(/preloadAssets|load\.image/);
      expect(`${main}\n${wrapper}\n${sceneSource}`).not.toContain("new Phaser.Game");

      const publicManifest = JSON.parse(read(slug, "neo-manifest.json")) as {
        id?: string;
        category?: string;
        contracts?: Record<string, string>;
        permissions?: unknown[];
        operation_panel?: { operations?: unknown[] };
        platform?: { transactions?: boolean };
        features?: { offlineSupport?: boolean };
      };
      expect(publicManifest.id).toBe(`miniapp-${slug}`);
      expect(publicManifest.category).toBe("games");
      expect(publicManifest.contracts ?? {}).toEqual({});
      expect(publicManifest.permissions).toEqual([]);
      expect(publicManifest.operation_panel?.operations).toEqual([]);
      expect(publicManifest.platform?.transactions).toBe(false);
      expect(publicManifest.features?.offlineSupport).toBe(true);
    });

    it(`${slug} ships real runtime art with pinned, no-copy provenance`, () => {
      for (const path of ["public/logo.webp", "public/banner.webp"]) {
        expect(existsSync(appPath(slug, path)), `${slug}/${path}`).toBe(true);
        expect(statSync(appPath(slug, path)).size, `${slug}/${path}`).toBeGreaterThan(8_000);
      }
      const art = runtimeArt(slug);
      expect(art.length, `${slug}: runtime art count`).toBeGreaterThanOrEqual(3);
      expect(
        art.filter((path) => statSync(path).size > 4_000).length,
        `${slug}: substantial runtime art count`,
      ).toBeGreaterThanOrEqual(2);

      const attribution = read(slug, attributionPath(slug));
      expect(attribution).toContain(REFERENCE_COMMIT);
      expect(attribution).toMatch(/OpenAI image generation|ImageGen/i);
      expect(attribution).toMatch(/no .*cop(?:y|ied)|not cop(?:y|ied)/i);
      expect(attribution).toMatch(/no (?:standalone )?`?LICENSE|license.*(?:missing|absent|not contain)/i);
      expect(attribution).toMatch(/exec-[a-z0-9-]+|assets-source\//i);
    });

    it(`${slug} documents the complete player and production boundary bilingually`, () => {
      const englishPath = appPath(slug, "README.md");
      const chinesePath = appPath(slug, "README.zh-CN.md");
      expect(existsSync(englishPath), `${slug}/README.md`).toBe(true);
      expect(existsSync(chinesePath), `${slug}/README.zh-CN.md`).toBe(true);
      const english = readFileSync(englishPath, "utf8");
      const chinese = readFileSync(chinesePath, "utf8");
      expect(english).toMatch(/Phaser 3/i);
      expect(english).toMatch(/guest|local-only|wallet-free|entirely local/i);
      expect(english).toMatch(/test|verify/i);
      expect(chinese).toMatch(/[\u3400-\u9fff]{8}/);
      expect(chinese).toMatch(/游客|本地|钱包/);
      expect(chinese).toMatch(/测试|验证|审计|可解证明/);
    });
  }
});

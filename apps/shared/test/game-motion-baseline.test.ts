import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appsRoot = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const gamifiedAppOverrides = new Set(["gas-lucky-pool", "red-envelope"]);
const LOCAL_ACTION_PREVIEW_PATTERN =
  /(ActionPreview|actionPreview|[A-Za-z]+Preview|preview[A-Za-z]*)/;
const PREVIEW_TIMEOUT_PATTERN =
  /setTimeout\([\s\S]{0,800}(?:set[A-Za-z]*Preview|setActionPreview)\(/;
const PREVIEW_START_PATTERN =
  /start[A-Za-z]*(?:Action)?Preview|set[A-Za-z]*Preview\(true\)|setActionPreview\(/;
const phaserGames = [
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
  it("routes every Phaser wrapper through the root framework Phaser SDK", () => {
    const frameworkPhaser = readIfExists(resolve(appsRoot, "..", "framework/phaser/index.ts"));

    expect(frameworkPhaser).toContain("PhaserGameComponent");

    for (const app of phaserGames) {
      const wrapper = readIfExists(resolve(appsRoot, app, "src/PhaserPlayArea.tsx"));

      expect(wrapper, `${app}: Phaser wrapper must exist`).not.toBe("");
      expect(wrapper, `${app}: wrapper should import the root framework Phaser SDK`).toContain(
        `from "@framework/phaser"`,
      );
      expect(wrapper, `${app}: wrapper should not depend on the old shared Phaser module`).not.toContain(
        `@shared/phaser`,
      );
    }
  });

  it("uses the Phaser renderer as the production play surface for every Phaser game", () => {
    for (const app of phaserGames) {
      const main = readIfExists(resolve(appsRoot, app, "src/main.tsx"));

      expect(main, `${app}: miniapp entry must exist`).not.toBe("");
      expect(main, `${app}: production entry should import the Phaser play area`).toContain(
        `import PhaserPlayArea from "./PhaserPlayArea";`,
      );
      expect(main, `${app}: production entry should mount the Phaser play area`).toContain(
        "playArea: PhaserPlayArea",
      );
      expect(main, `${app}: production entry should not mount the legacy React play area`).not.toMatch(
        /playArea:\s*(?:PlayArea|[A-Za-z]+Adapter)\b/,
      );
      expect(main, `${app}: production entry should not import the legacy play area`).not.toMatch(
        /from\s+["']\.\/PlayArea["']/,
      );
    }
  });

  it("keeps the root framework Phaser host accessible while scenes boot", () => {
    const phaserHost = readIfExists(
      resolve(appsRoot, "..", "framework/phaser/PhaserGameComponent.tsx"),
    );

    expect(phaserHost).toContain(`bridge.on("ready"`);
    expect(phaserHost).toContain("onReady");
    expect(phaserHost).toContain("aria-busy");
    expect(phaserHost).toContain(`role="application"`);
    expect(phaserHost).toContain("data-ready");
    expect(phaserHost).toContain("loadingLabel");
    expect(phaserHost).toContain("The displayed host size is framework-owned");
    expect(phaserHost).toContain("window.visualViewport");
    expect(phaserHost).toContain(`window.matchMedia?.("(pointer: coarse)")`);
    expect(phaserHost).toContain("MOBILE_VIEWPORT_WIDTH");
    expect(phaserHost).toContain("MIN_MOBILE_GAME_HEIGHT");
    expect(phaserHost).toContain("new ResizeObserver");
    expect(phaserHost).toContain("availableWidth");
    expect(phaserHost).toContain("availableHeight");
    expect(phaserHost).toContain("height: Math.round(availableHeight)");
    expect(phaserHost).toContain("viewportHeight - hostTop - bottomReserve");
    expect(phaserHost).toContain("data-auto-mobile-size");
    expect(phaserHost).toContain(`const resolvedWidth = autoMobileSizePx?.width ?? "100%"`);
    expect(phaserHost).toContain(`const resolvedHeight = autoMobileSizePx?.height ?? "100%"`);
    expect(phaserHost).toContain("minHeight: autoMobileSizePx ? undefined");
    expect(phaserHost).toContain("gameRef.current?.scale.setGameSize(autoMobileSizePx.width, autoMobileSizePx.height)");
    expect(phaserHost).toContain("gameRef.current?.scale.refresh()");
    expect(phaserHost).not.toContain("width = ");
    expect(phaserHost).not.toContain("height = 560");
    expect(phaserHost).not.toContain("autoMobileSize =");
    expect(phaserHost).not.toContain("Math.max(aspectHeight, availableHeight)");
    expect(phaserHost).not.toContain("viewportHeight * 0.78");
    expect(phaserHost).not.toContain("viewportHeight * 0.86");
  });

  it("does not hardcode mobile canvas heights in Phaser wrappers", () => {
    for (const app of phaserGames) {
      const wrapper = readIfExists(resolve(appsRoot, app, "src/PhaserPlayArea.tsx"));
      const phaserMounts = wrapper.match(/<PhaserGameComponent[\s\S]*?\/>/g) ?? [];

      expect(phaserMounts.length, `${app}: wrapper should mount Phaser`).toBeGreaterThan(0);

      for (const mount of phaserMounts) {
        expect(mount, `${app}: mobile height should be framework-owned`).not.toMatch(
          /\sheight=/,
        );
        expect(mount, `${app}: mobile width should be framework-owned`).not.toMatch(
          /\swidth=/,
        );
        expect(mount, `${app}: should not manually configure automatic mobile sizing`).not.toContain(
          "autoMobileSize",
        );
      }
    }
  });

  it("keeps Aim Master Phaser layout driven by the resized canvas", () => {
    const scene = readIfExists(
      resolve(appsRoot, "aim-master/src/scenes/AimMasterScene.ts"),
    );

    expect(scene).toContain("protected onResize");
    expect(scene).toContain("this.scale.width");
    expect(scene).toContain("this.scale.height");
    expect(scene).toContain("rebuildResponsiveScene");
    expect(scene).toContain("gaugeXFromLogical");
    expect(scene).toContain("gaugeLogicalFromX");
    expect(scene).not.toMatch(/const\s+W\s*=\s*400/);
    expect(scene).not.toMatch(/const\s+H\s*=\s*600/);
    expect(scene).not.toContain("GAUGE_Y");
    expect(scene).not.toContain("GAUGE_LEFT");
    expect(scene).not.toContain("GAUGE_RIGHT");
    expect(scene).not.toContain("TGT_CX");
    expect(scene).not.toContain("TGT_CY");
    expect(scene).not.toContain("scale: 1.04");
    expect(scene).not.toContain("scale: 1.12");
  });

  it("keeps Snake Bounty Phaser route cards synced with progression-gated starts", () => {
    const scene = readIfExists(
      resolve(appsRoot, "snake-bounty/src/scenes/SnakeScene.ts"),
    );
    const wrapper = readIfExists(
      resolve(appsRoot, "snake-bounty/src/PhaserPlayArea.tsx"),
    );
    const main = readIfExists(
      resolve(appsRoot, "snake-bounty/src/main.tsx"),
    );

    expect(scene).toContain(`this.dispatch("selectDifficulty", { difficulty })`);
    expect(scene).toContain("isDifficultyLocked");
    expect(scene).toContain("progressionRequiredDifficulty");
    expect(scene).toContain("type SnakeLayout");
    expect(scene).toContain("computeLayout(width: number, height: number)");
    expect(scene).toContain("this.layout = this.computeLayout(ww, hh)");
    expect(scene).toContain("buildBountyTrail");
    expect(scene).not.toContain("const CELL =");
    expect(scene).not.toContain("const GRID_TOP");
    expect(scene).not.toContain("const GRID_PX");
    expect(wrapper).toContain("progressionReady");
    expect(wrapper).toContain("progressionRequiredDifficulty");
    expect(wrapper).toContain("progressionUnavailableShort");
    expect(wrapper).toContain("progressionNextRoute");
    expect(wrapper).toContain("poolFree >= Number(gasDisplay(rule.rewardFixed8))");
    expect(main).toContain(`app.actions.register("selectDifficulty"`);
    expect(main).toContain("refreshProgression");
    expect(main).toContain("obs.progressionRequiredDifficulty.set");
  });

  it("keeps game stages large and touchable on mobile", () => {
    const v2Styles = readIfExists(
      resolve(appsRoot, "shared/components-react/v2/v2.scss"),
    );

    expect(v2Styles).toContain("@media (max-width: 560px)");
    expect(v2Styles).toContain("min-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))");
    expect(v2Styles).toContain("flex-direction: column");
    expect(v2Styles).toContain(".mx2-cat-game.mx2-stage");
    expect(v2Styles).toContain("flex: 1 1 auto");
    expect(v2Styles).toContain("padding: 8px 6px 10px !important");
    expect(v2Styles).toContain(".mx2-cat-game .mx2-stage__subtitle");
    expect(v2Styles).toContain("display: none !important");
    expect(v2Styles).toContain(".mx2-cat-game .mx2-stage__scene");
    expect(v2Styles).toContain("min-height: 0 !important");
    expect(v2Styles).toContain("justify-content: stretch");
    expect(v2Styles).toContain("padding: 0 !important");
    expect(v2Styles).toContain('.mx2-cat-game .mx2-stage__scene [role="application"]');
    expect(v2Styles).toContain("width: 100% !important");
    expect(v2Styles).toContain("max-width: 100%");
  });

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
      // Redesigned (v2) apps source their motion from the shared v2 kit and
      // their art from the shared SVG atlas instead of declaring per-app
      // @keyframes + raster files. Either approach must still be rich and safe.
      const usesSharedMotion =
        /@use\s+["']@shared\/styles\/v2\/motion["']/.test(playAreaScss) ||
        /@use\s+["']@shared\/components-react\/v2\/v2["']/.test(playAreaScss);
      const usesSharedArt =
        /from\s+["']@shared\/art["']/.test(playAreaTsx) ||
        /from\s+["']@shared\/components-react\/v2["']/.test(playAreaTsx);

      const checks = [
        {
          ok:
            usesSharedMotion ||
            (playAreaScss.match(/@keyframes/g) ?? []).length >= 8,
          reason: "needs at least eight named keyframe sequences",
        },
        {
          ok:
            usesSharedMotion ||
            (playAreaScss.match(/animation:/g) ?? []).length >= 8,
          reason: "needs at least eight active animation rules",
        },
        {
          ok:
            usesSharedMotion ||
            /prefers-reduced-motion:\s*reduce/.test(playAreaScss),
          reason: "needs reduced-motion coverage",
        },
        {
          ok:
            usesSharedArt ||
            (publicAssets.length > 0 &&
              /\.(?:avif|webp|jpe?g|png)/i.test(`${playAreaScss}\n${playAreaTsx}`)),
          reason: "needs real assets referenced by the play surface",
        },
        {
          ok:
            LOCAL_ACTION_PREVIEW_PATTERN.test(playAreaTsx) &&
            PREVIEW_TIMEOUT_PATTERN.test(playAreaTsx) &&
            PREVIEW_START_PATTERN.test(playAreaTsx),
          reason:
            "needs immediate local action preview so taps animate before chain confirmation",
        },
        {
          ok:
            /aria-busy=/.test(playAreaTsx) ||
            // v2 apps inherit the busy state from the shared ActionRail
            // (which renders aria-busy on the primary action when loading).
            /from\s+["']@shared\/components-react\/v2["']/.test(playAreaTsx),
          reason:
            "needs a busy game surface so action animations are exposed to users and assistive tech",
        },
      ];

      return checks
        .filter((check) => !check.ok)
        .map((check) => `${app}: ${check.reason}`);
    });

    expect(failures).toEqual([]);
  });
});

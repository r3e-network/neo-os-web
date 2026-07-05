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
  /(<picture\b|<img\b|from\s+["'][^"']+\.(?:png|jpe?g|webp|avif|svg)["']|url\(["']?[^)]+\.(?:png|jpe?g|webp|avif|svg)|from\s+["']@shared\/art["']|<DiceArt\b|<ChipArt\b|<CoinArt\b|<CardArt\b)/i;
const PLAY_SURFACE_PATTERN =
  /(arena|stage|machine|table|plaza|workbench|lane|route|deck)/i;
const ACTION_STATE_PATTERN =
  /(aria-busy|data-state=|(?:is-|--)(?:rolling|tossing|opening|sending|sealing|sealed|creating|launching|claiming|pulling|drawing|dealing|dealt|flipping|flipped|revealing|revealed|burning|settling|settled|checking|funding|refunding|withdrawing|busy|active|complete))/i;
const INTERACTION_MOTION_PATTERN =
  /(?:is-|--|mx2-|data-state="|data-pulse="|class="[^"]*mx2-(?:spark|float|roll|deal|flip|burst|fly-coin)|[A-Za-z]+Preview|startActionPreview|startCheckInPreview)[\s\S]{0,900}animation(?:-(?:duration|name|timing|iteration))?\s*:/i;
const RESULT_STATE_PATTERN =
  /(result|outcome|winner|won|lost|claimed|claimSucceeded|lastSuccessType|reward|payout|complete|revealed|history|receipt|settled|claimStatus)/i;
const LOCAL_ACTION_PREVIEW_PATTERN =
  /(ActionPreview|actionPreview|[A-Za-z]+Preview|preview[A-Za-z]*)/;
const PREVIEW_TIMEOUT_PATTERN =
  /setTimeout\([\s\S]{0,900}(?:set[A-Za-z]*Preview|setActionPreview)\(/;
const PREVIEW_START_PATTERN =
  /start[A-Za-z]*(?:Action)?Preview|set[A-Za-z]*Preview\(true\)|setActionPreview\(/;
const FORM_CONTROL_PATTERN = /<(input|textarea|select)\b|<NeoInput\b|<NeoTextarea\b/g;
const BUTTON_PATTERN = /<button\b|<NeoButton\b/g;
const TEE_REWARD_GAMES = [
  "aim-master",
  "color-clash",
  "flappy-dash",
  "game-2048",
  "jump-rush",
  "merge-kingdom",
  "pet-potion",
  "sheep-solitaire",
  "snake-bounty",
  "sudoku",
] as const;

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

/**
 * The redesigned (v2) miniapps consume a shared, centralised motion kit
 * (`@shared/styles/v2/motion` + `@shared/components-react/v2/v2`) rather than
 * re-declaring @keyframes per app. Apps that import the v2 system inherit a
 * rich motion library (tumble, deal, flip, coin-fly, burst, gauge-sweep, …) and
 * its reduced-motion override, so their bespoke local @keyframe count is low by
 * design. This returns true when an app sources its motion from the v2 kit.
 */
function usesSharedMotionKit(source: string): boolean {
  return /@use\s+["']@shared\/styles\/v2\/motion["']/.test(source);
}

const gameApps = discoverGameApps();

describe("game miniapp experience audit", () => {
  it("discovers the committed game catalog", () => {
    expect(gameApps.map((app) => app.name)).toEqual([
      "aim-master",
      "burn-league",
      "color-clash",
      "daily-checkin",
      "dice-game",
      "flappy-dash",
      "fogplay",
      "game-2048",
      "gas-lucky-pool",
      "gasbox",
      "jump-rush",
      "last-survivor",
      "merge-kingdom",
      "on-chain-tarot",
      "pet-potion",
      "red-envelope",
      "sheep-solitaire",
      "snake-bounty",
      "sudoku",
      "time-capsule",
      "unbreakable-vault",
    ]);
  });

  for (const app of gameApps) {
    it(`${app.name} keeps a game-like surface with real assets, motion, staging, and reduced-motion fallback`, () => {
      const source = readAppSources(app);
      const animationCount = (source.match(/animation\s*:/g) ?? []).length;
      const keyframeCount = (source.match(/@keyframes\s+/g) ?? []).length;
      const formControlCount = (source.match(FORM_CONTROL_PATTERN) ?? []).length;
      const buttonCount = (source.match(BUTTON_PATTERN) ?? []).length;
      const sharedMotion = usesSharedMotionKit(source);

      expect(
        source,
        `${app.name}: game surfaces need a visible scene/asset, not just form controls`,
      ).toMatch(ASSET_PATTERN);
      expect(
        source,
        `${app.name}: the core flow needs a staged play surface instead of raw form controls`,
      ).toMatch(PLAY_SURFACE_PATTERN);
      expect(
        source,
        `${app.name}: games need a visible live-action state when the user commits an action`,
      ).toMatch(ACTION_STATE_PATTERN);
      expect(
        source,
        `${app.name}: game actions must trigger an immediate local preview instead of waiting silently for chain confirmation`,
      ).toMatch(LOCAL_ACTION_PREVIEW_PATTERN);
      expect(
        source,
        `${app.name}: local game previews need a timed release so the surface does not get stuck in action motion`,
      ).toMatch(PREVIEW_TIMEOUT_PATTERN);
      expect(
        source,
        `${app.name}: the primary game action must start a local motion preview before/with dispatch`,
      ).toMatch(PREVIEW_START_PATTERN);
      // Redesigned apps source their motion from the shared v2 kit; legacy apps
      // declare their own @keyframes. Either satisfies "a rich motion system".
      if (!sharedMotion) {
        expect(
          keyframeCount,
          `${app.name}: games need a rich motion system, not a token spinner beside form controls`,
        ).toBeGreaterThanOrEqual(8);
        expect(
          animationCount,
          `${app.name}: game states need visible animated feedback across idle, action, and result states`,
        ).toBeGreaterThanOrEqual(8);
        expect(
          animationCount,
          `${app.name}: game UI must not degrade into a form; motion feedback should outnumber text-entry controls`,
        ).toBeGreaterThanOrEqual(Math.max(8, formControlCount * 3));
        expect(
          keyframeCount,
          `${app.name}: button-heavy game flows need enough bespoke motion to feel playable instead of questionnaire-like`,
        ).toBeGreaterThanOrEqual(buttonCount);
        expect(
          source,
          `${app.name}: motion must be tied to the core play action, not only ambient decoration`,
        ).toMatch(INTERACTION_MOTION_PATTERN);
        expect(
          source,
          `${app.name}: motion-heavy game UI must honor reduced-motion users`,
        ).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
      } else {
        // v2 apps consume the shared kit (which carries the keyframes, animations,
        // and the reduced-motion override). They must still tie motion to the play
        // action and resolve an outcome — the intent of the two pattern checks.
        expect(
          source,
          `${app.name}: motion must be tied to the core play action, not only ambient decoration`,
        ).toMatch(INTERACTION_MOTION_PATTERN);
        expect(
          source,
          `${app.name}: games need a resolved outcome/receipt/history state after the action`,
        ).toMatch(RESULT_STATE_PATTERN);
      }
      expect(
        source,
        `${app.name}: games need a resolved outcome/receipt/history state after the action`,
      ).toMatch(RESULT_STATE_PATTERN);
    });
  }

  it("keeps TEE reward-game starts gated by the available reward pool", () => {
    for (const appName of TEE_REWARD_GAMES) {
      const playArea = readFileSync(path.join(APPS_DIR, appName, "src", "PlayArea.tsx"), "utf8");
      expect(playArea, `${appName}: start controls need a shared reward-pool readiness flag`).toMatch(
        /rewardPoolReady/,
      );
      if (appName === "color-clash") {
        expect(playArea, `${appName}: low-pool starts should fall back to playable practice`).toMatch(
          /practiceAction/,
        );
        expect(playArea, `${appName}: practice fallback must not dispatch a paid game start`).toMatch(
          /startPractice\(startDifficulty\)/,
        );
        continue;
      }
      expect(playArea, `${appName}: reward-pool failures need a user-facing status`).toMatch(
        /statusPoolLow/,
      );
      expect(playArea, `${appName}: primary start action must be disabled when the pool is low`).toMatch(
        /disabled:\s*[^,\n]*(?:\|\|\s*)?!rewardPoolReady|disabled=\{[^}]*!rewardPoolReady/,
      );
      expect(playArea, `${appName}: start dispatch must be guarded by rewardPoolReady`).toMatch(
        /if\s*\(\s*!rewardPoolReady\s*\)\s*return;[\s\S]{0,220}(?:dispatch\("startGame"|actions\.startGame)/,
      );
    }
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const PHASER_GAMES = [
  { app: "aim-master", scene: "AimMasterScene.ts" },
  { app: "arrow-escape", scene: "ArrowEscapeScene.ts" },
  { app: "bead-workshop", scene: "BeadWorkshopScene.ts" },
  { app: "burn-league", scene: "BurnLeagueScene.ts" },
  { app: "color-clash", scene: "ColorClashScene.ts" },
  { app: "curve-arrow", scene: "CurveArrowScene.ts" },
  { app: "dice-game", scene: "DiceScene.ts" },
  { app: "flappy-dash", scene: "FlappyScene.ts" },
  { app: "fogplay", scene: "FogplayScene.ts" },
  { app: "fruit-funnel", scene: "FruitFunnelScene.ts" },
  { app: "game-2048", scene: "Game2048Scene.ts" },
  { app: "gas-lucky-pool", scene: "GasLuckyPoolScene.ts" },
  { app: "jump-rush", scene: "JumpRushScene.ts" },
  { app: "last-survivor", scene: "LastSurvivorScene.ts" },
  { app: "merge-kingdom", scene: "MergeKingdomScene.ts" },
  { app: "on-chain-tarot", scene: "TarotScene.ts" },
  { app: "pet-potion", scene: "PetPotionScene.ts" },
  { app: "red-envelope", scene: "RedEnvelopeScene.ts" },
  { app: "screw-sort", scene: "ScrewSortScene.ts" },
  { app: "sheep-solitaire", scene: "SheepScene.ts" },
  { app: "snake-bounty", scene: "SnakeScene.ts" },
  { app: "sudoku", scene: "SudokuScene.ts" },
] as const;

function readScene(app: string, scene: string): string {
  return readFileSync(resolve(repoRoot, "apps", app, "src", "scenes", scene), "utf8");
}

describe("Phaser game scene polish adoption", () => {
  it.each(PHASER_GAMES)("$app keeps real game animation in its Phaser scene", ({ app, scene }) => {
    const source = readScene(app, scene);

    expect(source).toMatch(/extends\s+BaseScene/);
    expect(source).toMatch(/\b(?:this\.)?(?:animate|tween|tweens\.add|tweens\.addCounter|anims\.)\b/);
  });

  it.each(PHASER_GAMES)("$app keeps game sound feedback in its Phaser scene", ({ app, scene }) => {
    const source = readScene(app, scene);

    expect(source).toMatch(/\b(?:playSfx|sfx\.play|sfx\.tones|this\.sound|sound\.add)\b/);
  });
});

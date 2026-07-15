import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const PHASER_GAMES = [
  ["aim-master", "AimMasterScene.ts"],
  ["burn-league", "BurnLeagueScene.ts"],
  ["color-clash", "ColorClashScene.ts"],
  ["dice-game", "DiceScene.ts"],
  ["flappy-dash", "FlappyScene.ts"],
  ["fogplay", "FogplayScene.ts"],
  ["game-2048", "Game2048Scene.ts"],
  ["gas-lucky-pool", "GasLuckyPoolScene.ts"],
  ["jump-rush", "JumpRushScene.ts"],
  ["last-survivor", "LastSurvivorScene.ts"],
  ["merge-kingdom", "MergeKingdomScene.ts"],
  ["on-chain-tarot", "TarotScene.ts"],
  ["pet-potion", "PetPotionScene.ts"],
  ["red-envelope", "RedEnvelopeScene.ts"],
  ["sheep-solitaire", "SheepScene.ts"],
  ["snake-bounty", "SnakeScene.ts"],
  ["sudoku", "SudokuScene.ts"],
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

test("the 17-game production suite stays on the shared Phaser 3 runtime", () => {
  for (const [slug, sceneFile] of PHASER_GAMES) {
    const main = read(`apps/${slug}/src/main.tsx`);
    const wrapper = read(`apps/${slug}/src/PhaserPlayArea.tsx`);
    const scenePath = `apps/${slug}/src/scenes/${sceneFile}`;
    const scene = read(scenePath);

    assert.match(main, /import PhaserPlayArea from "\.\/PhaserPlayArea"/, `${slug} entry`);
    assert.match(main, /playArea:\s*PhaserPlayArea/, `${slug} runtime`);
    assert.match(
      wrapper,
      /LazyPhaserGameComponent as PhaserGameComponent/,
      `${slug} lazy Phaser host`,
    );
    assert.match(wrapper, /loadScene=\{load[A-Za-z0-9]+Scene\}/, `${slug} lazy scene`);
    assert.match(wrapper, /category="game"/, `${slug} game stage`);
    assert.match(scene, /\bPhaser\b/, `${slug} Phaser scene import`);
    assert.match(scene, /extends BaseScene/, `${slug} shared BaseScene`);

    const appSource = sourceFiles(path.join(ROOT, `apps/${slug}/src`))
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    assert.doesNotMatch(
      appSource,
      /(?:from\s+["']three["']|import\s*\(\s*["']three["']\s*\)|@react-three)/,
      `${slug} should not pull a second rendering engine into its 2D game bundle`,
    );
  }
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../apps");

const standardRewardGames = [
  "aim-master",
  "color-clash",
  "curve-arrow",
  "flappy-dash",
  "game-2048",
  "jump-rush",
  "merge-kingdom",
  "pet-potion",
  "sheep-solitaire",
  "snake-bounty",
  "sudoku",
] as const;

describe("standard reward-game rule adoption", () => {
  it("uses the framework difficulty selector without erasing game-specific rules", () => {
    for (const appId of standardRewardGames) {
      const source = readFileSync(
        resolve(appsRoot, appId, "src/logic/game-rules.ts"),
        "utf8",
      );

      expect(source, `${appId} should use the shared difficulty selector`).toContain(
        "createDifficultyRuleSelector",
      );
      expect(source, `${appId} should export the shared selector`).toMatch(
        /export const ruleOf = createDifficultyRuleSelector\(/,
      );
      expect(source, `${appId} should not redeclare the selector body`).not.toMatch(
        /export function ruleOf\(/,
      );
    }
  });
});

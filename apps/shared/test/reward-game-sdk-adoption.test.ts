import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

const genericRewardGames = [
  "aim-master",
  "color-clash",
  "flappy-dash",
  "game-2048",
  "merge-kingdom",
  "pet-potion",
  "snake-bounty",
  "sudoku",
] as const;

describe("reward-game SDK adoption", () => {
  it("routes generic Morpheus reward games through @framework/gamefi", () => {
    for (const appId of genericRewardGames) {
      const source = readFileSync(resolve(root, appId, "src/main.tsx"), "utf8");

      expect(source, `${appId} should import the framework reward-game SDK`).toContain(
        `from "@framework/gamefi"`,
      );
      expect(source, `${appId} should not call the low-level TEE client directly`).not.toContain(
        `@framework/logic/tee-session`,
      );
      expect(source, `${appId} should use SDK storage instead of local op-log helpers`).not.toMatch(
        /function (loadOps|saveOps|forgetOps)\b/,
      );
      expect(source, `${appId} should use SDK start transaction orchestration`).toContain(
        "startRewardGame(",
      );
      expect(source, `${appId} should use SDK finalize settlement orchestration`).toContain(
        "finalizeRewardGame(",
      );
    }
  });
});

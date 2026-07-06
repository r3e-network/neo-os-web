import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatBridgeError,
  GameBridge,
  type GameBridgeError,
} from "@framework/phaser/GameBridge";

const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..");

describe("root Phaser framework", () => {
  it("surfaces rejected game dispatches as bridge errors", async () => {
    const bridge = new GameBridge();
    const errors: GameBridgeError[] = [];

    bridge.setDispatch(async () => {
      throw new Error("wallet rejected");
    });
    bridge.on("error", (error) => errors.push(error));

    bridge.dispatch("placeBet", { amount: "1" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      source: "dispatch",
      action: "placeBet",
      message: "wallet rejected",
    });
    expect(errors[0]?.args).toEqual([{ amount: "1" }]);
  });

  it("surfaces synchronous dispatch failures without throwing into Phaser", () => {
    const bridge = new GameBridge();
    const errors: GameBridgeError[] = [];

    bridge.setDispatch(() => {
      throw "bridge offline";
    });
    bridge.on("error", (error) => errors.push(error));

    expect(() => bridge.dispatch("draw")).not.toThrow();
    expect(errors[0]).toMatchObject({
      source: "dispatch",
      action: "draw",
      message: "bridge offline",
    });
  });

  it("normalizes unknown errors into a product-safe fallback", () => {
    expect(formatBridgeError({})).toBe("The game action could not be completed.");
  });

  it("centralizes in-canvas game button motion in the root framework", () => {
    const baseScene = readFileSync(resolve(repoRoot, "framework/phaser/BaseScene.ts"), "utf8");
    const diceScene = readFileSync(
      resolve(repoRoot, "apps/dice-game/src/scenes/DiceScene.ts"),
      "utf8",
    );
    const tarotScene = readFileSync(
      resolve(repoRoot, "apps/on-chain-tarot/src/scenes/TarotScene.ts"),
      "utf8",
    );
    const migratedScenes = [
      "burn-league",
      "color-clash",
      "fogplay",
      "pet-potion",
      "red-envelope",
    ].map((app) =>
      readFileSync(resolve(repoRoot, `apps/${app}/src/scenes`, `${toSceneName(app)}.ts`), "utf8"),
    );

    expect(baseScene).toContain("protected bindGameButton");
    expect(baseScene).toContain("protected pressFeedback");
    expect(baseScene).toContain("prefers-reduced-motion");
    expect(diceScene.match(/this\.bindGameButton/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(tarotScene.match(/this\.bindGameButton/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    for (const scene of migratedScenes) {
      expect(scene).toContain("this.bindGameButton");
    }
  });
});

function toSceneName(app: string): string {
  const names: Record<string, string> = {
    "burn-league": "BurnLeagueScene",
    "color-clash": "ColorClashScene",
    fogplay: "FogplayScene",
    "pet-potion": "PetPotionScene",
    "red-envelope": "RedEnvelopeScene",
  };
  return names[app]!;
}

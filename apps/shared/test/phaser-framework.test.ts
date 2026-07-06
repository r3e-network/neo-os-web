import { describe, expect, it } from "vitest";
import {
  formatBridgeError,
  GameBridge,
  type GameBridgeError,
} from "@framework/phaser/GameBridge";

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
});

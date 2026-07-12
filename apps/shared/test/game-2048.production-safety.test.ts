import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { manifest } from "../../game-2048/src/manifest";

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

function source(relative: string): string {
  return fs.readFileSync(path.join(appsRoot(), "game-2048", relative), "utf8");
}

describe("game-2048 production trust boundary", () => {
  it("publishes the verified local game without exposing an unvalidated paid lane", () => {
    expect(manifest.gamePage?.modes).toEqual({ guest: true, gamefi: false });
    expect(manifest.supportsGuest).toBe(true);
    expect(manifest.supportsGameFi).toBe(false);
    expect(manifest.operations).toEqual([]);
    expect(manifest.features?.walletRequired).toBe(false);
    expect(manifest.permissions).toEqual({
      payments: false,
      randomness: false,
      compute: false,
      confidential: false,
      oracle: false,
    });

    const published = JSON.parse(source("neo-manifest.json")) as {
      permissions?: string[];
      platform?: { transactions?: boolean };
      technologies?: {
        oracle?: { enabled?: boolean };
        tee?: { enabled?: boolean };
      };
    };
    expect(published.permissions).toEqual([]);
    expect(published.platform?.transactions).toBe(false);
    expect(published.technologies?.oracle?.enabled).toBe(false);
    expect(published.technologies?.tee?.enabled).toBe(false);
  });

  it("keeps a guest board and profile recoverable across reloads", () => {
    const guest = source("src/logic/guest-engine.ts");

    expect(guest).toContain('GUEST_PROFILE_KEY = "guest:2048:profile:v1"');
    expect(guest).toContain('GUEST_RUN_KEY = "guest:2048:active-run:v1"');
    expect(guest).toContain("saveActiveRun()");
    expect(guest).toContain("restoreActiveRun()");
    expect(guest).toContain("saveProfile()");
    expect(guest).toContain("obs.undosUsed.set(obs.undosUsed.get() + 1)");
    expect(guest).toContain("obs.undosUsed.get() >= MAX_UNDOS");
  });

  it("does not treat expiry broadcast or wallet response as final confirmation", () => {
    const main = source("src/main.tsx");
    const expiryBlock = main.slice(
      main.indexOf('app.actions.register("expireGame"'),
      main.indexOf('const withdrawOp = app.operations.create("withdrawWinnings")'),
    );
    const withdrawBlock = main.slice(
      main.indexOf('app.actions.register("withdrawWinnings"'),
      main.indexOf('app.actions.register("refreshLeaderboard"'),
    );

    expect(expiryBlock).toContain("await rewardGame.snapshot(gameId)");
    expect(expiryBlock).toContain('obs.gameStatus.set("unknown")');
    expect(expiryBlock).not.toContain('obs.activeGameId.set("0")');
    expect(withdrawBlock).toContain("const before = await rewardGame.balances(playerHash)");
    expect(withdrawBlock).toContain("result.tx.event != null");
    expect(withdrawBlock).toContain("const after = await rewardGame.balances(playerHash)");
    expect(withdrawBlock).toContain("after.creditFixed8 !== 0n");
  });
});

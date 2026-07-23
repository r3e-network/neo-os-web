import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function sheepContractMethods(): string[] {
  const manifest = JSON.parse(read("contracts/build/MiniAppSheepSolitaire.manifest.json")) as {
    abi?: { methods?: Array<{ name?: string }> };
  };
  return (manifest.abi?.methods ?? []).map((method) => String(method.name ?? ""));
}

describe("sheep-solitaire contract compatibility", () => {
  it("routes the frontend through PlatformGame instead of the legacy Sheep ABI", () => {
    const methods = sheepContractMethods();
    const main = read("apps/sheep-solitaire/src/main.tsx");

    expect(methods).toContain("bindPuzzle");
    expect(methods).toContain("settleVerified");
    expect(methods).not.toContain("finalizeGame");

    expect(main).toContain("app.game.reward<SheepSessionOp>");
    expect(main).toContain("rewardGame.openSession");
    expect(main).toContain("rewardGame.finalize");
    expect(main).toContain("app.platformGame.getGame");
    expect(main).not.toContain("bindPuzzle");
    expect(main).not.toContain("settleVerified");
    expect(main).not.toContain("app.chain.invoke(");
    expect(main).not.toContain("app.chain.invokeWithPayment(");
  });
});

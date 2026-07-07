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
  it("keeps the frontend settlement flow aligned with the deployed Sheep contract ABI", () => {
    const methods = sheepContractMethods();
    const main = read("apps/sheep-solitaire/src/main.tsx");

    expect(methods).toContain("bindPuzzle");
    expect(methods).toContain("settleVerified");
    expect(methods).not.toContain("finalizeGame");

    expect(main).toContain(`from "./logic/tee-session"`);
    expect(main).toContain("teeStart");
    expect(main).toContain("teeMove");
    expect(main).toContain("teeFinalize");
    expect(main).toContain("started.bindSignature");
    expect(main).toContain(`"settleVerified"`);
    expect(main).toContain("settlement.settleSignature");
    expect(main).not.toContain(`from "@framework/logic/tee-session"`);
    expect(main).not.toContain("teeSessionSealOpLog");
    expect(main).not.toContain(`"finalizeGame"`);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const appsRoot = path.resolve(process.cwd(), "..");

function manifest(slug: string) {
  return JSON.parse(
    readFileSync(path.join(appsRoot, slug, "neo-manifest.json"), "utf8"),
  ) as {
    features?: { stateless?: boolean };
  };
}

describe("stateful MiniApp manifest truth", () => {
  it.each([
    "automation-copilot",
    "burn-league",
    "council-governance",
    "dev-tipping",
    "dice-game",
    "forever-album",
    "graveyard",
    "last-survivor",
    "memorial-shrine",
    "neo-message",
    "neo-pay",
    "neo-swap",
    "neo-x-bridge",
    "on-chain-tarot",
    "oracle-seal-console",
    "red-envelope",
    "self-loan",
    "time-capsule",
  ])("marks %s stateful when it persists progress or transaction recovery", (slug) => {
    expect(manifest(slug).features?.stateless).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const keep = new Set([
  "AppRegistry",
  "AutomationAnchor",
  "PauseRegistry",
  "PaymentHub",
  "PriceFeed",
  "RandomnessLog",
  "ServiceLayerGateway",
  "UniversalMiniApp",
]);

const ignore = new Set(["__tests__", "build", "build_single", "cmd"]);

const entries = fs
  .readdirSync(path.resolve("contracts"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !name.startsWith("."))
  .filter((name) => !ignore.has(name));

describe("platform contracts", () => {
  it("only contains platform contracts", () => {
    const unexpected = entries.filter((name) => !keep.has(name));
    expect(unexpected).toEqual([]);
  });
});

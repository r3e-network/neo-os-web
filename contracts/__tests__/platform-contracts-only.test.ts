import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const requiredPlatformContracts = new Set([
  "AppRegistry",
  "AutomationAnchor",
  "Governance",
  "OracleService",
  "PauseRegistry",
  "PaymentHub",
  "PriceFeed",
  "RandomnessLog",
]);

const forbiddenLegacyContracts = new Set(["ServiceLayerGateway", "UniversalMiniApp"]);

const ignore = new Set(["__tests__", "build", "build_single", "cmd"]);

const entries = fs
  .readdirSync(path.resolve("contracts"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !name.startsWith("."))
  .filter((name) => !ignore.has(name));

describe("platform contracts", () => {
  it("contains the required platform contracts", () => {
    const missing = [...requiredPlatformContracts].filter((name) => !entries.includes(name));
    expect(missing).toEqual([]);
  });

  it("does not keep removed legacy platform contracts", () => {
    const present = [...forbiddenLegacyContracts].filter((name) => entries.includes(name));
    expect(present).toEqual([]);
  });
});

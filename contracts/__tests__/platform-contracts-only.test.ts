import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const requiredPlatformContracts = new Set([
  "PlatformAnchor",
  "PlatformDeFi",
  "PlatformGame",
  "PlatformSocial",
]);

const forbiddenLegacyContracts = new Set([
  "AppRegistry",
  "AutomationAnchor",
  "Governance",
  "OracleService",
  "PauseRegistry",
  "PriceFeed",
  "RandomnessLog",
  "ServiceLayerGateway",
  "UniversalMiniApp",
]);

const ignore = new Set(["__tests__", "build", "build_single", "cmd"]);

const rootEntries = fs
  .readdirSync(path.resolve("contracts"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !name.startsWith("."))
  .filter((name) => !ignore.has(name));

const platformEntries = fs
  .readdirSync(path.resolve("contracts", "platform"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !name.startsWith("."));

describe("platform contracts", () => {
  it("contains the required platform contracts", () => {
    const missing = [...requiredPlatformContracts].filter((name) => !platformEntries.includes(name));
    expect(missing).toEqual([]);
  });

  it("does not keep removed legacy platform contracts", () => {
    const present = [...forbiddenLegacyContracts].filter((name) => rootEntries.includes(name));
    expect(present).toEqual([]);
  });
});

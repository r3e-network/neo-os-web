import { describe, expect, it } from "vitest";

import sourceManifest from "../neo-manifest.json";
import { manifest } from "./manifest";

describe("On-Chain Tarot production maintenance gate", () => {
  it("keeps the polished local ritual available while GameFi is fail-closed", () => {
    expect(manifest.directPlay).toBe(true);
    expect(manifest.supportsGuest).toBe(true);
    expect(manifest.supportsGameFi).toBe(false);
    expect(manifest.features?.walletRequired).toBe(false);
    expect(manifest.features?.chainWarning).toBe(false);
    expect(manifest.permissions).toEqual({
      payments: false,
      randomness: false,
    });
    expect(manifest.description).toMatch(/local three-card tarot/i);
    expect(manifest.description).not.toMatch(/pay|stake|earn GAS/i);
  });

  it("removes wallet-funded operations from the published miniapp manifest", () => {
    expect(sourceManifest.operation_panel.operations).toEqual([]);
    expect("contracts" in sourceManifest).toBe(false);
    expect(sourceManifest.permissions).toEqual([]);
    expect(sourceManifest.permissions).not.toContain("invoke:primary");
    expect(sourceManifest.permissions).not.toContain("read:blockchain");
    expect(sourceManifest.platform.transactions).toBe(false);
    expect(sourceManifest.supported_networks).toEqual(["neo-n3-testnet"]);
    expect(sourceManifest.default_network).toBe("neo-n3-testnet");
    expect(sourceManifest.description).toMatch(/local three-card tarot/i);
    expect(sourceManifest.operation_panel.subtitle).toMatch(/remains disabled/i);
    expect(sourceManifest.technologies.oracle.enabled).toBe(false);
  });
});

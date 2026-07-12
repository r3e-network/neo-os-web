import { describe, expect, it } from "vitest";

import sourceManifest from "../neo-manifest.json";
import hostDefinition from "../../../platform/host-app/public/miniapp-definitions/dice-game.json";
import { manifest } from "./manifest";

describe("Dice Game production maintenance gate", () => {
  it("keeps the polished local game available while GameFi is fail-closed", () => {
    expect(manifest.supportsGuest).toBe(true);
    expect(manifest.supportsGameFi).toBe(false);
    expect(manifest.features?.walletRequired).toBe(false);
    expect(manifest.features?.chainWarning).toBe(false);
    expect(manifest.permissions).toEqual({ payments: false, randomness: false });
    expect(manifest.description).toMatch(/practice chip/i);
    expect(manifest.description).not.toMatch(/stake GAS/i);
  });

  it("removes wallet-funded operations from the source miniapp manifest", () => {
    expect(sourceManifest.operation_panel.operations).toEqual([]);
    expect(sourceManifest.permissions).not.toContain("invoke:primary");
    expect(sourceManifest.platform.transactions).toBe(false);
    expect(sourceManifest.description).toMatch(/local dice practice/i);
    expect(sourceManifest.operation_panel.subtitle).toMatch(/remain disabled/i);
  });

  it("keeps both host operation sources empty until a compatible deployment is bound", () => {
    expect(hostDefinition.operations).toEqual([]);
    expect(hostDefinition.frontend_spec.operation_panel.operations).toEqual([]);
    expect(hostDefinition.permissions).toEqual({
      payments: false,
      randomness: false,
    });
    expect(hostDefinition.description).toMatch(/GameFi is temporarily unavailable/i);
    expect(hostDefinition.frontend_spec.operation_panel.subtitle).toMatch(
      /remain disabled/i,
    );
  });
});

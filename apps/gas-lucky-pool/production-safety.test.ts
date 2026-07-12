import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(file: string): string {
  return readFileSync(resolve(process.cwd(), file), "utf8");
}

describe("Gas Lucky Pool production gates", () => {
  it("publishes only the verified local lane", () => {
    const runtimeManifest = read("src/manifest.ts");
    const main = read("src/main.tsx");
    const composable = read("src/composables/useGasLuckyPool.ts");
    const publicManifest = JSON.parse(read("neo-manifest.json")) as {
      contracts: Record<string, string>;
      operation_panel: { operations: unknown[] };
      permissions: unknown[];
      platform: { transactions: boolean };
      technologies: { vrf: { enabled: boolean } };
    };

    expect(runtimeManifest).toContain("supportsGuest: true");
    expect(runtimeManifest).toContain("supportsGameFi: false");
    expect(runtimeManifest).toContain("payments: false");
    expect(runtimeManifest).toContain("randomness: false");
    expect(main).toContain("export const GAS_LUCKY_GUEST_LOCAL_ENABLED = true");
    expect(main).toContain("export const GAS_LUCKY_ONEGATE_CLAIM_ENABLED = false");
    expect(main).toContain("export const GAS_LUCKY_RANGE_POOL_ENABLED = false");
    expect(main).toContain("paidLaneEnabled: GAS_LUCKY_GAMEFI_ENABLED");
    expect(main).toContain("oneGateClaimEnabled: GAS_LUCKY_ONEGATE_CLAIM_ENABLED");
    expect(composable).toContain("paidLaneEnabled = false");
    expect(composable).toContain("oneGateClaimEnabled = false");
    expect(publicManifest.contracts).toEqual({});
    expect(publicManifest.operation_panel.operations).toEqual([]);
    expect(publicManifest.permissions).toEqual([]);
    expect(publicManifest.platform.transactions).toBe(false);
    expect(publicManifest.technologies.vrf.enabled).toBe(false);
  });

  it("keeps chance outcomes on Web Crypto and the visible surface on Phaser", () => {
    const guestEngine = read("src/logic/guest-engine.ts");
    const oneGate = read("src/composables/useGasLuckyPool.onegate.ts");
    const scene = read("src/scenes/GasLuckyPoolScene.ts");

    expect(guestEngine).toContain("secureRandomUnit");
    expect(guestEngine).toContain("secure-random-unavailable");
    expect(guestEngine).not.toMatch(/Math\.random\s*\(/);
    expect(oneGate).not.toMatch(/Math\.random\s*\(/);
    expect(read("src/PlayArea.tsx").trim()).toBe(
      'export { default } from "./PhaserPlayArea";',
    );
    expect(scene).toContain("officialGasTokenPhaserUrl");
    expect(scene).toContain('"./onegate-logo.webp"');
    expect(scene).toContain("playVaultReveal");
    expect(scene).toContain("protected onReducedMotionChange(enabled: boolean)");
  });
});

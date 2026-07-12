import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { manifest } from "./src/manifest";
import { FOGPLAY_PAID_LANE_ENABLED } from "./src/composables/useCoinFlip";

const appRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}fogplay`)
  ? process.cwd()
  : path.resolve(process.cwd(), "apps/fogplay");

describe("FogPlay production boundary", () => {
  it("keeps the designed guest lane active while the paid lane fails closed", () => {
    expect(manifest.supportsGuest).toBe(true);
    expect(manifest.supportsGameFi).toBe(false);
    expect(manifest.gamePage?.modes).toEqual({ guest: true, gamefi: false });
    expect(manifest.operations ?? []).toEqual([]);
    expect(manifest.features?.walletRequired).toBe(false);
    expect(manifest.permissions).toEqual({ payments: false, randomness: false });
    expect(FOGPLAY_PAID_LANE_ENABLED).toBe(false);
  });

  it("publishes no wallet-funded lane or generic operation form", () => {
    const published = JSON.parse(
      fs.readFileSync(path.join(appRoot, "neo-manifest.json"), "utf8"),
    ) as {
      contracts?: Record<string, string>;
      default_network?: string;
      operation_panel?: { operations?: unknown[] };
      permissions?: string[];
      platform?: { transactions?: boolean };
      runtime?: unknown;
      supported_networks?: string[];
    };

    expect(published.contracts).toEqual({
      "neo-n3-mainnet": "0x611c3d97dd98792a3c31a0e695704c657f143cda",
      "neo-n3-testnet": "0x611c3d97dd98792a3c31a0e695704c657f143cda",
    });
    expect(published.supported_networks).toEqual(["neo-n3-testnet"]);
    expect(published.default_network).toBe("neo-n3-testnet");
    expect(published.operation_panel?.operations).toEqual([]);
    expect(published.permissions).toEqual(["read:blockchain"]);
    expect(published.platform?.transactions).toBe(false);
    expect(published.runtime).toBeUndefined();

    const host = JSON.parse(
      fs.readFileSync(
        path.resolve(
          appRoot,
          "../../platform/host-app/public/miniapp-definitions/fogplay.json",
        ),
        "utf8",
      ),
    ) as {
      operations?: unknown[];
      permissions?: { payments?: boolean; randomness?: boolean };
    };
    expect(host.operations).toEqual([]);
    expect(host.permissions).toEqual({ payments: false, randomness: false });
  });

  it("guards every retained paid mutation behind the disabled compatibility gate", () => {
    const source = fs.readFileSync(
      path.join(appRoot, "src/composables/useCoinFlip.ts"),
      "utf8",
    );

    expect(source).toContain("if (!paidLaneEnabled)");
    expect(source).toContain('normalizedNetwork(network) === "neo-n3-testnet"');
    expect(source).toContain("sameHash(contract, FOGPLAY_TESTNET_CONTRACT)");
    expect(source).toContain("const network = await assertPaidRuntime()");
    expect(source.indexOf("const network = await assertPaidRuntime()")).toBeLessThan(
      source.indexOf("await app.chain.ensureWallet()"),
    );
    expect(source).toContain("await assertPaidRuntime();\n    const storedBet = pendingBet.get()");
    expect(source).toContain("await assertPaidRuntime();\n    const playerAddr = address.get()");

    const main = fs.readFileSync(path.join(appRoot, "src/main.tsx"), "utf8");
    expect(main).not.toContain("paidLaneEnabled:");
  });

  it("never treats a settle event or transaction broadcast as the result", () => {
    const source = fs.readFileSync(
      path.join(appRoot, "src/composables/useCoinFlip.ts"),
      "utf8",
    );

    expect(source).toContain('readRaw("getPendingBet"');
    expect(source).toContain("waitForCanonicalSettlement");
    expect(source).toContain("payoutBase !== expectedPayout");
    expect(source).not.toContain("return applyVerifiedSettlement(\n            bet,\n            eventValue");
  });
});

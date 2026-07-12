import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const app = path.join(root, "apps/breakup-contract");
const read = (name: string) => readFileSync(path.join(app, name), "utf8");

describe("breakup-contract production truth", () => {
  it("publishes the independently verified dual-network binding", () => {
    const manifest = JSON.parse(read("neo-manifest.json")) as {
      version: string;
      contracts: Record<string, string>;
      deployment: Record<string, { status: string; verified_at: string; reason: string }>;
      features: { stateless: boolean };
      operation_panel: { operations: unknown[] };
      permissions: string[];
      platform: { transactions: boolean };
    };
    const packageJson = JSON.parse(read("package.json")) as { version: string };
    const expected = "0xf6769c080395f15c28013108b7af7631e1665336";

    expect(manifest.version).toBe(packageJson.version);
    expect(manifest.contracts["neo-n3-mainnet"]).toBe(expected);
    expect(manifest.contracts["neo-n3-testnet"]).toBe(expected);
    expect(manifest.deployment["neo-n3-mainnet"]).toMatchObject({
      status: "deployed",
      verified_at: "2026-07-12T00:00:00Z",
    });
    expect(manifest.deployment["neo-n3-testnet"]).toMatchObject({
      status: "deployed",
      verified_at: "2026-07-12T00:00:00Z",
    });
    expect(manifest.deployment["neo-n3-mainnet"].reason).toContain("2044887039");
    expect(manifest.deployment["neo-n3-testnet"].reason).toContain("2044887039");
    expect(manifest.features.stateless).toBe(false);
    expect(manifest.operation_panel.operations).toEqual([]);
    expect(manifest.permissions).toEqual(expect.arrayContaining([
      "invoke:primary",
      "read:blockchain",
      "write:blockchain",
    ]));
    expect(manifest.platform.transactions).toBe(true);
  });

  it("ships the real pact-table resource and documentation without prototype rules", () => {
    const english = read("README.md");
    const chinese = read("README.zh-CN.md");

    expect(existsSync(path.join(app, "public/pact-table.webp"))).toBe(true);
    expect(english).toContain("pull payments");
    expect(chinese).toContain("可提取额度");
    expect(`${english}\n${chinese}`).not.toMatch(/0xf7e2a268|0x7742a805/i);
    expect(english).not.toContain("## Milestone Rewards");
    expect(english).not.toContain("Amend Terms");
    expect(english).not.toContain("20% of initiator's stake");
    expect(read("NETWORK_STATUS.md")).toContain("2026-07-12");
    expect(read("PRODUCTION_STATUS.md")).toContain("exact target-contract event");
    expect(read("ASSET_PROVENANCE.md")).toContain("1b045d0fdfa12721f0aaad3d910685a1754b192026da062bfd334ef32fcbb26f");
  });

  it("keeps broadcast recovery authoritative and the product surface focused", () => {
    const hook = read("src/composables/useBreakup.ts");
    const safety = read("src/composables/breakupSafety.ts");
    const playArea = read("src/PlayArea.tsx");

    expect(hook).toContain("onTransactionSent: persist");
    expect(hook).toContain("classifyBreakupConfirmation");
    expect(hook).toContain("lastPactIdUnavailable");
    expect(hook).not.toMatch(/PENDING_STALE_MS|pendingClearedForRetry|verified === true/);
    expect(safety).toContain('method: "getapplicationlog"');
    expect(safety).toContain('version: 2');
    expect(playArea).toContain("@shared/components-react/v2/OpenUiLite");
    expect(playArea).toContain("@shared/components-react/v2/PlayStage");
    expect(playArea).not.toContain('from "@shared/components-react/v2"');
    expect(playArea).not.toMatch(/actionPreview|useTransientFlag|setTimeout\(/);
    expect(playArea).not.toMatch(/secondary:\s*\[/);
  });
});

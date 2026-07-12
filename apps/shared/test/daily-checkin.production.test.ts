import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.resolve(process.cwd(), "../daily-checkin");
const CONTRACT = "0x25db219a701a2b23130788723fcf9a2e76857235";

function read(relativePath: string): string {
  return readFileSync(path.join(APP, relativePath), "utf8");
}

describe("Daily Check-in published production truth", () => {
  it("publishes the verified dual-network deployment and durable state model", () => {
    const manifest = JSON.parse(read("neo-manifest.json")) as {
      version: string;
      contracts: Record<string, string>;
      deployment: Record<string, { status: string; contract_hash: string; reason: string }>;
      permissions: string[];
      features: { stateless: boolean };
      stateSource: { type: string; endpoints: string[] };
      operation_panel: { operations: unknown[]; subtitle: string };
    };
    const packageJson = JSON.parse(read("package.json")) as { version: string };

    expect(manifest.version).toBe(packageJson.version);
    expect(manifest.contracts).toEqual({
      "neo-n3-mainnet": CONTRACT,
      "neo-n3-testnet": CONTRACT,
    });
    expect(manifest.deployment["neo-n3-mainnet"]).toMatchObject({
      status: "deployed",
      contract_hash: CONTRACT,
    });
    expect(manifest.deployment["neo-n3-testnet"]).toMatchObject({
      status: "deployed",
      contract_hash: CONTRACT,
    });
    expect(manifest.deployment["neo-n3-mainnet"].reason).toContain("170189676");
    expect(manifest.deployment["neo-n3-testnet"].reason).toContain("1.001 GAS");
    expect(manifest.permissions).toEqual(expect.arrayContaining([
      "invoke:primary",
      "read:blockchain",
      "write:blockchain",
    ]));
    expect(manifest.permissions).not.toContain("invoke:shared-runtime");
    expect(manifest.features.stateless).toBe(false);
    expect(manifest.stateSource).toEqual({
      type: "n3index",
      chain: "neo-n3-mainnet",
      endpoints: ["https://api.n3index.dev"],
    });
    expect(manifest.operation_panel.operations).toEqual([]);
    expect(manifest.operation_panel.subtitle).toContain("designed streak ritual");
  });

  it("documents the real 0.001 / 0.01 / 0.02 GAS lifecycle in both languages", () => {
    const docs = `${read("README.md")}\n${read("README.zh-CN.md")}\n${read("NETWORK_STATUS.md")}`;

    expect(docs).toContain("0.001 GAS");
    expect(docs).toContain("0.01 GAS");
    expect(docs).toContain("0.02 GAS");
    expect(docs).toContain("CheckedIn(user, streak, reward)");
    expect(docs).toContain("RewardsClaimed(user, amount)");
    expect(docs).toContain("event and chain readback");
    expect(docs).toContain("事件与合约回读");
    expect(docs).toContain("No later reward milestone is currently configured");
    expect(docs).not.toMatch(/earn 1 GAS|获得 1 GAS|earn 2 GAS|获得 2 GAS/i);
    expect(docs).not.toMatch(/NFT badge|NFT 徽章/i);
    expect(docs).not.toContain("platform OS services");
  });

  it("never equates intent or broadcast with success in the runtime", () => {
    const composable = read("src/composables/useCheckin.ts");
    const safety = read("src/daily-checkin-safety.ts");
    const main = read("src/main.tsx");

    expect(composable).toContain("onTransactionSent");
    expect(composable).toContain("pendingOperation");
    expect(composable).toContain("findDailyCheckinNotification");
    expect(composable).toContain("transferMatches");
    expect(composable).toContain("confirmReadback");
    expect(composable).toContain("pendingContextMatches");
    expect(composable).not.toContain("waitForEvent");
    expect(safety).toContain('method: "getapplicationlog"');
    expect(safety).toContain('state: "fault"');
    expect(main).not.toMatch(/successKey:\s*"checkinSuccess"|successKey:\s*"claimSuccess"/);
  });

  it("keeps failed reads unavailable and secondary technical detail out of the ritual", () => {
    const composable = read("src/composables/useCheckin.ts");
    const playArea = read("src/PlayArea.tsx");

    expect(composable).toContain('const formattedCurrentStreak = derived(');
    expect(composable).toContain('hasLoadedStatus.get() ?');
    expect(composable).toContain('dataSource.set("partial")');
    expect(composable).toContain('dataSource.set("failed")');
    expect(playArea).toContain('className="dci-plaza"');
    expect(playArea).toContain('className="dci-console"');
    expect(playArea).toContain('className="dci-drawer"');
    expect(playArea).not.toContain("OpenUiTextField");
    expect(playArea).not.toContain("checkin-scene-art");
  });
});

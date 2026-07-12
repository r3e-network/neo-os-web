import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(__dirname, "../../explorer");
const read = (path: string) => readFileSync(resolve(appRoot, path), "utf8");

describe("Explorer production contract", () => {
  it("declares a read-only Mainnet/Testnet product without a fake app contract", () => {
    const manifest = JSON.parse(read("neo-manifest.json")) as Record<string, unknown>;
    const packageJson = JSON.parse(read("package.json")) as Record<string, unknown>;
    expect(manifest.version).toBe(packageJson.version);
    expect(manifest.contracts).toEqual({});
    expect(manifest.supported_networks).toEqual(["neo-n3-mainnet", "neo-n3-testnet"]);
    expect(manifest.permissions).toEqual(["read:blockchain"]);
    expect(manifest.platform).toMatchObject({ transactions: false });
    expect(manifest).not.toHaveProperty("operation_panel");
    expect(read("src/manifest.ts")).not.toContain("mode: \"custom\"");
    expect(read("README.md")).toContain("No wallet connection, signature, payment, or miniapp contract is required");
    expect(read("README.md")).toContain("does not add a second host-generated parameter form");
  });

  it("renders real API-shaped records instead of a generic scanner status", () => {
    const playArea = read("src/PlayArea.tsx");
    expect(playArea).toContain("resultFields(result");
    expect(playArea).toContain("data.vm_state");
    expect(playArea).toContain("data.previousblockhash");
    expect(playArea).toContain("result.transactions.slice(0, 3)");
    expect(playArea).toContain("manifest.name");
    expect(playArea).toContain("safeJson(searchResult)");
    expect(playArea).not.toContain("explorer-network-orbit");
    expect(playArea).not.toContain("explorer-scanner__lens");
  });

  it("keeps RPC, indexer, cache, network, and recovery states explicit", () => {
    const logic = read("src/composables/useExplorer.ts");
    expect(logic).toContain('txCountSource: "indexer" | "unavailable"');
    expect(logic).toContain('statsStatus.set("cached")');
    expect(logic).toContain('statsStatus.set("live")');
    expect(logic).toContain('searchResult.set({ type: "unavailable"');
    expect(logic).toContain("generation !== searchGeneration");
    expect(logic).toContain("queuedTxReload = true");
    expect(logic).toContain("classifyExplorerQuery(query)");
  });

  it("uses repository artwork with recorded provenance and no CSS-drawn illustration", () => {
    const playArea = read("src/PlayArea.tsx");
    const styles = read("src/PlayArea.scss");
    const provenance = read("ASSET_PROVENANCE.md");
    expect(playArea).toContain('EXPLORER_BANNER_ART = "banner.webp"');
    expect(provenance).toContain("1f795d8298e311c38b2148d20e733ed8442ab543a79c71ac05c2df4543e29485");
    expect(provenance).toContain("does not copy assets from `IcedSoul/minigame-everyday`");
    expect(styles).not.toContain("explorer-network-orbit");
    expect(styles).not.toContain("explorer-scanner__lens");
    expect(styles).not.toContain("backdrop-filter");
  });

  it("documents the exact production source and acceptance boundary", () => {
    expect(read("NETWORK_STATUS.md")).toContain("Indexer, with Neo N3 RPC fallback");
    expect(read("PRODUCTION_STATUS.md")).toContain("visual browser sign-off is not claimed");
    expect(read("README.zh-CN.md")).toContain("缓存数据会明确标记为缓存快照");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { manifest } from "../../aim-master/src/manifest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");
const PLATFORM_REGISTRY_TESTNET = "0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b";
const PLATFORM_GAME_TESTNET = "0xc75b181b4561462903bb27d8d9e0b32b637bec12";

describe("aim-master production safety", () => {
  it("keeps paid entry closed in runtime and both public manifests", () => {
    const main = read("apps/aim-master/src/main.tsx");
    const neo = JSON.parse(read("apps/aim-master/neo-manifest.json")) as {
      contracts?: Record<string, string>;
      moduleId?: string;
      mode?: string;
      registry?: string;
      engine?: string;
      operation_panel: { operations: unknown[] };
      permissions: unknown[];
      platform: { transactions: boolean };
      technologies: { oracle: { enabled: boolean }; tee: { enabled: boolean } };
    };

    expect(main).toContain("export const NEW_PAID_RUNS_ENABLED = false");
    expect(main).toContain("if (!NEW_PAID_RUNS_ENABLED)");
    expect(manifest.supportsGuest).toBe(true);
    expect(manifest.supportsGameFi).toBe(false);
    expect(manifest.gamePage?.modes).toEqual({ guest: true, gamefi: false });
    expect(manifest.operations).toEqual([]);
    expect(manifest.permissions).toEqual({
      payments: false,
      randomness: false,
      compute: false,
      oracle: false,
    });
    expect(neo.contracts).toBeUndefined();
    expect(neo.moduleId).toBe("platform-game");
    expect(neo.mode).toBe("shared");
    expect(neo.registry).toBe(PLATFORM_REGISTRY_TESTNET);
    expect(neo.engine).toBe(PLATFORM_GAME_TESTNET);
    expect(neo.operation_panel.operations).toEqual([]);
    expect(neo.permissions).toEqual([]);
    expect(neo.platform.transactions).toBe(false);
    expect(neo.technologies.oracle.enabled).toBe(false);
    expect(neo.technologies.tee.enabled).toBe(false);
  });

  it("pins the reviewed testnet hash and exact local NEF checksum", () => {
    const main = read("apps/aim-master/src/main.tsx");
    const rpc = read("apps/aim-master/src/aim-master-rpc.ts");
    const nef = readFileSync(resolve(repoRoot, "contracts/build/MiniAppAimMaster.nef"));
    expect(rpc).toContain(
      'AIM_MASTER_TESTNET_CONTRACT = "0xed26866fb59219db8743c7673df098f363bac9ec"',
    );
    expect(rpc).toContain("AIM_MASTER_TESTNET_CHECKSUM = 422_251_087");
    expect(nef.readUInt32LE(nef.length - 4)).toBe(422251087);
    expect(main).toContain("contractBindingIsExact");
    expect(main).toContain("contractAttestationIsExact");
    expect(main).toContain("await contractAttestationIsExact()");
    expect(main).toContain('app.chain.readRaw("getConfig")');
    expect(main).toContain('app.chain.readRaw("oracle")');
    expect(main).toContain('app.chain.readRaw("networkMagic")');
    expect(main).toContain('app.chain.readRaw("isPaused")');
    expect(main).toContain('app.chain.readRaw("freePool")');
    expect(main).toContain("ORACLE_CONTRACT_TESTNET");
    expect(main).toContain("TESTNET_MAGIC");
    expect(main).toContain("sessionMatchesRule");
  });

  it("retains the exact ABI needed for start, recovery, settlement, and withdrawal", () => {
    const contractManifest = JSON.parse(
      read("contracts/build/MiniAppAimMaster.manifest.json"),
    ) as {
      name: string;
      extra?: { Version?: string };
      abi: {
        methods: Array<{ name: string; parameters: Array<{ type: string }> }>;
        events: Array<{ name: string; parameters: Array<{ type: string }> }>;
      };
    };
    const method = (name: string) => contractManifest.abi.methods.find((item) => item.name === name);
    const event = (name: string) => contractManifest.abi.events.find((item) => item.name === name);

    expect(contractManifest.name).toBe("MiniAppAimMaster");
    expect(contractManifest.extra?.Version).toBe("3.0.0");
    expect(method("startGame")?.parameters.map((item) => item.type)).toEqual(["Hash160", "Integer"]);
    expect(method("finalizeGame")?.parameters.map((item) => item.type)).toEqual(["Integer", "String"]);
    expect(method("getGame")?.parameters.map((item) => item.type)).toEqual(["Integer"]);
    expect(method("activeGameOf")?.parameters.map((item) => item.type)).toEqual(["Hash160"]);
    expect(method("withdraw")?.parameters.map((item) => item.type)).toEqual(["Hash160"]);
    expect(event("GameStarted")?.parameters.map((item) => item.type)).toEqual([
      "Integer", "Hash160", "Integer", "Integer", "Integer",
    ]);
    expect(event("Solved")?.parameters.map((item) => item.type)).toEqual([
      "Integer", "Hash160", "Integer", "Integer", "Integer", "Integer", "Integer",
    ]);
    expect(event("CreditWithdrawn")?.parameters.map((item) => item.type)).toEqual([
      "Hash160", "Integer",
    ]);
  });

  it("requires exact event/readback confirmation and keeps uncertain state recoverable", () => {
    const main = read("apps/aim-master/src/main.tsx");
    expect(main).toContain("startResultMatchesIntent");
    expect(main).toContain("gameMatchesIdentity");
    expect(main).toContain("await rewardGame.replayOps(started, storedOps)");
    expect(main).toContain("eventStateValue(event, 0)");
    expect(main).toContain('let submittedGameId = "0"');
    expect(main).toContain("const active = playerHash ? await readActiveGameId(playerHash)");
    expect(main).toContain("const recoverableId = active !== \"0\" ? active : submittedGameId");
    expect(main).toContain('settled.status === "unknown"');
    expect(main).toContain('obs.gameStatus.set("unknown")');
    expect(main).toContain("after.creditFixed8 !== 0n");
    expect(main).toContain("parseBigInt(eventStateValue(result.tx.event, 1)) === before.creditFixed8");
  });

  it("describes the actual oracle settlement sequence without claiming a start-time chain commitment", () => {
    const copy = read("apps/aim-master/src/locale/messages.ts");
    expect(copy).toContain("returns a SHA-256 session commitment before play");
    expect(copy).toContain("only the registered oracle can deliver the verified payload");
    expect(copy).toContain("the contract stores the commitment and answer hash");
    expect(copy).not.toContain("bound on-chain at the start");
    expect(copy).not.toContain("binds its hash commitment on-chain");
  });
});

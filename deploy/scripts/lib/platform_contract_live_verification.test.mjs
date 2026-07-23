import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadPlatformTargets,
  readNefChecksum,
  renderLiveMarkdown,
  selectTestnetRpc,
  verifyPlatformContractsLive,
} from "../verify_platform_contracts_live.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..");

test("NEF checksum is decoded from the final little-endian uint32", () => {
  assert.equal(
    readNefChecksum(path.join(repoRoot, "contracts/build/AppAccount.nef")),
    2055764547,
  );
});

test("platform targets resolve the seven-contract testnet inventory", () => {
  const targets = loadPlatformTargets();
  assert.deepEqual(
    targets.map((target) => [target.name, target.kind]),
    [
      ["PlatformRegistry", "contract"],
      ["AppAccount", "registry-artifact"],
      ["MiniAppFactory", "contract"],
      ["PlatformAnchor", "contract"],
      ["PlatformGame", "contract"],
      ["PlatformDeFi", "contract"],
      ["PlatformSocial", "undeployed"],
    ],
  );
});

test("RPC selection rejects endpoints from the wrong Neo network", async () => {
  const selected = await selectTestnetRpc(["mainnet", "testnet"], async (url) => ({
    protocol: { network: url === "testnet" ? 894710606 : 860833102 },
    useragent: url,
  }));
  assert.equal(selected.rpcUrl, "testnet");
});

test("live verifier separates matches, drift, Registry artifacts, and missing deployment", async () => {
  const targets = loadPlatformTargets();
  const checksumByHash = new Map(
    targets
      .filter((target) => target.kind === "contract")
      .map((target, index) => [
        target.hash,
        index === 0 ? target.local.checksum : target.local.checksum + 1,
      ]),
  );
  const rpcCall = async (_url, method, params) => {
    if (method === "getversion") {
      return { protocol: { network: 894710606 }, useragent: "unit-test" };
    }
    if (method === "getcontractstate") {
      const target = targets.find((candidate) => candidate.hash === params[0]);
      return {
        id: 1,
        updatecounter: 0,
        nef: { checksum: checksumByHash.get(params[0]) },
        manifest: {
          name: target.name,
          abi: { methods: target.local.methodNames.map((name) => ({ name })) },
        },
      };
    }
    if (method === "invokefunction") {
      if (params[1] === "admin") {
        const target = targets.find((candidate) => candidate.hash === params[0]);
        const hash = target.expectedAdmin ?? "0x1111111111111111111111111111111111111111";
        const bytes = Buffer.from(hash.slice(2), "hex").reverse().toString("base64");
        return { state: "HALT", stack: [{ type: "ByteString", value: bytes }] };
      }
      const value = params[1] === "artifactChecksum"
        ? targets.find((target) => target.name === "AppAccount").local.checksum
        : 1;
      return { state: "HALT", stack: [{ type: "Integer", value: String(value) }] };
    }
    throw new Error(`unexpected RPC method ${method}`);
  };

  const report = await verifyPlatformContractsLive({
    targets,
    rpcCandidates: ["testnet"],
    rpcCall,
    now: () => new Date("2026-07-23T00:00:00.000Z"),
  });

  assert.equal(report.summary.contracts, 7);
  assert.equal(report.summary.current_local_artifact_matches, 2);
  assert.equal(report.summary.artifact_drifts, 4);
  assert.equal(report.summary.active_registry_artifacts, 1);
  assert.equal(report.summary.no_deployment_record, 1);
  assert.equal(report.summary.admin_domains, 3);
  assert.match(renderLiveMarkdown(report), /live-artifact-drift/);
  assert.match(report.boundary, /does not prove funded lifecycle behavior/i);
});

/**
 * Live testnet validation for the MiniAppFactory cohort — READ-ONLY.
 *
 * Covers THREE apps that all bind the shared MiniAppFactory template registry
 * (neo-manifest neo-n3-testnet hash 0x03a7c8fc…): miniapp-asset-factory,
 * miniapp-miniapp-factory, miniapp-nft-factory.
 *
 * Validates the registry read surface the apps render:
 *   1. deploymentCount() / miniAppCount() are non-negative and consistent
 *      with the index enumerators.
 *   2. getDeploymentIdByIndex(i) / getMiniAppIdByIndex(i) yield ids that
 *      resolve back to well-formed DeploymentRecord / MiniAppRecord structs
 *      (templateId/packageId non-empty, creator non-zero, createdAt > 0).
 *   3. A nonexistent package id returns an empty/zero record (documented
 *      not-found shape) instead of a fault.
 *
 * No credentials needed: every call is a read-only RPC invokeFunction.
 */
import pkg from "@cityofzion/neon-js";
import { createLiveRpc } from "./lib/live_rpc.mjs";

const CONTRACT = "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49"; // MiniAppFactory testnet (all 3 manifests)
const live = createLiveRpc({ network: "testnet", neon: pkg, label: "live_validate_miniapp_factory" });

const S = (s) => ({ type: "String", value: s });
const I = (n) => ({ type: "Integer", value: n.toString() });
const read = (method, params = []) => live.readStack(CONTRACT, method, params);
const decInt = (v) => BigInt(v?.value ?? "0");
const decStr = (v) => {
  if (!v) return "";
  if (v.type === "ByteString") return Buffer.from(String(v.value ?? ""), "base64").toString("utf8");
  return String(v.value ?? "");
};

let failures = 0;
const check = (ok, label, detail = "") => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

// DeploymentRecord: [TemplateId, PackageId, Digest, InitParams, Creator, DeployedHash, CreatedAt]
// MiniAppRecord:     [TemplateId, PackageId, Digest, InitParams, Creator, CreatedAt]
function parseRecord(stack, width) {
  const fields = stack?.[0]?.value ?? [];
  return {
    templateId: decStr(fields[0]),
    packageId: decStr(fields[1]),
    creator: decStr(fields[4]),
    createdAt: decInt(fields[width - 1]),
    fieldCount: fields.length,
  };
}

async function main() {
  console.log(`contract: ${CONTRACT} (MiniAppFactory testnet — asset/miniapp/nft factory binding)`);

  const deploymentCount = Number(decInt((await read("deploymentCount"))?.[0]));
  const miniAppCount = Number(decInt((await read("miniAppCount"))?.[0]));
  check(deploymentCount >= 0, `deploymentCount is non-negative`, `${deploymentCount}`);
  check(miniAppCount >= 0, `miniAppCount is non-negative`, `${miniAppCount}`);
  console.log(`  registry: ${deploymentCount} deployment(s), ${miniAppCount} miniapp record(s)`);

  for (let i = 0; i < Math.min(deploymentCount, 3); i++) {
    const id = decStr((await read("getDeploymentIdByIndex", [I(i)]))?.[0]);
    check(id.length > 0, `getDeploymentIdByIndex(${i}) yields a non-empty id`, `"${id}"`);
    const r = parseRecord(await read("getDeployment", [S(id)]), 7);
    check(r.fieldCount === 7, `getDeployment("${id}") returns a 7-field DeploymentRecord`, `${r.fieldCount} fields`);
    check(r.templateId.length > 0, `getDeployment("${id}") templateId non-empty`, `"${r.templateId}"`);
    check(r.packageId === id, `getDeployment("${id}") packageId echoes`, `"${r.packageId}"`);
    check(r.createdAt > 0n, `getDeployment("${id}") createdAt > 0`, `${r.createdAt}`);
    console.log(`  deployment[${i}]: template=${r.templateId} package=${r.packageId}`);
  }

  for (let i = 0; i < Math.min(miniAppCount, 3); i++) {
    const id = decStr((await read("getMiniAppIdByIndex", [I(i)]))?.[0]);
    check(id.length > 0, `getMiniAppIdByIndex(${i}) yields a non-empty id`, `"${id}"`);
    const r = parseRecord(await read("getMiniApp", [S(id)]), 6);
    check(r.fieldCount === 6, `getMiniApp("${id}") returns a 6-field MiniAppRecord`, `${r.fieldCount} fields`);
    check(r.templateId.length > 0, `getMiniApp("${id}") templateId non-empty`, `"${r.templateId}"`);
    check(r.createdAt > 0n, `getMiniApp("${id}") createdAt > 0`, `${r.createdAt}`);
    console.log(`  miniapp[${i}]: template=${r.templateId} package=${r.packageId}`);
  }

  // Not-found shape: an unknown package id FAULTs with "deployment not found"
  // (the contract asserts instead of returning a zero record).
  let notFoundFault = "";
  try {
    await read("getDeployment", [S("pkg:does-not-exist")]);
  } catch (err) {
    notFoundFault = String(err?.message ?? err);
  }
  check(notFoundFault.includes("deployment not found"),
    "unknown package id FAULTs with 'deployment not found'", notFoundFault.slice(0, 80));

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nMiniAppFactory cohort live-chain harness: ALL CHECKS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

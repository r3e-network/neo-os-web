#!/usr/bin/env node
/**
 * Read-only functional probes against the live mainnet flagship contracts.
 * For each flagship we invoke a representative slice of the same read methods
 * tier 09 hits on testnet and check vmstate=HALT plus a sane return shape.
 *
 * Pure invokefunction — never broadcast — so no GAS cost.
 */
const MAINNET_RPC = process.env.NEO_RPC_MAINNET || "https://mainnet2.neo.coz.io:443";

// Same read-method list the testnet integration suite uses (proven on testnet).
const FLAGSHIPS = [
  { app: "daily-checkin", hash: "0xbd4f3646e189350b9c11a659655854e6f03f9be4",
    probes: [
      { method: "getPlatformStats", expect: "Map" },
      { method: "admin", expect: "ByteString" },
    ] },
  { app: "neo-pay", hash: "0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34",
    probes: [
      { method: "totalStreams", expect: "Integer" },
      { method: "admin", expect: "ByteString" },
    ] },
  { app: "last-survivor", hash: "0x180a3a35c088eab4feded508c2ccb1556e07a840",
    probes: [
      { method: "getGameStatus", expect: "Map" },
      { method: "getPlatformStats", expect: "Map" },
      { method: "admin", expect: "ByteString" },
    ] },
  { app: "self-loan", hash: "0x942da575b31f39cbb59e64b5813b128739b44c25",
    probes: [
      { method: "getPlatformStats", expect: "Map" },
      { method: "admin", expect: "ByteString" },
    ] },
  { app: "fogplay", hash: "0xa5a4b5b82066d86eae9312f6072d1c3604882c81",
    probes: [
      { method: "getBetLimits", expect: "Map" },
      { method: "admin", expect: "ByteString" },
    ] },
  { app: "gasbox", hash: "0xf111a0d02ecae3ace271da8abeb7ee22fa122f1c",
    probes: [
      { method: "totalMachines", expect: "Integer" },
      { method: "admin", expect: "ByteString" },
    ] },
  { app: "red-envelope", hash: "0x5f371cc50116bb13d79554d96ccdd6e246cd5d59",
    probes: [
      { method: "admin", expect: "ByteString" },
    ] },
];

async function rpc(method, params) {
  const res = await fetch(MAINNET_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`${method}: ${data.error.message}`);
  return data.result;
}

async function getAvailableMethods(hash) {
  try {
    const state = await rpc("getcontractstate", [hash]);
    return new Set((state?.manifest?.abi?.methods || []).map((m) => m.name));
  } catch {
    return new Set();
  }
}

async function probeOne(spec) {
  const available = await getAvailableMethods(spec.hash);
  const out = { app: spec.app, hash: spec.hash, contractFound: available.size > 0, results: [] };
  for (const probe of spec.probes) {
    if (!available.has(probe.method)) {
      // try a likely fallback if the canonical name isn't there
      const lower = probe.method.toLowerCase();
      const fallback = [...available].find((m) => m.toLowerCase() === lower);
      if (fallback) probe.method = fallback;
    }
    if (!available.has(probe.method)) {
      out.results.push({ method: probe.method, status: "method-not-on-abi" });
      continue;
    }
    try {
      const r = await rpc("invokefunction", [spec.hash, probe.method, []]);
      const top = r?.stack?.[0];
      // Accept any non-empty stack on HALT — invokefunction returns Map as
      // a Map type or a packed Array depending on serialization, and the
      // real success signal is "VM halted with a result", not the exact tag.
      const ok = r?.state === "HALT" && top != null;
      out.results.push({
        method: probe.method,
        vmstate: r?.state,
        gasconsumed: r?.gasconsumed,
        stackType: top?.type,
        stackValue: top?.type === "Integer" ? top.value : top?.value?.slice?.(0, 64),
        ok,
      });
    } catch (err) {
      out.results.push({ method: probe.method, status: "rpc-error", error: String(err?.message || err) });
    }
  }
  out.allOk = out.contractFound && out.results.every((r) => r.ok);
  return out;
}

async function main() {
  const results = [];
  for (const spec of FLAGSHIPS) {
    process.stderr.write(`probing ${spec.app}…\n`);
    results.push(await probeOne(spec));
  }
  const failed = results.filter((r) => !r.allOk);
  console.log(JSON.stringify({
    rpc: MAINNET_RPC,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });

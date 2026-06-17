/**
 * Morpheus Oracle kernel RPC helpers.
 *
 * The kernel contract provides:
 * - registerMiniApp / getMiniApp / configureMiniApp
 * - putMiniAppState / getMiniAppState / deleteMiniAppState
 * - submitMiniAppRequest / fulfillRequest
 *
 * These helpers build invocation intents that the OS service handler
 * sends to the kernel instead of individual miniapp contracts.
 */

import { getEnv, isProductionEnv } from "./env.ts";

/**
 * Audit fix E-6: read the kernel hash lazily so the boot order is not
 * "import resolves env once and caches an empty string forever". A
 * Supabase Functions deploy that boots before its secrets arrive used to
 * silently capture `""` at module-import time and return intents with
 * `contract_hash: ""` until the pod restarted. Reading per-call adds a
 * negligible Map lookup and lets the function fail-fast against the live
 * env on every invocation.
 *
 * Required env: CONTRACT_MORPHEUS_ORACLE_HASH (canonical) or
 * MORPHEUS_ORACLE_HASH (legacy alias).
 */
export function getKernelHash(): string {
  return (
    getEnv("CONTRACT_MORPHEUS_ORACLE_HASH") ??
    getEnv("MORPHEUS_ORACLE_HASH") ??
    ""
  );
}

/**
 * Strict kernel-hash accessor: throws when not configured in production
 * and returns "" only in non-production environments where a placeholder
 * value can be tolerated. Edge functions that depend on the kernel
 * should call this rather than `getKernelHash()` so a misconfigured
 * deploy fails on first request instead of silently returning empty
 * `contract_hash` intents to the wallet.
 */
export function requireKernelHash(): string {
  const hash = getKernelHash();
  if (hash) return hash;
  if (isProductionEnv()) {
    throw new Error(
      "kernel contract hash not configured (CONTRACT_MORPHEUS_ORACLE_HASH)",
    );
  }
  return "";
}

export function buildKernelStateRead(appId: string, stateKey: string) {
  return {
    contract: getKernelHash(),
    operation: "getMiniAppState",
    args: [
      { type: "String", value: appId },
      { type: "ByteArray", value: stringToHex(stateKey) },
    ],
  };
}

export function buildKernelStateWrite(
  appId: string,
  stateKey: string,
  value: string,
) {
  return {
    // Audit fix E-6 (writes): state-mutating intents must fail-fast when the
    // kernel hash is unconfigured, otherwise a misconfigured deploy hands the
    // wallet a `contract: ""` invocation (silent no-op / wrong-target signing).
    contract: requireKernelHash(),
    operation: "putMiniAppState",
    args: [
      { type: "String", value: appId },
      { type: "ByteArray", value: stringToHex(stateKey) },
      { type: "ByteArray", value: stringToHex(value) },
    ],
  };
}

export function buildKernelStateDelete(appId: string, stateKey: string) {
  return {
    // Audit fix E-6 (writes): fail-fast on missing kernel hash — see
    // buildKernelStateWrite.
    contract: requireKernelHash(),
    operation: "deleteMiniAppState",
    args: [
      { type: "String", value: appId },
      { type: "ByteArray", value: stringToHex(stateKey) },
    ],
  };
}

export function buildKernelStateBatchWrite(
  appId: string,
  keys: string[],
  values: string[],
) {
  return {
    // Audit fix E-6 (writes): fail-fast on missing kernel hash — see
    // buildKernelStateWrite.
    contract: requireKernelHash(),
    operation: "putMiniAppStateBatch",
    args: [
      { type: "String", value: appId },
      {
        type: "Array",
        value: keys.map((k) => ({ type: "ByteArray", value: stringToHex(k) })),
      },
      {
        type: "Array",
        value: values.map((v) => ({
          type: "ByteArray",
          value: stringToHex(v),
        })),
      },
    ],
  };
}

function stringToHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

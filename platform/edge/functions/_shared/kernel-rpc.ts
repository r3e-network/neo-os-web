/**
 * Morpheus Oracle kernel RPC helpers.
 *
 * The kernel contract provides:
 * - RegisterMiniApp / GetMiniApp / UpdateMiniApp
 * - PutMiniAppState / GetMiniAppState / DeleteMiniAppState
 * - SubmitMiniAppRequest / FulfillRequest
 *
 * These helpers build invocation intents that the OS service handler
 * sends to the kernel instead of individual miniapp contracts.
 */

import { getEnv } from "./env.ts";

const KERNEL_HASH =
  getEnv("CONTRACT_MORPHEUS_ORACLE_HASH") ??
  getEnv("MORPHEUS_ORACLE_HASH") ??
  "";

export function getKernelHash(): string {
  return KERNEL_HASH;
}

export function buildKernelStateRead(appId: string, stateKey: string) {
  return {
    contract: KERNEL_HASH,
    operation: "GetMiniAppState",
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
    contract: KERNEL_HASH,
    operation: "PutMiniAppState",
    args: [
      { type: "String", value: appId },
      { type: "ByteArray", value: stringToHex(stateKey) },
      { type: "ByteArray", value: stringToHex(value) },
    ],
  };
}

export function buildKernelStateDelete(appId: string, stateKey: string) {
  return {
    contract: KERNEL_HASH,
    operation: "DeleteMiniAppState",
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
    contract: KERNEL_HASH,
    operation: "PutMiniAppStateBatch",
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

import { NEO_TESTNET_RPC } from "@shared/constants";
import { normalizeScriptHash } from "@shared/utils/neo";

export const AIM_MASTER_TESTNET_CONTRACT = "0xed26866fb59219db8743c7673df098f363bac9ec";
export const AIM_MASTER_TESTNET_CHECKSUM = 422_251_087;
export const AIM_MASTER_CONTRACT_VERSION = "3.0.0";

type MethodSignature = { params: number; returntype: string; safe: boolean };

const REQUIRED_METHODS = new Map<string, MethodSignature>([
  ["startGame", { params: 2, returntype: "Integer", safe: false }],
  ["finalizeGame", { params: 2, returntype: "Integer", safe: false }],
  ["expireGame", { params: 1, returntype: "Integer", safe: false }],
  ["withdraw", { params: 1, returntype: "Integer", safe: false }],
  ["freePool", { params: 0, returntype: "Integer", safe: true }],
  ["creditOf", { params: 1, returntype: "Integer", safe: true }],
  ["activeGameOf", { params: 1, returntype: "Integer", safe: true }],
  ["getGame", { params: 1, returntype: "Map", safe: true }],
  ["getConfig", { params: 0, returntype: "Map", safe: true }],
  ["isPaused", { params: 0, returntype: "Boolean", safe: true }],
  ["oracle", { params: 0, returntype: "Hash160", safe: true }],
  ["networkMagic", { params: 0, returntype: "Integer", safe: true }],
]);

const REQUIRED_EVENTS = new Map<string, number>([
  ["GameStarted", 5],
  ["Finalizing", 3],
  ["Solved", 7],
  ["GameExpired", 3],
  ["CreditWithdrawn", 2],
]);

type RpcEnvelope<T> = {
  result?: T;
  error?: { code?: number; message?: string };
};

type ContractState = {
  hash?: string;
  nef?: { checksum?: number };
  manifest?: {
    name?: string;
    extra?: { Version?: string };
    abi?: {
      methods?: Array<{
        name?: string;
        parameters?: unknown[];
        returntype?: string;
        safe?: boolean;
      }>;
      events?: Array<{ name?: string; parameters?: unknown[] }>;
    };
  };
};

export type AimMasterContractAttestation = {
  compatible: boolean;
  checksum: number | null;
  version: string;
  reason: "ok" | "binding" | "checksum" | "manifest" | "abi" | "unreachable";
};

async function getContractState(contract: string, timeoutMs = 6_000): Promise<ContractState> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(NEO_TESTNET_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getcontractstate",
        params: [contract],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const envelope = await response.json() as RpcEnvelope<ContractState>;
    if (envelope.error || !envelope.result) throw new Error("Contract state unavailable");
    return envelope.result;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

/**
 * Attest the upgradeable Neo contract before any economic/recovery action.
 * Hash-only checks are insufficient because the contract can be upgraded in
 * place; checksum + manifest version + exact ABI keep a same-address drift
 * from inheriting Aim Master's wallet permissions.
 */
export async function attestAimMasterContract(
  contractHash: string,
): Promise<AimMasterContractAttestation> {
  const contract = normalizeScriptHash(contractHash || "");
  if (!contract || contract !== normalizeScriptHash(AIM_MASTER_TESTNET_CONTRACT)) {
    return { compatible: false, checksum: null, version: "", reason: "binding" };
  }

  try {
    const state = await getContractState(contract);
    const checksum = Number(state.nef?.checksum);
    const version = String(state.manifest?.extra?.Version ?? "");
    if (
      normalizeScriptHash(state.hash || "") !== contract
      || checksum !== AIM_MASTER_TESTNET_CHECKSUM
    ) {
      return {
        compatible: false,
        checksum: Number.isFinite(checksum) ? checksum : null,
        version,
        reason: "checksum",
      };
    }
    if (state.manifest?.name !== "MiniAppAimMaster" || version !== AIM_MASTER_CONTRACT_VERSION) {
      return { compatible: false, checksum, version, reason: "manifest" };
    }

    const methods = new Map(
      (state.manifest.abi?.methods ?? []).map((method) => [method.name, method]),
    );
    const events = new Map(
      (state.manifest.abi?.events ?? []).map((event) => [event.name, event]),
    );
    const methodsMatch = [...REQUIRED_METHODS].every(([name, signature]) => {
      const method = methods.get(name);
      return Boolean(
        method
        && (method.parameters?.length ?? -1) === signature.params
        && method.returntype === signature.returntype
        && method.safe === signature.safe,
      );
    });
    const eventsMatch = [...REQUIRED_EVENTS].every(
      ([name, parameterCount]) => (events.get(name)?.parameters?.length ?? -1) === parameterCount,
    );
    if (!methodsMatch || !eventsMatch) {
      return { compatible: false, checksum, version, reason: "abi" };
    }
    return { compatible: true, checksum, version, reason: "ok" };
  } catch {
    return { compatible: false, checksum: null, version: "", reason: "unreachable" };
  }
}

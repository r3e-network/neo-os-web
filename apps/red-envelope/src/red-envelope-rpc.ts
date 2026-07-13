import { NEO_MAINNET_RPC, NEO_TESTNET_RPC } from "@shared/constants";
import { normalizeScriptHash } from "@shared/utils/neo";

export type RedEnvelopeNetwork = "mainnet" | "testnet";
export type RedEnvelopeExecutionState = "halt" | "fault" | "pending" | "unreachable";

type ExpectedBinding = {
  contract: string;
  checksum: number;
  version: string;
  boundedCreate: boolean;
};

const EXPECTED_BINDINGS: Record<RedEnvelopeNetwork, ExpectedBinding> = {
  mainnet: {
    contract: "0x363c5de9760d1aaaed5096fdf3bdc877cd0368e9",
    checksum: 1_656_096_401,
    version: "1.0.0",
    boundedCreate: false,
  },
  testnet: {
    contract: "0x5a5ecc80cd5225acd7431a5dd6f0e32bb9260a87",
    checksum: 4_293_893_390,
    version: "1.1.0",
    boundedCreate: true,
  },
};

const REQUIRED_METHODS = new Map<string, { params: number; returntype: string; safe: boolean }>([
  ["createEnvelope", { params: 4, returntype: "Integer", safe: false }],
  ["claim", { params: 2, returntype: "Integer", safe: false }],
  ["reclaim", { params: 2, returntype: "Integer", safe: false }],
  ["withdraw", { params: 1, returntype: "Integer", safe: false }],
  ["lastEnvelopeId", { params: 0, returntype: "Integer", safe: true }],
  ["creditOf", { params: 1, returntype: "Integer", safe: true }],
  ["claimedAmount", { params: 2, returntype: "Integer", safe: true }],
  ["hasClaimed", { params: 2, returntype: "Boolean", safe: true }],
  ["getEnvelope", { params: 1, returntype: "Map", safe: true }],
  ["creatorEnvelopeCount", { params: 1, returntype: "Integer", safe: true }],
  ["getCreatorEnvelopes", { params: 3, returntype: "Array", safe: true }],
  ["claimerEnvelopeCount", { params: 1, returntype: "Integer", safe: true }],
  ["getClaimerEnvelopes", { params: 3, returntype: "Array", safe: true }],
]);

const REQUIRED_EVENTS = new Map<string, number>([
  ["Credited", 3],
  ["EnvelopeCreated", 5],
  ["Claimed", 4],
  ["Reclaimed", 3],
  ["CreditWithdrawn", 2],
]);

const rpcUrl = (network: RedEnvelopeNetwork): string =>
  network === "testnet" ? NEO_TESTNET_RPC : NEO_MAINNET_RPC;

export function normalizeRedEnvelopeNetwork(value: unknown): RedEnvelopeNetwork | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "testnet";
  return null;
}

export function normalizeRedEnvelopeId(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,78}$/.test(raw)) return "";
  try {
    const id = BigInt(raw);
    return id > 0n ? id.toString() : "";
  } catch {
    return "";
  }
}

export function buildRedEnvelopeShareUrl(
  envelopeId: unknown,
  networkValue: unknown,
): string {
  const id = normalizeRedEnvelopeId(envelopeId);
  const network = normalizeRedEnvelopeNetwork(networkValue);
  if (!id || !network) return "";
  const url = new URL("neomainapp://red-envelope");
  url.searchParams.set("network", network);
  url.searchParams.set("envelopeId", id);
  return url.toString();
}

type RpcEnvelope<T> = {
  result?: T;
  error?: { code?: number; message?: string };
};

async function rpcCall<T>(
  network: RedEnvelopeNetwork,
  method: string,
  params: unknown[],
  timeoutMs = 6_000,
): Promise<RpcEnvelope<T>> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rpcUrl(network), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    return (await response.json()) as RpcEnvelope<T>;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

type ContractState = {
  hash?: string;
  nef?: { checksum?: number };
  manifest?: {
    name?: string;
    abi?: {
      methods?: Array<{
        name?: string;
        parameters?: unknown[];
        returntype?: string;
        safe?: boolean;
      }>;
      events?: Array<{ name?: string; parameters?: unknown[] }>;
    };
    extra?: { Version?: string };
  };
};

export type RedEnvelopeAttestation = {
  compatible: boolean;
  boundedCreate: boolean;
  checksum: number | null;
  version: string;
  reason: "ok" | "binding" | "checksum" | "manifest" | "abi" | "unreachable";
};

/**
 * Pin the exact deployed contract generation before any money-moving action.
 * A script hash alone is insufficient because Neo contracts can be upgraded in
 * place; checksum + ABI + manifest version prevent a same-address drift from
 * silently inheriting the frontend's wallet permissions.
 */
export async function attestRedEnvelopeContract(
  network: RedEnvelopeNetwork,
  contractHash: string,
): Promise<RedEnvelopeAttestation> {
  const expected = EXPECTED_BINDINGS[network];
  const contract = normalizeScriptHash(contractHash || "");
  if (!contract || contract !== normalizeScriptHash(expected.contract)) {
    return {
      compatible: false,
      boundedCreate: false,
      checksum: null,
      version: "",
      reason: "binding",
    };
  }

  try {
    const response = await rpcCall<ContractState>(network, "getcontractstate", [contract]);
    const state = response.result;
    const checksum = Number(state?.nef?.checksum);
    const version = String(state?.manifest?.extra?.Version ?? "");
    if (
      !state ||
      normalizeScriptHash(state.hash || "") !== contract ||
      checksum !== expected.checksum
    ) {
      return {
        compatible: false,
        boundedCreate: false,
        checksum: Number.isFinite(checksum) ? checksum : null,
        version,
        reason: "checksum",
      };
    }
    if (state.manifest?.name !== "MiniAppRedEnvelope" || version !== expected.version) {
      return {
        compatible: false,
        boundedCreate: false,
        checksum,
        version,
        reason: "manifest",
      };
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
        method &&
          (method.parameters?.length ?? -1) === signature.params &&
          method.returntype === signature.returntype &&
          method.safe === signature.safe,
      );
    });
    const eventsMatch = [...REQUIRED_EVENTS].every(([name, parameterCount]) =>
      (events.get(name)?.parameters?.length ?? -1) === parameterCount,
    );
    const boundedAbiMatches = !expected.boundedCreate || Boolean(
      methods.get("getOwner")?.safe === true &&
        (methods.get("getOwner")?.parameters?.length ?? -1) === 0 &&
        methods.get("update")?.safe === false,
    );
    if (!methodsMatch || !eventsMatch || !boundedAbiMatches) {
      return {
        compatible: false,
        boundedCreate: false,
        checksum,
        version,
        reason: "abi",
      };
    }

    return {
      compatible: true,
      boundedCreate: expected.boundedCreate,
      checksum,
      version,
      reason: "ok",
    };
  } catch {
    return {
      compatible: false,
      boundedCreate: false,
      checksum: null,
      version: "",
      reason: "unreachable",
    };
  }
}

type ApplicationLog = {
  executions?: Array<{ vmstate?: string }>;
};

/** Exact transaction VM state used to clear terminal FAULT recovery records. */
export async function readRedEnvelopeExecutionState(
  networkValue: unknown,
  txidValue: unknown,
): Promise<RedEnvelopeExecutionState> {
  const network = normalizeRedEnvelopeNetwork(networkValue);
  const txid = String(txidValue ?? "").trim().toLowerCase();
  if (!network || !/^0x[0-9a-f]{64}$/.test(txid)) return "unreachable";
  try {
    const response = await rpcCall<ApplicationLog>(network, "getapplicationlog", [txid]);
    if (response.error) return "pending";
    const states = (response.result?.executions ?? [])
      .map((execution) => String(execution.vmstate ?? "").toUpperCase());
    if (states.some((state) => state.includes("FAULT"))) return "fault";
    if (states.length > 0 && states.every((state) => state.includes("HALT"))) return "halt";
    return "pending";
  } catch {
    return "unreachable";
  }
}

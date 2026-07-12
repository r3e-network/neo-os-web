import { NEO_MAINNET_RPC, NEO_TESTNET_RPC } from "@shared/constants";
import { normalizeScriptHash } from "@shared/utils/neo";

export type DevTippingNetwork = "mainnet" | "testnet";
export type DevTippingExecutionState = "halt" | "fault" | "pending" | "unreachable";

export const DEV_TIPPING_BINDINGS: Record<
  DevTippingNetwork,
  { contract: string; checksum: number; updateCounter: number }
> = {
  mainnet: {
    contract: "0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec",
    checksum: 2_483_335_541,
    updateCounter: 0,
  },
  testnet: {
    contract: "0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec",
    checksum: 2_483_335_541,
    updateCounter: 0,
  },
};

type AbiMethod = {
  name?: string;
  parameters?: Array<{ type?: string }>;
  returntype?: string;
  safe?: boolean;
};

type AbiEvent = {
  name?: string;
  parameters?: Array<{ type?: string }>;
};

type ContractState = {
  hash?: string;
  updatecounter?: number;
  nef?: { checksum?: number };
  manifest?: {
    name?: string;
    extra?: { Version?: string };
    abi?: { methods?: AbiMethod[]; events?: AbiEvent[] };
  };
};

type RpcEnvelope<T> = {
  result?: T;
  error?: { code?: number; message?: string };
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export type DevTippingAttestation = {
  compatible: boolean;
  network: DevTippingNetwork | null;
  contract: string;
  checksum: number | null;
  updateCounter: number | null;
  reason:
    | "ok"
    | "network"
    | "contract"
    | "rpc"
    | "name"
    | "checksum"
    | "generation"
    | "abi";
};

const REQUIRED_METHODS = new Map<
  string,
  { params: string[]; returntype: string; safe: boolean }
>([
  ["onNEP17Payment", { params: ["Hash160", "Integer", "Any"], returntype: "Void", safe: false }],
  ["registerDeveloper", { params: ["Hash160", "String", "String"], returntype: "Integer", safe: false }],
  ["tip", { params: ["Hash160", "Integer", "Integer", "Boolean"], returntype: "Integer", safe: false }],
  ["withdrawTips", { params: ["Integer"], returntype: "Integer", safe: false }],
  ["withdraw", { params: ["Hash160"], returntype: "Integer", safe: false }],
  ["totalDevelopers", { params: [], returntype: "Integer", safe: true }],
  ["totalDonated", { params: [], returntype: "Integer", safe: true }],
  ["tipsCount", { params: [], returntype: "Integer", safe: true }],
  ["minTip", { params: [], returntype: "Integer", safe: true }],
  ["creditOf", { params: ["Hash160"], returntype: "Integer", safe: true }],
  ["developerIdOf", { params: ["Hash160"], returntype: "Integer", safe: true }],
  ["getDeveloper", { params: ["Integer"], returntype: "Map", safe: true }],
]);

const REQUIRED_EVENTS = new Map<string, string[]>([
  ["Credited", ["Hash160", "Integer", "Integer"]],
  ["DeveloperRegistered", ["Integer", "Hash160", "String"]],
  ["Tipped", ["Integer", "Integer", "Hash160", "Integer", "Boolean"]],
  ["TipsWithdrawn", ["Integer", "Hash160", "Integer"]],
  ["CreditWithdrawn", ["Hash160", "Integer"]],
]);

export function normalizeDevTippingNetwork(value: unknown): DevTippingNetwork | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return null;
}

function rpcUrl(network: DevTippingNetwork): string {
  return network === "testnet" ? NEO_TESTNET_RPC : NEO_MAINNET_RPC;
}

function methodMatches(
  method: AbiMethod,
  expected: { params: string[]; returntype: string; safe: boolean },
): boolean {
  return (
    method.returntype === expected.returntype
    && method.safe === expected.safe
    && JSON.stringify((method.parameters ?? []).map((parameter) => parameter.type))
      === JSON.stringify(expected.params)
  );
}

function abiMatches(state: ContractState): boolean {
  const methods = new Map(
    (state.manifest?.abi?.methods ?? []).map((method) => [method.name, method]),
  );
  const events = new Map(
    (state.manifest?.abi?.events ?? []).map((event) => [event.name, event]),
  );
  for (const [name, expected] of REQUIRED_METHODS) {
    const method = methods.get(name);
    if (!method || !methodMatches(method, expected)) return false;
  }
  for (const [name, expected] of REQUIRED_EVENTS) {
    const event = events.get(name);
    if (
      !event
      || JSON.stringify((event.parameters ?? []).map((parameter) => parameter.type))
        !== JSON.stringify(expected)
    ) return false;
  }
  return true;
}

async function rpcCall<T>(
  network: DevTippingNetwork,
  method: string,
  params: unknown[],
  fetcher: FetchLike,
  timeoutMs = 6_000,
): Promise<RpcEnvelope<T>> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(rpcUrl(network), {
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

export async function attestDevTippingContract(
  networkValue: unknown,
  contractValue: unknown,
  fetcher: FetchLike = fetch,
): Promise<DevTippingAttestation> {
  const network = normalizeDevTippingNetwork(networkValue);
  const contract = normalizeScriptHash(String(contractValue ?? ""));
  if (!network) {
    return {
      compatible: false,
      network: null,
      contract,
      checksum: null,
      updateCounter: null,
      reason: "network",
    };
  }
  const expected = DEV_TIPPING_BINDINGS[network];
  if (!contract || contract !== normalizeScriptHash(expected.contract)) {
    return {
      compatible: false,
      network,
      contract,
      checksum: null,
      updateCounter: null,
      reason: "contract",
    };
  }

  let state: ContractState;
  try {
    const response = await rpcCall<ContractState>(
      network,
      "getcontractstate",
      [contract],
      fetcher,
    );
    if (response.error || !response.result) {
      throw new Error(response.error?.message || "RPC result missing");
    }
    state = response.result;
  } catch {
    return {
      compatible: false,
      network,
      contract,
      checksum: null,
      updateCounter: null,
      reason: "rpc",
    };
  }

  const checksum = Number.isSafeInteger(state.nef?.checksum)
    ? Number(state.nef?.checksum)
    : null;
  const updateCounter = Number.isSafeInteger(state.updatecounter)
    ? Number(state.updatecounter)
    : null;
  if (normalizeScriptHash(state.hash ?? "") !== contract) {
    return { compatible: false, network, contract, checksum, updateCounter, reason: "contract" };
  }
  if (state.manifest?.name !== "MiniAppTipJar") {
    return { compatible: false, network, contract, checksum, updateCounter, reason: "name" };
  }
  if (checksum !== expected.checksum) {
    return { compatible: false, network, contract, checksum, updateCounter, reason: "checksum" };
  }
  if (updateCounter !== expected.updateCounter) {
    return { compatible: false, network, contract, checksum, updateCounter, reason: "generation" };
  }
  if (!abiMatches(state)) {
    return { compatible: false, network, contract, checksum, updateCounter, reason: "abi" };
  }
  return { compatible: true, network, contract, checksum, updateCounter, reason: "ok" };
}

type ApplicationLog = {
  executions?: Array<{ vmstate?: string }>;
};

/** Read the exact transaction VM state; a missing log remains pending. */
export async function readDevTippingExecutionState(
  networkValue: unknown,
  txidValue: unknown,
  fetcher: FetchLike = fetch,
): Promise<DevTippingExecutionState> {
  const network = normalizeDevTippingNetwork(networkValue);
  const txid = String(txidValue ?? "").trim().toLowerCase();
  if (!network || !/^0x[0-9a-f]{64}$/.test(txid)) return "unreachable";
  try {
    const response = await rpcCall<ApplicationLog>(
      network,
      "getapplicationlog",
      [txid],
      fetcher,
    );
    if (response.error) return "pending";
    const states = (response.result?.executions ?? []).map((execution) =>
      String(execution.vmstate ?? "").toUpperCase(),
    );
    if (states.some((state) => state.includes("FAULT"))) return "fault";
    if (states.length > 0 && states.every((state) => state.includes("HALT"))) return "halt";
    return "pending";
  } catch {
    return "unreachable";
  }
}

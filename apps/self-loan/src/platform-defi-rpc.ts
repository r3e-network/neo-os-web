import { NEO_MAINNET_RPC, NEO_TESTNET_RPC } from "@shared/constants";
import { normalizeScriptHash } from "@shared/utils/neo";
import type { SelfLoanNetwork } from "./self-loan-rpc";

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
    abi?: { methods?: AbiMethod[]; events?: AbiEvent[] };
    extra?: { Version?: string };
  };
};

type RpcEnvelope<T> = {
  result?: T;
  error?: { message?: string };
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export type PlatformDeFiSelfLoanAttestation = {
  compatible: boolean;
  network: SelfLoanNetwork;
  contract: string;
  checksum: number | null;
  updateCounter: number | null;
  reason:
    | "ok"
    | "contract"
    | "rpc"
    | "name"
    | "version"
    | "checksum"
    | "generation"
    | "abi";
};

const EXPECTED_VERSION = "1.3.0";
const EXPECTED_CHECKSUM = 1_040_116_875;
const EXPECTED_UPDATE_COUNTER = 0;

const REQUIRED_METHODS = new Map<
  string,
  { params: string[]; returntype: string; safe: boolean }
>([
  ["getLendingProfile", { params: ["String"], returntype: "Integer", safe: true }],
  ["getActiveLoanId", { params: ["String", "Hash160"], returntype: "Integer", safe: true }],
  ["getSingleLoanPosition", { params: ["String", "Hash160"], returntype: "Map", safe: true }],
  ["getLendingStats", { params: ["String"], returntype: "Map", safe: true }],
  ["getNeoGasPrice", { params: ["String"], returntype: "Integer", safe: true }],
  ["getLendingLiquidity", { params: ["String"], returntype: "Integer", safe: true }],
  ["getDirectNeoCredit", { params: ["String", "Hash160"], returntype: "Integer", safe: true }],
  ["getDirectGasCredit", { params: ["String", "Hash160"], returntype: "Integer", safe: true }],
  ["createLoan", {
    params: ["String", "Hash160", "Integer", "Integer"],
    returntype: "Integer",
    safe: false,
  }],
  ["repayLoan", { params: ["String", "Integer"], returntype: "Void", safe: false }],
  ["addCollateral", {
    params: ["String", "Integer", "Integer"],
    returntype: "Void",
    safe: false,
  }],
  ["withdrawNeoCredit", {
    params: ["String", "Hash160", "Integer"],
    returntype: "Integer",
    safe: false,
  }],
  ["withdrawGasCredit", {
    params: ["String", "Hash160", "Integer"],
    returntype: "Integer",
    safe: false,
  }],
]);

const REQUIRED_EVENTS = new Map<string, string[]>([
  ["CreditDeposited", ["String", "Hash160", "Hash160", "Integer"]],
  ["CreditWithdrawn", ["String", "Hash160", "Hash160", "Integer"]],
  ["LoanCreated", ["String", "Integer", "Hash160", "Integer", "Integer"]],
  ["LoanRepaid", ["String", "Integer", "Integer", "Integer"]],
  ["LoanClosed", ["String", "Integer", "Hash160"]],
  ["CollateralAdded", ["String", "Integer", "Integer", "Integer"]],
]);

function methodMatches(
  method: AbiMethod,
  expected: { params: string[]; returntype: string; safe: boolean },
): boolean {
  return method.returntype === expected.returntype
    && method.safe === expected.safe
    && JSON.stringify((method.parameters ?? []).map((item) => item.type))
      === JSON.stringify(expected.params);
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
      || JSON.stringify((event.parameters ?? []).map((item) => item.type))
        !== JSON.stringify(expected)
    ) return false;
  }
  return true;
}

export async function attestPlatformDeFiSelfLoanContract(
  network: SelfLoanNetwork,
  contractValue: unknown,
  fetcher: FetchLike = fetch,
): Promise<PlatformDeFiSelfLoanAttestation> {
  const contract = normalizeScriptHash(String(contractValue ?? ""));
  const base = {
    network,
    contract,
    checksum: null,
    updateCounter: null,
  };
  if (!contract || contract === "0x") {
    return { ...base, compatible: false, reason: "contract" };
  }

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), 6_000);
  let state: ContractState;
  try {
    const response = await fetcher(
      network === "testnet" ? NEO_TESTNET_RPC : NEO_MAINNET_RPC,
      {
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
      },
    );
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const envelope = (await response.json()) as RpcEnvelope<ContractState>;
    if (envelope.error || !envelope.result) throw new Error(envelope.error?.message);
    state = envelope.result;
  } catch {
    return { ...base, compatible: false, reason: "rpc" };
  } finally {
    globalThis.clearTimeout(timer);
  }

  const checksum = Number.isSafeInteger(state.nef?.checksum)
    ? Number(state.nef?.checksum)
    : null;
  const updateCounter = Number.isSafeInteger(state.updatecounter)
    ? Number(state.updatecounter)
    : null;
  const resultBase = { network, contract, checksum, updateCounter };
  if (normalizeScriptHash(state.hash ?? "") !== contract) {
    return { ...resultBase, compatible: false, reason: "contract" };
  }
  if (state.manifest?.name !== "PlatformDeFi") {
    return { ...resultBase, compatible: false, reason: "name" };
  }
  if (state.manifest?.extra?.Version !== EXPECTED_VERSION) {
    return { ...resultBase, compatible: false, reason: "version" };
  }
  if (checksum !== EXPECTED_CHECKSUM) {
    return { ...resultBase, compatible: false, reason: "checksum" };
  }
  if (updateCounter !== EXPECTED_UPDATE_COUNTER) {
    return { ...resultBase, compatible: false, reason: "generation" };
  }
  if (!abiMatches(state)) {
    return { ...resultBase, compatible: false, reason: "abi" };
  }
  return { ...resultBase, compatible: true, reason: "ok" };
}

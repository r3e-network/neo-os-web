import { NEO_MAINNET_RPC, NEO_TESTNET_RPC } from "@shared/constants";
import { normalizeScriptHash } from "@shared/utils/neo";

export type SelfLoanNetwork = "mainnet" | "testnet";

export const SELF_LOAN_BINDINGS: Record<
  SelfLoanNetwork,
  { contract: string; checksum: number; updateCounter: number }
> = {
  mainnet: {
    contract: "0x87f94598c78cb954ca8200d3964ded9b584d7250",
    checksum: 927_006_627,
    updateCounter: 0,
  },
  testnet: {
    contract: "0x87f94598c78cb954ca8200d3964ded9b584d7250",
    checksum: 927_006_627,
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

export type SelfLoanAttestation = {
  compatible: boolean;
  /** Live v1 exposes withdrawRepayCredit but omits its confirmation event. */
  repayRecoveryCompatible?: boolean;
  network: SelfLoanNetwork | null;
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
  ["setNeoPrice", { params: ["Integer"], returntype: "Void", safe: false }],
  ["withdrawPool", { params: ["Hash160", "Integer"], returntype: "Void", safe: false }],
  ["borrow", { params: ["Hash160", "Integer"], returntype: "Integer", safe: false }],
  ["addCollateral", { params: ["Hash160"], returntype: "Void", safe: false }],
  ["repay", { params: ["Hash160"], returntype: "Integer", safe: false }],
  ["withdraw", { params: ["Hash160"], returntype: "Integer", safe: false }],
  ["withdrawRepayCredit", { params: ["Hash160"], returntype: "Integer", safe: false }],
  ["neoPrice", { params: [], returntype: "Integer", safe: true }],
  ["pool", { params: [], returntype: "Integer", safe: true }],
  ["collateralCreditOf", { params: ["Hash160"], returntype: "Integer", safe: true }],
  ["repayCreditOf", { params: ["Hash160"], returntype: "Integer", safe: true }],
  ["getLoan", { params: ["Hash160"], returntype: "Map", safe: true }],
  ["ltvTierBps", { params: ["Integer"], returntype: "Integer", safe: true }],
  ["feeBps", { params: [], returntype: "Integer", safe: true }],
  ["totalLoans", { params: [], returntype: "Integer", safe: true }],
  ["totalBorrowed", { params: [], returntype: "Integer", safe: true }],
  ["totalRepaid", { params: [], returntype: "Integer", safe: true }],
  ["getOwner", { params: [], returntype: "Hash160", safe: true }],
]);

const REQUIRED_EVENTS = new Map<string, string[]>([
  ["CollateralCredited", ["Hash160", "Integer", "Integer"]],
  ["PoolFunded", ["Hash160", "Integer", "Integer"]],
  ["RepayCredited", ["Hash160", "Integer", "Integer"]],
  ["PriceSet", ["Integer"]],
  ["LoanTaken", ["Hash160", "Integer", "Integer", "Integer"]],
  ["CollateralAdded", ["Hash160", "Integer", "Integer"]],
  ["Repaid", ["Hash160", "Integer", "Integer"]],
  ["LoanClosed", ["Hash160", "Integer"]],
  ["PoolWithdrawn", ["Hash160", "Integer"]],
  ["CollateralWithdrawn", ["Hash160", "Integer"]],
]);

export function normalizeSelfLoanNetwork(value: unknown): SelfLoanNetwork | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return null;
}

function methodMatches(
  method: AbiMethod,
  expected: { params: string[]; returntype: string; safe: boolean },
): boolean {
  return (
    method.returntype === expected.returntype
    && method.safe === expected.safe
    && JSON.stringify((method.parameters ?? []).map((item) => item.type))
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
      || JSON.stringify((event.parameters ?? []).map((item) => item.type))
        !== JSON.stringify(expected)
    ) return false;
  }
  return true;
}

export async function attestSelfLoanContract(
  networkValue: unknown,
  contractValue: unknown,
  fetcher: FetchLike = fetch,
): Promise<SelfLoanAttestation> {
  const network = normalizeSelfLoanNetwork(networkValue);
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
  const expected = SELF_LOAN_BINDINGS[network];
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
    if (envelope.error || !envelope.result) {
      throw new Error(envelope.error?.message || "RPC result missing");
    }
    state = envelope.result;
  } catch {
    return {
      compatible: false,
      network,
      contract,
      checksum: null,
      updateCounter: null,
      reason: "rpc",
    };
  } finally {
    globalThis.clearTimeout(timer);
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
  if (state.manifest?.name !== "MiniAppSelfLoan") {
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
  const repayRecoveryEvent = (state.manifest?.abi?.events ?? []).find(
    (event) => event.name === "RepayCreditWithdrawn",
  );
  const repayRecoveryCompatible = Boolean(
    repayRecoveryEvent
    && JSON.stringify((repayRecoveryEvent.parameters ?? []).map((item) => item.type))
      === JSON.stringify(["Hash160", "Integer"]),
  );
  return {
    compatible: true,
    repayRecoveryCompatible,
    network,
    contract,
    checksum,
    updateCounter,
    reason: "ok",
  };
}

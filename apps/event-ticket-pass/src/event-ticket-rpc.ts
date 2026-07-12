import { NEO_MAINNET_RPC, NEO_TESTNET_RPC } from "@shared/constants";
import { normalizeScriptHash, parseStackItem } from "@shared/utils/neo";

export type EventTicketNetwork = "mainnet" | "testnet";

export const EVENT_TICKET_BINDINGS: Record<
  EventTicketNetwork,
  { contract: string; checksum: number }
> = {
  mainnet: {
    contract: "0x90bad472146aab97de71498e8d736c3124e7c82b",
    checksum: 2_976_433_161,
  },
  testnet: {
    contract: "0x90bad472146aab97de71498e8d736c3124e7c82b",
    checksum: 2_976_433_161,
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
  nef?: { checksum?: number };
  manifest?: {
    name?: string;
    supportedstandards?: string[];
    abi?: { methods?: AbiMethod[]; events?: AbiEvent[] };
  };
};

type RpcEnvelope<T> = {
  result?: T;
  error?: { code?: number; message?: string };
};

export type EventTicketAttestation = {
  compatible: boolean;
  network: EventTicketNetwork | null;
  contract: string;
  checksum: number | null;
  reason:
    | "ok"
    | "network"
    | "contract"
    | "rpc"
    | "name"
    | "checksum"
    | "standard"
    | "abi";
};

export type EventTicketNotification = {
  contract: string;
  eventName: string;
  state: unknown[];
};

export type EventTicketTransactionOutcome = {
  state: "halt" | "fault" | "unknown";
  notifications: EventTicketNotification[];
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

function normalizedTxid(value: unknown): string {
  const txid = String(value ?? "").trim().toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(txid) ? txid : "";
}

function parseNotification(value: unknown): EventTicketNotification | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as {
    contract?: unknown;
    eventname?: unknown;
    event_name?: unknown;
    state?: unknown;
  };
  const contract = normalizeScriptHash(String(row.contract ?? ""));
  const eventName = String(row.eventname ?? row.event_name ?? "").trim();
  const rawState =
    row.state &&
    typeof row.state === "object" &&
    !Array.isArray(row.state) &&
    "value" in row.state
      ? (row.state as { value?: unknown }).value
      : row.state;
  if (!contract || !eventName || !Array.isArray(rawState)) return null;
  return {
    contract,
    eventName,
    state: rawState.map(parseStackItem),
  };
}

const REQUIRED_METHODS = new Map<
  string,
  { params: string[]; returntype: string; safe: boolean }
>([
  ["createEvent", { params: ["Hash160", "String", "String", "Integer", "Integer", "Integer", "String"], returntype: "Integer", safe: false }],
  ["setEventActive", { params: ["Hash160", "Integer", "Boolean"], returntype: "Void", safe: false }],
  ["issueTicket", { params: ["Hash160", "Hash160", "Integer", "String", "String"], returntype: "ByteArray", safe: false }],
  ["checkIn", { params: ["Hash160", "ByteArray"], returntype: "Void", safe: false }],
  ["transfer", { params: ["Hash160", "ByteArray", "Any"], returntype: "Boolean", safe: false }],
  ["symbol", { params: [], returntype: "String", safe: true }],
  ["decimals", { params: [], returntype: "Integer", safe: true }],
  ["totalEvents", { params: [], returntype: "Integer", safe: true }],
  ["balanceOf", { params: ["Hash160"], returntype: "Integer", safe: true }],
  ["ownerOf", { params: ["ByteArray"], returntype: "Hash160", safe: true }],
  ["getEventDetails", { params: ["Integer"], returntype: "Map", safe: true }],
  ["getTicketDetails", { params: ["ByteArray"], returntype: "Map", safe: true }],
  ["getCreatorEvents", { params: ["Hash160", "Integer", "Integer"], returntype: "Array", safe: true }],
]);

const REQUIRED_EVENTS = new Map<string, string[]>([
  ["EventCreated", ["Integer", "Hash160", "String"]],
  ["EventUpdated", ["Integer"]],
  ["TicketIssued", ["ByteArray", "Integer", "Hash160"]],
  ["TicketCheckedIn", ["ByteArray", "Integer", "Hash160"]],
  ["Transfer", ["Hash160", "Hash160", "Integer", "ByteArray"]],
]);

export function normalizeEventTicketNetwork(
  value: unknown,
): EventTicketNetwork | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return null;
}

function methodMatches(method: AbiMethod, expected: { params: string[]; returntype: string; safe: boolean }) {
  return (
    method.returntype === expected.returntype &&
    method.safe === expected.safe &&
    JSON.stringify((method.parameters ?? []).map((item) => item.type)) ===
      JSON.stringify(expected.params)
  );
}

function eventMatches(event: AbiEvent, expected: string[]) {
  return (
    JSON.stringify((event.parameters ?? []).map((item) => item.type)) ===
    JSON.stringify(expected)
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
    if (!event || !eventMatches(event, expected)) return false;
  }
  return true;
}

export async function attestEventTicketContract(
  networkValue: unknown,
  contractValue: unknown,
  fetcher: FetchLike = fetch,
): Promise<EventTicketAttestation> {
  const network = normalizeEventTicketNetwork(networkValue);
  const contract = normalizeScriptHash(String(contractValue ?? ""));
  if (!network) {
    return { compatible: false, network: null, contract, checksum: null, reason: "network" };
  }
  const expected = EVENT_TICKET_BINDINGS[network];
  if (!contract || contract !== normalizeScriptHash(expected.contract)) {
    return { compatible: false, network, contract, checksum: null, reason: "contract" };
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
    if (envelope.error || !envelope.result) throw new Error(envelope.error?.message || "RPC result missing");
    state = envelope.result;
  } catch {
    return { compatible: false, network, contract, checksum: null, reason: "rpc" };
  } finally {
    globalThis.clearTimeout(timer);
  }

  const checksum = Number.isSafeInteger(state.nef?.checksum)
    ? Number(state.nef?.checksum)
    : null;
  if (normalizeScriptHash(state.hash ?? "") !== contract) {
    return { compatible: false, network, contract, checksum, reason: "contract" };
  }
  if (state.manifest?.name !== "MiniAppEventTicketPass") {
    return { compatible: false, network, contract, checksum, reason: "name" };
  }
  if (checksum !== expected.checksum) {
    return { compatible: false, network, contract, checksum, reason: "checksum" };
  }
  if (!(state.manifest?.supportedstandards ?? []).includes("NEP-11")) {
    return { compatible: false, network, contract, checksum, reason: "standard" };
  }
  if (!abiMatches(state)) {
    return { compatible: false, network, contract, checksum, reason: "abi" };
  }
  return { compatible: true, network, contract, checksum, reason: "ok" };
}

/**
 * Read the canonical application log for a previously broadcast ticket action.
 * A missing log is deliberately `unknown`: the transaction may simply not be
 * indexed yet. A VM FAULT is terminal, while a HALT still needs an exact
 * contract + event match and authoritative state readback in the composable.
 */
export async function readEventTicketTransactionOutcome(
  networkValue: unknown,
  txidValue: unknown,
  contractValue: unknown,
  fetcher: FetchLike = fetch,
): Promise<EventTicketTransactionOutcome> {
  const network = normalizeEventTicketNetwork(networkValue);
  const txid = normalizedTxid(txidValue);
  const contract = normalizeScriptHash(String(contractValue ?? ""));
  if (!network || !txid || !contract) {
    return { state: "unknown", notifications: [] };
  }

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(
      network === "testnet" ? NEO_TESTNET_RPC : NEO_MAINNET_RPC,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getapplicationlog",
          params: [txid],
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) return { state: "unknown", notifications: [] };
    const envelope = (await response.json()) as RpcEnvelope<{
      executions?: Array<{
        vmstate?: unknown;
        state?: unknown;
        notifications?: unknown[];
      }>;
    }>;
    const executions = envelope.result?.executions;
    if (envelope.error || !Array.isArray(executions) || executions.length === 0) {
      return { state: "unknown", notifications: [] };
    }
    const states = executions.map((execution) =>
      String(execution.vmstate ?? execution.state ?? "").trim().toUpperCase(),
    );
    const state = states.some((entry) => entry.includes("FAULT"))
      ? "fault"
      : states.every((entry) => entry.includes("HALT"))
        ? "halt"
        : "unknown";
    return {
      state,
      notifications: executions.flatMap((execution) =>
        (execution.notifications ?? [])
          .map(parseNotification)
          .filter(
            (notification): notification is EventTicketNotification =>
              Boolean(notification),
          ),
      ),
    };
  } catch {
    return { state: "unknown", notifications: [] };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export function findEventTicketNotification(
  outcome: EventTicketTransactionOutcome,
  contractValue: unknown,
  eventNameValue: unknown,
): EventTicketNotification | null {
  const contract = normalizeScriptHash(String(contractValue ?? ""));
  const eventName = String(eventNameValue ?? "").trim();
  if (!contract || !eventName) return null;
  return (
    outcome.notifications.find(
      (notification) =>
        notification.contract === contract && notification.eventName === eventName,
    ) ?? null
  );
}

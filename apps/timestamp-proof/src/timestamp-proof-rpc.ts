import { GAS_HASH, getRpcUrl } from "@shared/constants/rpc";
import { addressToScriptHash, normalizeScriptHash, parseHash160, parseStackItem } from "@shared/utils/neo";

export type TimestampProofNetwork = "neo-n3-mainnet" | "neo-n3-testnet";
export type TimestampProofReceiptStatus =
  | "confirmed"
  | "pending"
  | "fault"
  | "mismatch"
  | "unreachable";

export interface TimestampProofReceipt {
  status: TimestampProofReceiptStatus;
  digest: string;
  blockTime: number;
  reason: string;
}

type FetchLike = typeof fetch;
type RpcEnvelope<T> = {
  result?: T;
  error?: { code?: number; message?: string };
};

type RpcExecution = {
  vmstate?: string;
  exception?: string | null;
  notifications?: Array<{
    contract?: string;
    eventname?: string;
    event_name?: string;
    state?: unknown;
  }>;
};

type ApplicationLog = { executions?: RpcExecution[] };
type RawTransaction = {
  script?: string;
  blocktime?: number;
  block_time?: number;
  confirmations?: number;
};

const TXID_RE = /^0x[0-9a-f]{64}$/;
const DIGEST_RE = /^[0-9a-f]{64}$/;
const ANCHOR_RE = /timestamp-proof:([0-9a-f]{64})/gi;

export function normalizeTimestampProofNetwork(value: unknown): TimestampProofNetwork | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "neo-n3-mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "neo-n3-testnet";
  return null;
}

export function normalizeTimestampProofTxid(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  return TXID_RE.test(raw) ? raw : "";
}

function isUnknownTransactionError(error: RpcEnvelope<unknown>["error"]): boolean {
  if (!error) return false;
  const message = String(error.message ?? "").toLowerCase();
  return error.code === -100 || /unknown transaction|not found|does not exist/.test(message);
}

function rpcNetwork(network: TimestampProofNetwork): "mainnet" | "testnet" {
  return network === "neo-n3-testnet" ? "testnet" : "mainnet";
}

async function rpcCall<T>(
  network: TimestampProofNetwork,
  method: string,
  params: unknown[],
  fetcher: FetchLike,
): Promise<RpcEnvelope<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetcher(getRpcUrl(rpcNetwork(network)), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RPC ${response.status}`);
    return await response.json() as RpcEnvelope<T>;
  } finally {
    clearTimeout(timer);
  }
}

function decodeScript(value: unknown): Uint8Array | null {
  const source = String(value ?? "").trim();
  if (!source) return null;
  const hex = source.startsWith("0x") ? source.slice(2) : source;
  if (/^[0-9a-f]+$/i.test(hex) && hex.length % 2 === 0) {
    return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
  }
  try {
    const binary = atob(source);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function markerDigests(script: unknown): string[] {
  const bytes = decodeScript(script);
  if (!bytes) return [];
  const text = new TextDecoder().decode(bytes);
  return Array.from(text.matchAll(ANCHOR_RE), (match) => String(match[1] ?? "").toLowerCase());
}

function eventSlots(state: unknown): unknown[] {
  if (Array.isArray(state)) return state;
  if (!state || typeof state !== "object") return [];
  const typed = state as { value?: unknown };
  return Array.isArray(typed.value) ? typed.value : [];
}

function slotHash(value: unknown): string {
  const parsed = parseHash160(value);
  if (parsed) {
    const normalized = normalizeScriptHash(parsed);
    return /^0x[0-9a-f]{40}$/.test(normalized) ? normalized : "";
  }
  const primitive = parseStackItem(value);
  if (typeof primitive !== "string") return "";
  const decoded = parseHash160(primitive);
  const normalized = normalizeScriptHash(decoded || primitive);
  return /^0x[0-9a-f]{40}$/.test(normalized) ? normalized : "";
}

function slotAmount(value: unknown): bigint | null {
  const parsed = parseStackItem(value);
  try {
    if (typeof parsed === "number" && Number.isSafeInteger(parsed)) return BigInt(parsed);
    if (typeof parsed === "string" && /^-?\d+$/.test(parsed)) return BigInt(parsed);
  } catch {
    return null;
  }
  return null;
}

function matchesZeroSelfTransfer(executions: RpcExecution[], expectedAddress?: string): boolean {
  const expectedAddressValue = String(expectedAddress ?? "").trim();
  const expectedHashValue = expectedAddressValue ? addressToScriptHash(expectedAddressValue) : "";
  if (expectedAddressValue && !expectedHashValue) return false;
  const expectedHash = expectedHashValue ? normalizeScriptHash(expectedHashValue) : "";
  return executions.some((execution) =>
    (execution.notifications ?? []).some((notification) => {
      if (normalizeScriptHash(String(notification.contract ?? "")) !== normalizeScriptHash(GAS_HASH)) {
        return false;
      }
      if (String(notification.eventname ?? notification.event_name ?? "") !== "Transfer") return false;
      const slots = eventSlots(notification.state);
      const from = slotHash(slots[0]);
      const to = slotHash(slots[1]);
      const amount = slotAmount(slots[2]);
      if (!from || !to || from !== to || amount !== 0n) return false;
      return !expectedHash || from === expectedHash;
    }),
  );
}

export async function inspectTimestampProofAnchor(
  input: {
    network: TimestampProofNetwork;
    txid: string;
    expectedDigest?: string;
    expectedAddress?: string;
  },
  fetcher: FetchLike = fetch,
): Promise<TimestampProofReceipt> {
  const txid = normalizeTimestampProofTxid(input.txid);
  const expectedDigest = String(input.expectedDigest ?? "").trim().toLowerCase();
  if (!txid || (expectedDigest && !DIGEST_RE.test(expectedDigest))) {
    return { status: "mismatch", digest: "", blockTime: 0, reason: "invalid-reference" };
  }

  try {
    const logResponse = await rpcCall<ApplicationLog>(input.network, "getapplicationlog", [txid], fetcher);
    if (isUnknownTransactionError(logResponse.error)) {
      return { status: "pending", digest: "", blockTime: 0, reason: "receipt-pending" };
    }
    if (logResponse.error || !logResponse.result) {
      return { status: "unreachable", digest: "", blockTime: 0, reason: "receipt-unavailable" };
    }
    const executions = logResponse.result.executions ?? [];
    const states = executions.map((execution) => String(execution.vmstate ?? "").toUpperCase());
    if (states.some((state) => state.includes("FAULT"))) {
      const reason = executions.find((execution) =>
        String(execution.vmstate ?? "").toUpperCase().includes("FAULT"),
      )?.exception;
      return { status: "fault", digest: "", blockTime: 0, reason: String(reason || "vm-fault") };
    }
    if (states.length === 0 || states.some((state) => !state.includes("HALT"))) {
      return { status: "unreachable", digest: "", blockTime: 0, reason: "receipt-incomplete" };
    }

    const rawResponse = await rpcCall<RawTransaction>(input.network, "getrawtransaction", [txid, true], fetcher);
    if (isUnknownTransactionError(rawResponse.error)) {
      return { status: "pending", digest: "", blockTime: 0, reason: "transaction-pending" };
    }
    if (rawResponse.error || !rawResponse.result) {
      return { status: "unreachable", digest: "", blockTime: 0, reason: "transaction-unavailable" };
    }
    const digests = markerDigests(rawResponse.result.script);
    const digest = digests.length === 1 ? digests[0] ?? "" : "";
    const transferMatched = matchesZeroSelfTransfer(executions, input.expectedAddress);
    if (digests.length !== 1 || !digest || (expectedDigest && digest !== expectedDigest) || !transferMatched) {
      return { status: "mismatch", digest, blockTime: 0, reason: "anchor-binding-mismatch" };
    }
    const blockTimeRaw = Number(rawResponse.result.blocktime ?? rawResponse.result.block_time ?? 0);
    const blockTime = Number.isFinite(blockTimeRaw) && blockTimeRaw > 0
      ? blockTimeRaw > 10_000_000_000
        ? blockTimeRaw
        : blockTimeRaw * 1_000
      : 0;
    if (!blockTime) {
      return { status: "unreachable", digest, blockTime: 0, reason: "block-time-unavailable" };
    }
    return {
      status: "confirmed",
      digest,
      blockTime,
      reason: "confirmed",
    };
  } catch {
    return { status: "unreachable", digest: "", blockTime: 0, reason: "rpc-unreachable" };
  }
}

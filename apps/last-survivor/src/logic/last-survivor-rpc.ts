import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import { parseStackItem } from "@shared/utils/neo";

export type LastSurvivorTransactionState = "halt" | "fault" | "unknown";

export interface LastSurvivorTransactionOutcome {
  state: LastSurvivorTransactionState;
  event: unknown | null;
}

const TXID_PATTERN = /^0x[0-9a-f]{64}$/;
const HASH160_PATTERN = /^0x[0-9a-f]{40}$/;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNetwork(value: unknown): "mainnet" | "testnet" | "" {
  const network = clean(value).toLowerCase();
  if (network === "mainnet" || network === "neo-n3-mainnet") return "mainnet";
  if (network === "testnet" || network === "neo-n3-testnet") return "testnet";
  return "";
}

function normalizeHash(value: unknown): string {
  const hash = clean(value).toLowerCase();
  return HASH160_PATTERN.test(hash) ? hash : "";
}

function parsedNotification(notification: unknown): unknown | null {
  if (!notification || typeof notification !== "object") return null;
  const rawState = (notification as { state?: unknown }).state;
  const slots = Array.isArray(rawState)
    ? rawState
    : rawState && typeof rawState === "object" && "value" in rawState &&
        Array.isArray((rawState as { value?: unknown }).value)
      ? (rawState as { value: unknown[] }).value
      : null;
  return slots ? { state: slots.map((slot) => ({ value: parseStackItem(slot) })) } : null;
}

/** Read one authoritative VM outcome without converting timeout/transport failure into FAULT. */
export async function readLastSurvivorTransactionOutcome(
  networkValue: unknown,
  txidValue: unknown,
  eventNameValue: unknown,
  contractHashValue: unknown,
): Promise<LastSurvivorTransactionOutcome> {
  const network = normalizeNetwork(networkValue);
  const txid = clean(txidValue).toLowerCase();
  const eventName = clean(eventNameValue);
  const contractHash = normalizeHash(contractHashValue);
  if (!network || !TXID_PATTERN.test(txid) || !eventName || !contractHash) {
    return { state: "unknown", event: null };
  }
  try {
    const response = await fetchWithTimeout(`https://api.n3index.dev/${network}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getapplicationlog", params: [txid] }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return { state: "unknown", event: null };
    const payload = await response.json() as {
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
      error?: unknown;
    };
    if (payload.error) return { state: "unknown", event: null };
    const executions = payload.result?.executions ?? [];
    const states = executions.map((item) => clean(item.vmstate).toUpperCase()).filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) return { state: "fault", event: null };
    if (!(states.length > 0 && states.every((state) => state.includes("HALT")))) {
      return { state: "unknown", event: null };
    }
    const notification = executions.flatMap((item) => item.notifications ?? []).find((item) => {
      if (!item || typeof item !== "object") return false;
      const record = item as { contract?: unknown; eventname?: unknown };
      return normalizeHash(record.contract) === contractHash && clean(record.eventname) === eventName;
    });
    return { state: "halt", event: parsedNotification(notification) };
  } catch {
    return { state: "unknown", event: null };
  }
}

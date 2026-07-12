import type { MiniAppFramework } from "@shared/react";
import { GAS_HASH, getMiniAppContractHash, resolveNeoNetwork } from "@shared/constants";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import {
  addressToScriptHash,
  ownerMatchesAddress,
  parseHash160,
  parseStackItem,
} from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";

export const TIME_CAPSULE_APP_ID = "miniapp-time-capsule";
export const TIME_CAPSULE_EVENT_WAIT_MS = 30_000;

export type TimeCapsuleNetwork = "mainnet" | "testnet";
export type TimeCapsulePendingKind = "create" | "reveal" | "fish" | "withdraw-credit";
export type TimeCapsulePendingStage = "payment" | "action";
export type TimeCapsuleEventName = "Buried" | "Revealed" | "Fished" | "CreditWithdrawn";

export interface TimeCapsuleChainContext {
  network: TimeCapsuleNetwork;
  contractHash: string;
}

/**
 * Minimum durable recovery envelope. The message itself is deliberately not
 * persisted here: it remains in the existing content-hash keyed local vault.
 */
export interface PendingTimeCapsuleOperation {
  version: 1;
  kind: TimeCapsulePendingKind;
  stage: TimeCapsulePendingStage;
  eventName: TimeCapsuleEventName;
  network: TimeCapsuleNetwork;
  contractHash: string;
  actorHash: string;
  createdAt: number;
  txid?: string;
  paymentTxid?: string;
  capsuleId?: string;
  targetOwnerHash?: string;
  amountFixed8: string;
  contentHash?: string;
  durationSeconds?: number;
  isPublic?: boolean;
  category?: number;
  title?: string;
  beforeCredit?: string;
}

export interface TimeCapsuleTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  event: unknown | null;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function explicitNetwork(value: unknown): TimeCapsuleNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

export function normalizeTimeCapsuleHash(value: unknown): string {
  const raw = clean(value);
  if (/^0x[0-9a-fA-F]{40}$/.test(raw) && !/^0x0{40}$/i.test(raw)) {
    return raw.toLowerCase();
  }
  const fromAddress = addressToScriptHash(raw);
  if (/^0x[0-9a-fA-F]{40}$/.test(fromAddress) && !/^0x0{40}$/i.test(fromAddress)) {
    return fromAddress.toLowerCase();
  }
  const parsed = parseHash160(raw);
  return /^0x[0-9a-fA-F]{40}$/.test(parsed) && !/^0x0{40}$/i.test(parsed)
    ? parsed.toLowerCase()
    : "";
}

export function timeCapsuleAccountMatches(value: unknown, expected: string): boolean {
  const normalizedExpected = normalizeTimeCapsuleHash(expected);
  if (!normalizedExpected) return false;
  const normalizedValue = normalizeTimeCapsuleHash(value);
  return normalizedValue === normalizedExpected || ownerMatchesAddress(clean(value), normalizedExpected);
}

function validTxid(value: unknown): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(clean(value));
}

function positiveInteger(value: unknown): boolean {
  return /^[1-9]\d*$/.test(clean(value));
}

function positiveFixed8(value: unknown): boolean {
  const normalized = clean(value);
  return /^\d+$/.test(normalized) && BigInt(normalized) > 0n;
}

function eventNameFor(kind: TimeCapsulePendingKind): TimeCapsuleEventName {
  if (kind === "create") return "Buried";
  if (kind === "reveal") return "Revealed";
  if (kind === "fish") return "Fished";
  return "CreditWithdrawn";
}

export function isPendingTimeCapsuleOperation(value: unknown): value is PendingTimeCapsuleOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingTimeCapsuleOperation> & Record<string, unknown>;
  const kinds: TimeCapsulePendingKind[] = ["create", "reveal", "fish", "withdraw-credit"];
  if (
    pending.version !== 1 ||
    !kinds.includes(pending.kind as TimeCapsulePendingKind) ||
    !["payment", "action"].includes(clean(pending.stage)) ||
    pending.eventName !== eventNameFor(pending.kind as TimeCapsulePendingKind) ||
    !explicitNetwork(pending.network) ||
    !normalizeTimeCapsuleHash(pending.contractHash) ||
    !normalizeTimeCapsuleHash(pending.actorHash) ||
    !positiveFixed8(pending.amountFixed8) ||
    !Number.isFinite(pending.createdAt) ||
    Number(pending.createdAt) <= 0
  ) return false;
  if (pending.stage === "payment") {
    if (pending.kind !== "create" || !validTxid(pending.paymentTxid)) return false;
  } else if (!validTxid(pending.txid)) {
    return false;
  }
  if (pending.kind === "create") {
    return /^[0-9a-f]{64}$/.test(clean(pending.contentHash)) &&
      Number.isInteger(pending.durationSeconds) &&
      Number(pending.durationSeconds) >= 86_400 &&
      Number(pending.durationSeconds) <= 3650 * 86_400 &&
      typeof pending.isPublic === "boolean" &&
      Number.isInteger(pending.category) &&
      Number(pending.category) >= 1 &&
      Number(pending.category) <= 5 &&
      clean(pending.title).length > 0 &&
      clean(pending.title).length <= 100;
  }
  if (pending.kind === "withdraw-credit") return positiveFixed8(pending.beforeCredit);
  if (!positiveInteger(pending.capsuleId)) return false;
  return pending.kind !== "fish" || Boolean(normalizeTimeCapsuleHash(pending.targetOwnerHash));
}

export async function requireCanonicalTimeCapsuleContext(
  app: MiniAppFramework,
  errorMessage = "chainContextMismatch",
): Promise<TimeCapsuleChainContext> {
  const launchNetwork = explicitNetwork(app.platform.launch.network);
  let detectedNetwork: TimeCapsuleNetwork | "" = "";
  try {
    detectedNetwork = explicitNetwork(await app.chain.detectNetwork?.());
  } catch {
    // A valid launch boundary may still be used when wallet detection is
    // temporarily unavailable. Unknown + unknown is rejected below.
  }
  if (launchNetwork && detectedNetwork && launchNetwork !== detectedNetwork) {
    throw new Error(errorMessage);
  }
  const network = detectedNetwork || launchNetwork;
  if (!network) throw new Error(errorMessage);
  const configured = normalizeTimeCapsuleHash(app.chain.contractAddress.get());
  const expected = normalizeTimeCapsuleHash(
    getMiniAppContractHash(TIME_CAPSULE_APP_ID, resolveNeoNetwork(network)),
  );
  if (!configured || !expected || configured !== expected) throw new Error(errorMessage);
  return { network, contractHash: configured };
}

function stateArray(notification: unknown): unknown[] | null {
  if (!notification || typeof notification !== "object") return null;
  const state = (notification as { state?: unknown }).state;
  if (Array.isArray(state)) return state;
  if (state && typeof state === "object" && "value" in state) {
    const value = (state as { value?: unknown }).value;
    return Array.isArray(value) ? value : null;
  }
  return null;
}

function parsedNotification(notification: unknown): unknown | null {
  const state = stateArray(notification);
  if (!state) return null;
  return { state: state.map((item) => ({ value: parseStackItem(item) })) };
}

async function readApplicationLog(
  network: TimeCapsuleNetwork,
  targetTxid: string,
): Promise<Array<{ vmstate?: unknown; notifications?: unknown[] }> | null> {
  if (!validTxid(targetTxid)) return null;
  try {
    const response = await fetchWithTimeout(`https://api.n3index.dev/${network}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [targetTxid],
      }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
      error?: unknown;
    };
    return payload.error ? null : payload.result?.executions ?? [];
  } catch {
    return null;
  }
}

function vmOutcome(executions: Array<{ vmstate?: unknown }>): "halt" | "fault" | "unknown" {
  const states = executions.map((item) => clean(item.vmstate).toUpperCase()).filter(Boolean);
  if (states.some((state) => state.includes("FAULT"))) return "fault";
  if (states.length > 0 && states.every((state) => state.includes("HALT"))) return "halt";
  return "unknown";
}

/** Read an exact transaction event bound to the canonical Time Capsule contract. */
export async function readTimeCapsuleTransactionOutcome(
  network: TimeCapsuleNetwork,
  targetTxid: string,
  eventName: TimeCapsuleEventName,
  contractHash: string,
): Promise<TimeCapsuleTransactionOutcome> {
  const executions = await readApplicationLog(network, targetTxid);
  if (!executions) return { state: "unknown", event: null };
  const state = vmOutcome(executions);
  if (state !== "halt") return { state, event: null };
  const wanted = normalizeTimeCapsuleHash(contractHash);
  const notification = executions
    .flatMap((execution) => execution.notifications ?? [])
    .find((item) => {
      if (!item || typeof item !== "object") return false;
      const record = item as { contract?: unknown; eventname?: unknown };
      return clean(record.eventname) === eventName && normalizeTimeCapsuleHash(record.contract) === wanted;
    });
  return { state: "halt", event: parsedNotification(notification) };
}

/** Confirm the exact GAS transfer before resuming a prepaid create without repaying. */
export async function readTimeCapsulePaymentOutcome(
  pending: PendingTimeCapsuleOperation,
): Promise<TimeCapsuleTransactionOutcome> {
  if (pending.kind !== "create" || pending.stage !== "payment" || !pending.paymentTxid) {
    return { state: "unknown", event: null };
  }
  const executions = await readApplicationLog(pending.network, pending.paymentTxid);
  if (!executions) return { state: "unknown", event: null };
  const state = vmOutcome(executions);
  if (state !== "halt") return { state, event: null };
  const transfer = executions
    .flatMap((execution) => execution.notifications ?? [])
    .find((item) => {
      if (!item || typeof item !== "object") return false;
      const record = item as { contract?: unknown; eventname?: unknown };
      if (clean(record.eventname) !== "Transfer" || normalizeTimeCapsuleHash(record.contract) !== normalizeTimeCapsuleHash(GAS_HASH)) {
        return false;
      }
      const parsed = parsedNotification(item);
      const slots = stateArray(parsed);
      const value = (index: number) => {
        const slot = slots?.[index];
        return slot && typeof slot === "object" && "value" in slot
          ? (slot as { value?: unknown }).value
          : slot;
      };
      return timeCapsuleAccountMatches(value(0), pending.actorHash) &&
        timeCapsuleAccountMatches(value(1), pending.contractHash) &&
        parseBigInt(value(2)) === BigInt(pending.amountFixed8);
    });
  return { state: "halt", event: transfer ? parsedNotification(transfer) : null };
}

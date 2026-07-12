import { getExternalIntegrationConfig, type NeoNetwork } from "@shared/constants/rpc";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import {
  addressToScriptHash,
  normalizeScriptHash,
  parseHash160,
  parseStackItem,
} from "@shared/utils/neo";

export const AA_ACCOUNT_PENDING_KEY = "aa-account-registration:v1";
export const AA_ACCOUNT_CONFIRMATION_ATTEMPTS = 12;
export const AA_ACCOUNT_CONFIRMATION_DELAY_MS = 2_500;

export interface PendingAARegistration {
  version: 1;
  txid: string;
  network: NeoNetwork;
  coreHash: string;
  accountId: string;
  verifier: string;
  hook: string;
  backupOwner: string;
  escapeTimelock: number;
  createdAt: number;
}

export interface AARegistrationNotification {
  contract: string;
  eventName: string;
  values: unknown[];
}

export interface AARegistrationOutcome {
  state: "halt" | "fault" | "unknown";
  notifications: AARegistrationNotification[];
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeAAHash(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const normalized = raw.startsWith("N")
      ? addressToScriptHash(raw)
      : normalizeScriptHash(raw);
    return /^0x[0-9a-fA-F]{40}$/.test(normalized) && !/^0x0{40}$/i.test(normalized)
      ? normalized.toLowerCase()
      : "";
  } catch {
    return "";
  }
}

function eventHash(value: unknown): string {
  if (value && typeof value === "object" && "type" in value) {
    const type = clean((value as { type?: unknown }).type);
    if (type === "ByteString" || type === "ByteArray" || type === "Buffer") {
      return normalizeAAHash(parseHash160(value));
    }
    if (type === "Hash160") {
      return normalizeAAHash((value as { value?: unknown }).value);
    }
  }
  return normalizeAAHash(parseStackItem(value));
}

function explicitNetwork(value: unknown): NeoNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

export function isPendingAARegistration(value: unknown): value is PendingAARegistration {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingAARegistration>;
  return pending.version === 1 &&
    /^0x[0-9a-fA-F]{64}$/.test(clean(pending.txid)) &&
    Boolean(explicitNetwork(pending.network)) &&
    Boolean(normalizeAAHash(pending.coreHash)) &&
    Boolean(normalizeAAHash(pending.accountId)) &&
    Boolean(normalizeAAHash(pending.verifier)) &&
    /^0x[0-9a-fA-F]{40}$/.test(clean(pending.hook)) &&
    Boolean(normalizeAAHash(pending.backupOwner)) &&
    Number.isSafeInteger(pending.escapeTimelock) &&
    Number(pending.escapeTimelock) >= 604_800 &&
    Number(pending.escapeTimelock) <= 7_776_000 &&
    Number.isFinite(pending.createdAt) &&
    Number(pending.createdAt) > 0;
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

function parseNotification(value: unknown): AARegistrationNotification | null {
  if (!value || typeof value !== "object") return null;
  const notification = value as {
    contract?: unknown;
    eventname?: unknown;
    eventName?: unknown;
  };
  const contract = normalizeAAHash(notification.contract);
  const eventName = clean(notification.eventname ?? notification.eventName);
  const values = stateArray(value);
  if (!contract || !eventName || !values) return null;
  return { contract, eventName, values };
}

export function registrationEventMatches(
  pending: PendingAARegistration,
  outcome: AARegistrationOutcome,
): boolean {
  if (outcome.state !== "halt") return false;
  return outcome.notifications.some((notification) =>
    notification.eventName === "AccountRegistered" &&
    normalizeAAHash(notification.contract) === normalizeAAHash(pending.coreHash) &&
    eventHash(notification.values[0]) === normalizeAAHash(pending.accountId) &&
    eventHash(notification.values[1]) === normalizeAAHash(pending.backupOwner) &&
    eventHash(notification.values[2]) === normalizeAAHash(pending.verifier) &&
    (eventHash(notification.values[3]) || "0x0000000000000000000000000000000000000000") ===
      clean(pending.hook).toLowerCase(),
  );
}

export async function readAARegistrationOutcome(
  pending: PendingAARegistration,
): Promise<AARegistrationOutcome> {
  if (!isPendingAARegistration(pending)) return { state: "unknown", notifications: [] };
  try {
    const response = await fetchWithTimeout(getExternalIntegrationConfig(pending.network).rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [pending.txid],
      }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return { state: "unknown", notifications: [] };
    const payload = await response.json() as {
      error?: unknown;
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
    };
    if (payload.error) return { state: "unknown", notifications: [] };
    const executions = payload.result?.executions ?? [];
    const states = executions.map((execution) => clean(execution.vmstate).toUpperCase()).filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) {
      return { state: "fault", notifications: [] };
    }
    if (!states.length || !states.every((state) => state.includes("HALT"))) {
      return { state: "unknown", notifications: [] };
    }
    return {
      state: "halt",
      notifications: executions
        .flatMap((execution) => execution.notifications ?? [])
        .map(parseNotification)
        .filter((notification): notification is AARegistrationNotification => notification !== null),
    };
  } catch {
    return { state: "unknown", notifications: [] };
  }
}

import { getRpcUrl, type NeoNetwork } from "@shared/constants/rpc";
import {
  addressToScriptHash,
  parseHash160,
  parseStackItem,
} from "@shared/utils/neo";

import {
  isDisplayableMemorialPhoto,
  type NormalizedMemorialDraft,
} from "./memorial-draft";

export const MEMORIAL_SHRINE_APP_ID = "miniapp-memorial-shrine";

export const MEMORIAL_SHRINE_CONTRACTS = {
  mainnet: "0xee7a548b71c69364fcb0e45a63a40f141b938e42",
  testnet: "0x87f0fe2ba69cd973a3274471234d3cc13ef943c5",
} as const satisfies Record<NeoNetwork, string>;

export const MEMORIAL_OFFERING_COSTS_FIXED8 = {
  1: "1000000",
  2: "2000000",
  3: "3000000",
  4: "5000000",
  5: "10000000",
  6: "50000000",
} as const;

export type MemorialOfferingType = keyof typeof MEMORIAL_OFFERING_COSTS_FIXED8;
export type MemorialWritePhase =
  | "idle"
  | "preparing"
  | "broadcast"
  | "checking"
  | "readback-pending"
  | "confirmed"
  | "fault"
  | "event-mismatch"
  | "storage-error";

export interface PendingCreateMemorialIntent extends NormalizedMemorialDraft {
  kind: "create";
  beforeMemorialCount: string;
}

export interface PendingTributeIntent {
  kind: "tribute";
  memorialId: number;
  offeringType: MemorialOfferingType;
  message: string;
  amountFixed8: string;
  receiptId: string;
  beforeTributeCount: string;
  paymentTxid?: string;
}

export type PendingMemorialIntent =
  | PendingCreateMemorialIntent
  | PendingTributeIntent;

export interface PendingMemorialWrite {
  version: 1;
  network: NeoNetwork;
  contractHash: string;
  wallet: string;
  walletHash: string;
  txid: string;
  intent: PendingMemorialIntent;
  createdAt: number;
}

export interface MemorialNotification {
  contract: string;
  eventName: string;
  values: unknown[];
}

export interface MemorialTransactionOutcome {
  state: "unknown" | "fault" | "halt";
  notifications: MemorialNotification[];
}

export interface MemorialRecoveryStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export type MemorialTransactionReader = (
  network: NeoNetwork,
  txid: string,
) => Promise<MemorialTransactionOutcome>;

const TXID_PATTERN = /^0x[0-9a-f]{64}$/i;
const HASH160_PATTERN = /^0x[0-9a-f]{40}$/i;
const NEO_ADDRESS_PATTERN = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;
const PENDING_KEY_PREFIX = "pending-write/v1/";
const STORAGE_PROBE_KEY = "pending-write/probe-v1";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function unwrapValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as { type?: unknown; value?: unknown };
  if (record.type === "Integer") return record.value;
  if (record.type === undefined && "value" in record) return unwrapValue(record.value);
  return value;
}

function mapField(value: unknown, key: string): unknown {
  if (value instanceof Map) return value.get(key);
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

export function normalizeMemorialNetwork(value: unknown): NeoNetwork | null {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return null;
}

export function normalizeMemorialTxid(value: unknown): string {
  const normalized = clean(value).toLowerCase();
  return TXID_PATTERN.test(normalized) ? normalized : "";
}

export function normalizeMemorialHash(value: unknown, allowZero = false): string {
  const raw = clean(value);
  let normalized = "";
  if (HASH160_PATTERN.test(raw)) {
    normalized = raw.toLowerCase();
  } else if (NEO_ADDRESS_PATTERN.test(raw)) {
    normalized = addressToScriptHash(raw).toLowerCase();
  } else {
    try {
      normalized = parseHash160(value).toLowerCase();
    } catch {
      normalized = "";
    }
  }
  if (!HASH160_PATTERN.test(normalized)) return "";
  return allowZero || !/^0x0{40}$/.test(normalized) ? normalized : "";
}

export function normalizeMemorialWallet(value: unknown): {
  address: string;
  hash: string;
} | null {
  const address = clean(value);
  if (!NEO_ADDRESS_PATTERN.test(address)) return null;
  const hash = normalizeMemorialHash(address);
  return hash ? { address, hash } : null;
}

function reverseHash(hash: string): string {
  const hex = hash.replace(/^0x/, "");
  return `0x${hex.match(/.{2}/g)?.reverse().join("") ?? ""}`;
}

export function memorialHashesMatch(left: unknown, right: unknown): boolean {
  const a = normalizeMemorialHash(left, true);
  const b = normalizeMemorialHash(right, true);
  return Boolean(a && b && (a === b || reverseHash(a) === b));
}

/** Strict integer parser: malformed or unavailable reads never become zero. */
export function parseMemorialInteger(value: unknown): bigint | null {
  const candidate = unwrapValue(value);
  if (typeof candidate === "bigint") return candidate;
  if (typeof candidate === "number") {
    return Number.isSafeInteger(candidate) ? BigInt(candidate) : null;
  }
  if (typeof candidate !== "string" || !/^-?\d+$/.test(candidate.trim())) return null;
  try {
    return BigInt(candidate.trim());
  } catch {
    return null;
  }
}

export function parseMemorialBoolean(value: unknown): boolean | null {
  const candidate = unwrapValue(value);
  if (candidate === true || candidate === 1 || candidate === "1" || candidate === "true") {
    return true;
  }
  if (candidate === false || candidate === 0 || candidate === "0" || candidate === "false") {
    return false;
  }
  return null;
}

export function isMemorialPaymentHubAvailable(value: unknown): boolean {
  return Boolean(normalizeMemorialHash(value));
}

export function normalizeTributeMessage(value: unknown): string | null {
  const message = clean(value);
  return message.length <= 280 ? message : null;
}

function exactText(value: unknown): string {
  if (value && typeof value === "object" && "type" in value) {
    const parsed = parseStackItem(value);
    return typeof parsed === "string" ? parsed : "";
  }
  const unwrapped = unwrapValue(value);
  return typeof unwrapped === "string" ? unwrapped : "";
}

function stateValues(notification: unknown): unknown[] | null {
  if (!notification || typeof notification !== "object") return null;
  const state = (notification as { state?: unknown }).state;
  if (Array.isArray(state)) return state;
  if (state && typeof state === "object" && "value" in state) {
    const values = (state as { value?: unknown }).value;
    return Array.isArray(values) ? values : null;
  }
  return null;
}

function parseNotification(value: unknown): MemorialNotification | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const contract = normalizeMemorialHash(record.contract ?? record.scripthash, true);
  const eventName = clean(record.eventname ?? record.eventName);
  const values = stateValues(value);
  return contract && eventName && values ? { contract, eventName, values } : null;
}

export async function readMemorialTransactionOutcome(
  network: NeoNetwork,
  transactionId: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<MemorialTransactionOutcome> {
  const txid = normalizeMemorialTxid(transactionId);
  if (!txid) return { state: "unknown", notifications: [] };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(getRpcUrl(network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [txid],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { state: "unknown", notifications: [] };
    const payload = await response.json() as {
      error?: unknown;
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
    };
    if (payload.error) return { state: "unknown", notifications: [] };
    const executions = payload.result?.executions ?? [];
    const states = executions
      .map((execution) => clean(execution.vmstate).toUpperCase())
      .filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) {
      return { state: "fault", notifications: [] };
    }
    if (states.length === 0 || !states.every((state) => state.includes("HALT"))) {
      return { state: "unknown", notifications: [] };
    }
    return {
      state: "halt",
      notifications: executions
        .flatMap((execution) => execution.notifications ?? [])
        .map(parseNotification)
        .filter((notification): notification is MemorialNotification => notification !== null),
    };
  } catch {
    return { state: "unknown", notifications: [] };
  } finally {
    clearTimeout(timeout);
  }
}

function validDraft(intent: PendingCreateMemorialIntent): boolean {
  const currentYear = new Date().getFullYear();
  return intent.name.length > 0 && intent.name.length <= 96 &&
    isDisplayableMemorialPhoto(intent.photoHash) && intent.relationship.length <= 64 &&
    intent.biography.length <= 600 && intent.obituary.length <= 600 &&
    Number.isSafeInteger(intent.birthYear) && intent.birthYear >= 0 && intent.birthYear <= currentYear &&
    Number.isSafeInteger(intent.deathYear) && intent.deathYear >= 0 && intent.deathYear <= currentYear &&
    (intent.birthYear === 0 || intent.deathYear === 0 || intent.birthYear <= intent.deathYear) &&
    parseMemorialInteger(intent.beforeMemorialCount) !== null &&
    BigInt(intent.beforeMemorialCount) >= 0n;
}

function validTribute(intent: PendingTributeIntent, network: NeoNetwork): boolean {
  const cost = MEMORIAL_OFFERING_COSTS_FIXED8[intent.offeringType];
  return Number.isSafeInteger(intent.memorialId) && intent.memorialId > 0 &&
    Boolean(cost) && intent.amountFixed8 === cost &&
    normalizeTributeMessage(intent.message) === intent.message &&
    parseMemorialInteger(intent.beforeTributeCount) !== null &&
    BigInt(intent.beforeTributeCount) >= 0n &&
    (network === "mainnet" ? /^[1-9]\d*$/.test(intent.receiptId) : intent.receiptId === "") &&
    (!intent.paymentTxid || Boolean(normalizeMemorialTxid(intent.paymentTxid)));
}

export function isPendingMemorialWrite(value: unknown): value is PendingMemorialWrite {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingMemorialWrite>;
  const network = normalizeMemorialNetwork(pending.network);
  const contractHash = normalizeMemorialHash(pending.contractHash);
  const wallet = normalizeMemorialWallet(pending.wallet);
  const txid = normalizeMemorialTxid(pending.txid);
  if (
    pending.version !== 1 || !network ||
    contractHash !== MEMORIAL_SHRINE_CONTRACTS[network] ||
    !wallet || wallet.hash !== normalizeMemorialHash(pending.walletHash) ||
    !txid || !Number.isFinite(pending.createdAt) || Number(pending.createdAt) <= 0 ||
    !pending.intent || typeof pending.intent !== "object"
  ) return false;
  return pending.intent.kind === "create"
    ? validDraft(pending.intent as PendingCreateMemorialIntent)
    : pending.intent.kind === "tribute"
      ? validTribute(pending.intent as PendingTributeIntent, network)
      : false;
}

export function pendingMemorialStorageKey(network: NeoNetwork): string {
  return `${PENDING_KEY_PREFIX}${network}`;
}

export function assertMemorialRecoveryStorage(storage: MemorialRecoveryStorage): void {
  const probe = { version: 1, token: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
  try {
    storage.set(STORAGE_PROBE_KEY, probe);
    const restored = storage.get<unknown>(STORAGE_PROBE_KEY, null);
    storage.delete(STORAGE_PROBE_KEY);
    if (JSON.stringify(restored) !== JSON.stringify(probe)) throw new Error("round-trip-mismatch");
    if (storage.get<unknown>(STORAGE_PROBE_KEY, null) !== null) throw new Error("delete-failed");
  } catch {
    try { storage.delete(STORAGE_PROBE_KEY); } catch { /* best effort */ }
    throw new Error("recoveryStorageUnavailable");
  }
}

export function readPendingMemorialWrite(
  storage: MemorialRecoveryStorage,
  network: NeoNetwork,
): { pending: PendingMemorialWrite | null; corrupted: boolean } {
  try {
    const raw = storage.get<unknown>(pendingMemorialStorageKey(network), null);
    if (raw === null || raw === undefined) return { pending: null, corrupted: false };
    return isPendingMemorialWrite(raw)
      ? { pending: raw, corrupted: false }
      : { pending: null, corrupted: true };
  } catch {
    return { pending: null, corrupted: true };
  }
}

export function persistPendingMemorialWrite(
  storage: MemorialRecoveryStorage,
  network: NeoNetwork,
  pending: PendingMemorialWrite | null,
): void {
  const key = pendingMemorialStorageKey(network);
  try {
    if (pending) {
      if (!isPendingMemorialWrite(pending) || pending.network !== network) {
        throw new Error("invalid-pending");
      }
      storage.set(key, pending);
      const restored = storage.get<unknown>(key, null);
      if (!isPendingMemorialWrite(restored) || JSON.stringify(restored) !== JSON.stringify(pending)) {
        throw new Error("round-trip-mismatch");
      }
      return;
    }
    storage.delete(key);
    if (storage.get<unknown>(key, null) !== null) throw new Error("delete-failed");
  } catch {
    throw new Error("recoveryStorageUnavailable");
  }
}

export function createdMemorialIdFromOutcome(
  pending: PendingMemorialWrite,
  outcome: MemorialTransactionOutcome,
): number | null {
  if (pending.intent.kind !== "create" || outcome.state !== "halt") return null;
  const before = parseMemorialInteger(pending.intent.beforeMemorialCount);
  if (before === null) return null;
  for (const notification of outcome.notifications) {
    if (
      notification.contract !== pending.contractHash ||
      notification.eventName !== "MemorialCreated"
    ) continue;
    const id = parseMemorialInteger(notification.values[0]);
    const creator = normalizeMemorialHash(notification.values[1]);
    const name = exactText(notification.values[2]);
    const deathYear = parseMemorialInteger(notification.values[3]);
    if (
      id !== null && id > before && id <= BigInt(Number.MAX_SAFE_INTEGER) &&
      memorialHashesMatch(creator, pending.walletHash) && name === pending.intent.name &&
      deathYear === BigInt(pending.intent.deathYear)
    ) return Number(id);
  }
  return null;
}

export function tributeEventMatches(
  pending: PendingMemorialWrite,
  outcome: MemorialTransactionOutcome,
): boolean {
  if (pending.intent.kind !== "tribute" || outcome.state !== "halt") return false;
  const intent = pending.intent;
  return outcome.notifications.some((notification) =>
    notification.contract === pending.contractHash &&
    notification.eventName === "TributePaid" &&
    parseMemorialInteger(notification.values[0]) === BigInt(intent.memorialId) &&
    memorialHashesMatch(notification.values[1], pending.walletHash) &&
    parseMemorialInteger(notification.values[2]) === BigInt(intent.offeringType),
  );
}

export function memorialReadbackMatches(
  raw: unknown,
  pending: PendingMemorialWrite,
  memorialId: number,
): boolean {
  if (pending.intent.kind !== "create") return false;
  const intent = pending.intent;
  return parseMemorialInteger(mapField(raw, "id")) === BigInt(memorialId) &&
    memorialHashesMatch(mapField(raw, "creator"), pending.walletHash) &&
    clean(mapField(raw, "deceasedName")) === intent.name &&
    clean(mapField(raw, "photoHash")) === intent.photoHash &&
    clean(mapField(raw, "relationship")) === intent.relationship &&
    parseMemorialInteger(mapField(raw, "birthYear")) === BigInt(intent.birthYear) &&
    parseMemorialInteger(mapField(raw, "deathYear")) === BigInt(intent.deathYear) &&
    clean(mapField(raw, "biography")) === intent.biography &&
    clean(mapField(raw, "obituary")) === intent.obituary;
}

export function tributeReadbackMatches(
  raw: unknown,
  pending: PendingMemorialWrite,
): boolean {
  if (pending.intent.kind !== "tribute") return false;
  const intent = pending.intent;
  const tributeId = parseMemorialInteger(mapField(raw, "id"));
  return tributeId !== null && tributeId > 0n &&
    parseMemorialInteger(mapField(raw, "memorialId")) === BigInt(intent.memorialId) &&
    memorialHashesMatch(mapField(raw, "visitor"), pending.walletHash) &&
    parseMemorialInteger(mapField(raw, "offeringType")) === BigInt(intent.offeringType) &&
    clean(mapField(raw, "message")) === intent.message;
}

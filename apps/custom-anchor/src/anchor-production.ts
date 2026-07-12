import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import {
  getExternalIntegrationConfig,
  type NeoNetwork,
} from "@shared/constants/rpc";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import {
  addressToScriptHash,
  normalizeScriptHash,
  parseHash160,
  parseStackItem,
} from "@shared/utils/neo";

export const CUSTOM_ANCHOR_APP_ID = "miniapp-custom-anchor";
export const CUSTOM_ANCHOR_PENDING_KEY = "pending-operation/v2";
export const CUSTOM_ANCHOR_STORAGE_PROBE_KEY = "pending-operation/probe";
export const CUSTOM_ANCHOR_REGISTRATION_FEE = "100000000";

/**
 * Pinned production deployments. The update counters are deliberately kept
 * beside the hashes because PlatformAnchor currently differs by network.
 */
export const CUSTOM_ANCHOR_BINDINGS = {
  mainnet: {
    contractHash: "0x02beeef6f65c6989a121c0a0e6b23190333edb98",
    updateCounter: 2,
  },
  testnet: {
    contractHash: "0xab079b4f9a0a2471d136392e25eb8e99898dcad0",
    updateCounter: 0,
  },
} as const satisfies Record<NeoNetwork, { contractHash: string; updateCounter: number }>;

export type AnchorOperationKind = "register" | "stake" | "withdraw" | "claim" | "recover-credit";
export type AnchorRegistrationStage =
  | "register-fee"
  | "register-anchor"
  | "register-accounts"
  | "register-agents";
export type AnchorOperationStage = AnchorRegistrationStage | "stake" | "withdraw" | "claim" | "recover-credit";
export type AnchorPendingPhase = "prepared" | "attempted" | "broadcast";

export interface PendingAnchorIntent {
  anchorAppId: string;
  amountBase?: string;
  asset?: "NEO" | "GAS";
  mode?: 1 | 2;
  candidateKeys?: string[];
  agentAccounts?: string[];
  beforeValue?: string;
  expectedValue?: string;
}

export interface PendingAnchorOperation {
  version: 2;
  kind: AnchorOperationKind;
  stage: AnchorOperationStage;
  phase: AnchorPendingPhase;
  network: NeoNetwork;
  contractHash: string;
  aaCoreHash: string;
  walletHash: string;
  txid: string;
  intent: PendingAnchorIntent;
  createdAt: number;
  updatedAt: number;
}

export interface AnchorStorage {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export interface AnchorNotification {
  contract: string;
  eventName: string;
  values: unknown[];
}

export interface AnchorTransactionOutcome {
  state: "halt" | "fault" | "unknown";
  notifications: AnchorNotification[];
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function explicitAnchorNetwork(value: unknown): NeoNetwork | "" {
  const normalized = clean(value).toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

export function normalizeAnchorHash(value: unknown, allowZero = false): string {
  const raw = clean(value);
  if (!raw) return "";
  try {
    let normalized = "";
    if (/^N[A-Za-z0-9]{33}$/.test(raw)) normalized = addressToScriptHash(raw);
    else if (/^0x[0-9a-fA-F]{40}$/.test(raw)) normalized = normalizeScriptHash(raw);
    else normalized = parseHash160(value);
    normalized = normalized.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(normalized)) return "";
    return allowZero || !/^0x0{40}$/.test(normalized) ? normalized : "";
  } catch {
    return "";
  }
}

function normalizeChainHash(value: unknown, allowZero = false): string {
  const parsed = parseHash160(value).toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(parsed)) {
    return allowZero || !/^0x0{40}$/.test(parsed) ? parsed : "";
  }
  return normalizeAnchorHash(value, allowZero);
}

export function anchorHashesMatch(left: unknown, right: unknown): boolean {
  const a = normalizeAnchorHash(left, true);
  const b = normalizeAnchorHash(right, true);
  return Boolean(a && b && a === b);
}

/** Strict integer parser: malformed VM items never silently become zero. */
export function parseAnchorInteger(value: unknown): bigint | null {
  let candidate = value;
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    const record = candidate as Record<string, unknown>;
    if ("type" in record) {
      if (record.type !== "Integer") return null;
      candidate = record.value;
    } else if ("integer" in record) {
      candidate = record.integer;
    } else if ("result" in record) {
      candidate = record.result;
    } else if ("value" in record) {
      candidate = record.value;
    } else {
      return null;
    }
  }
  if (typeof candidate === "bigint") return candidate;
  if (typeof candidate === "number") {
    return Number.isSafeInteger(candidate) ? BigInt(candidate) : null;
  }
  const raw = clean(candidate);
  if (!/^-?\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export function parseAnchorNonNegative(value: unknown): bigint | null {
  const parsed = parseAnchorInteger(value);
  return parsed !== null && parsed >= 0n ? parsed : null;
}

export function formatAnchorWhole(value: bigint): string {
  if (value < 0n) return "—";
  return value.toLocaleString();
}

export function formatAnchorFixed(value: bigint, decimals = 8): string {
  if (value < 0n || !Number.isInteger(decimals) || decimals < 0) return "—";
  if (decimals === 0) return value.toLocaleString();
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole.toLocaleString()}.${fraction}` : whole.toLocaleString();
}

function validTxid(value: unknown): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(clean(value));
}

function validAnchorId(value: unknown): boolean {
  const text = clean(value);
  return text.length >= 1 && text.length <= 64;
}

function validBase(value: unknown, positive = false): boolean {
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) return false;
  return !positive || BigInt(raw) > 0n;
}

function validCandidate(value: unknown): boolean {
  return /^0[23][0-9a-fA-F]{64}$/.test(clean(value));
}

function isRegistrationStage(value: unknown): value is AnchorRegistrationStage {
  return ["register-fee", "register-anchor", "register-accounts", "register-agents"].includes(clean(value));
}

export function isPendingAnchorOperation(value: unknown): value is PendingAnchorOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingAnchorOperation>;
  const kinds: AnchorOperationKind[] = ["register", "stake", "withdraw", "claim", "recover-credit"];
  const phases: AnchorPendingPhase[] = ["prepared", "attempted", "broadcast"];
  if (
    pending.version !== 2 || !kinds.includes(pending.kind as AnchorOperationKind) ||
    !phases.includes(pending.phase as AnchorPendingPhase) || !explicitAnchorNetwork(pending.network) ||
    !normalizeAnchorHash(pending.contractHash) || !normalizeAnchorHash(pending.walletHash) ||
    (pending.phase === "broadcast" ? !validTxid(pending.txid) : clean(pending.txid) !== "") ||
    !Number.isFinite(pending.createdAt) || Number(pending.createdAt) <= 0 ||
    !Number.isFinite(pending.updatedAt) || Number(pending.updatedAt) < Number(pending.createdAt) ||
    !pending.intent || !validAnchorId(pending.intent.anchorAppId)
  ) return false;

  const binding = CUSTOM_ANCHOR_BINDINGS[pending.network as NeoNetwork];
  if (!anchorHashesMatch(pending.contractHash, binding.contractHash)) return false;

  if (pending.kind === "register") {
    const candidates = pending.intent.candidateKeys ?? [];
    const accounts = pending.intent.agentAccounts ?? [];
    const expectedAaCore = normalizeAnchorHash(
      getExternalIntegrationConfig(pending.network as NeoNetwork).contracts.aaCore,
    );
    return isRegistrationStage(pending.stage) && Boolean(expectedAaCore) &&
      anchorHashesMatch(pending.aaCoreHash, expectedAaCore) &&
      (pending.intent.mode === 1 || pending.intent.mode === 2) &&
      candidates.length === 21 && candidates.every(validCandidate) &&
      accounts.length === 21 && accounts.every((account) => Boolean(normalizeAnchorHash(account))) &&
      new Set(accounts.map((account) => normalizeAnchorHash(account))).size === 21;
  }

  if (clean(pending.aaCoreHash) !== "") return false;
  if (pending.kind === "recover-credit") {
    return pending.stage === "recover-credit" && (pending.intent.asset === "NEO" || pending.intent.asset === "GAS") &&
      validBase(pending.intent.amountBase, true) && validBase(pending.intent.beforeValue) && validBase(pending.intent.expectedValue);
  }
  if (pending.kind === "claim") {
    return pending.stage === "claim" && validBase(pending.intent.beforeValue, true) && pending.intent.expectedValue === "0";
  }
  return pending.stage === pending.kind && validBase(pending.intent.amountBase, true) &&
    validBase(pending.intent.beforeValue) && validBase(pending.intent.expectedValue);
}

export function assertAnchorStorage(storage: AnchorStorage): void {
  const probe = { version: 2, token: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
  try {
    storage.set(CUSTOM_ANCHOR_STORAGE_PROBE_KEY, probe);
    const restored = storage.get<unknown>(CUSTOM_ANCHOR_STORAGE_PROBE_KEY, null);
    storage.delete(CUSTOM_ANCHOR_STORAGE_PROBE_KEY);
    if (JSON.stringify(restored) !== JSON.stringify(probe)) throw new Error("round-trip-mismatch");
  } catch {
    try { storage.delete(CUSTOM_ANCHOR_STORAGE_PROBE_KEY); } catch { /* best effort */ }
    throw new Error("anchorRecoveryStorageUnavailable");
  }
}

export function readPendingAnchorOperation(storage: AnchorStorage): {
  pending: PendingAnchorOperation | null;
  corrupted: boolean;
} {
  let raw: unknown;
  try {
    raw = storage.get<unknown>(CUSTOM_ANCHOR_PENDING_KEY, null);
  } catch {
    return { pending: null, corrupted: true };
  }
  if (raw === null || raw === undefined) return { pending: null, corrupted: false };
  return isPendingAnchorOperation(raw)
    ? { pending: raw, corrupted: false }
    : { pending: null, corrupted: true };
}

export function persistPendingAnchorOperation(storage: AnchorStorage, pending: PendingAnchorOperation | null): void {
  try {
    if (pending) {
      if (!isPendingAnchorOperation(pending)) throw new Error("invalid-pending");
      storage.set(CUSTOM_ANCHOR_PENDING_KEY, pending);
      const restored = storage.get<unknown>(CUSTOM_ANCHOR_PENDING_KEY, null);
      if (!isPendingAnchorOperation(restored) || JSON.stringify(restored) !== JSON.stringify(pending)) {
        throw new Error("round-trip-mismatch");
      }
      return;
    }
    storage.delete(CUSTOM_ANCHOR_PENDING_KEY);
    if (storage.get<unknown>(CUSTOM_ANCHOR_PENDING_KEY, null) !== null) throw new Error("delete-failed");
  } catch {
    throw new Error("anchorRecoveryStorageUnavailable");
  }
}

function stateValues(notification: unknown): unknown[] | null {
  if (!notification || typeof notification !== "object") return null;
  const state = (notification as { state?: unknown }).state;
  if (Array.isArray(state)) return state;
  if (state && typeof state === "object" && "value" in state) {
    const value = (state as { value?: unknown }).value;
    return Array.isArray(value) ? value : null;
  }
  return null;
}

function parseNotification(value: unknown): AnchorNotification | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { contract?: unknown; eventname?: unknown; eventName?: unknown };
  const contract = normalizeAnchorHash(record.contract, true);
  const eventName = clean(record.eventname ?? record.eventName);
  const values = stateValues(value);
  return contract && eventName && values ? { contract, eventName, values } : null;
}

export async function readAnchorTransactionOutcome(
  network: NeoNetwork,
  transactionId: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<AnchorTransactionOutcome> {
  const txid = clean(transactionId).toLowerCase();
  if (!validTxid(txid)) return { state: "unknown", notifications: [] };
  try {
    const url = getExternalIntegrationConfig(network).rpcUrl;
    const init = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getapplicationlog", params: [txid] }),
      timeoutMs: 8_000,
    } satisfies RequestInit & { timeoutMs: number };
    const response = fetcher === globalThis.fetch
      ? await fetchWithTimeout(url, init)
      : await fetcher(url, init);
    if (!response.ok) return { state: "unknown", notifications: [] };
    const payload = await response.json() as {
      error?: unknown;
      result?: { executions?: Array<{ vmstate?: unknown; notifications?: unknown[] }> };
    };
    if (payload.error) return { state: "unknown", notifications: [] };
    const executions = payload.result?.executions ?? [];
    const states = executions.map((execution) => clean(execution.vmstate).toUpperCase()).filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) return { state: "fault", notifications: [] };
    if (!states.length || !states.every((state) => state.includes("HALT"))) {
      return { state: "unknown", notifications: [] };
    }
    return {
      state: "halt",
      notifications: executions
        .flatMap((execution) => execution.notifications ?? [])
        .map(parseNotification)
        .filter((notification): notification is AnchorNotification => notification !== null),
    };
  } catch {
    return { state: "unknown", notifications: [] };
  }
}

function eventText(value: unknown): string {
  const parsed = parseStackItem(value);
  return typeof parsed === "string" ? parsed.trim() : "";
}

function eventInteger(value: unknown): bigint | null {
  if (value && typeof value === "object" && "type" in value) {
    return parseAnchorInteger(value);
  }
  return parseAnchorInteger(parseStackItem(value));
}

function eventHash(value: unknown, allowZero = false): string {
  if (value && typeof value === "object" && "type" in value) {
    const record = value as { type?: unknown; value?: unknown };
    if (record.type === "Hash160") return normalizeAnchorHash(record.value, allowZero);
    return normalizeChainHash(value, allowZero);
  }
  return normalizeAnchorHash(parseStackItem(value), allowZero);
}

function eventCandidate(value: unknown): string {
  const parsed = clean(parseStackItem(value)).replace(/^0x/i, "").toLowerCase();
  return /^0[23][0-9a-f]{64}$/.test(parsed) ? parsed : "";
}

function findEvent(
  outcome: AnchorTransactionOutcome,
  contract: string,
  eventName: string,
  predicate: (values: unknown[]) => boolean,
): boolean {
  return outcome.notifications.some((notification) =>
    anchorHashesMatch(notification.contract, contract) &&
    notification.eventName === eventName && predicate(notification.values),
  );
}

function transferMatches(
  outcome: AnchorTransactionOutcome,
  token: string,
  from: string,
  to: string,
  amount: string,
): boolean {
  return findEvent(outcome, token, "Transfer", (values) =>
    eventHash(values[0], true) === normalizeAnchorHash(from, true) &&
    eventHash(values[1], true) === normalizeAnchorHash(to, true) &&
    eventInteger(values[2]) === BigInt(amount),
  );
}

/** Verify the exact contract event(s) promised by one persisted intent. */
export function pendingAnchorEventsMatch(
  pending: PendingAnchorOperation,
  outcome: AnchorTransactionOutcome,
): boolean {
  if (!isPendingAnchorOperation(pending) || outcome.state !== "halt") return false;
  const { contractHash, walletHash, intent } = pending;
  if (pending.stage === "register-fee") {
    return transferMatches(outcome, BLOCKCHAIN_CONSTANTS.GAS_HASH, walletHash, contractHash, CUSTOM_ANCHOR_REGISTRATION_FEE);
  }
  if (pending.stage === "register-anchor") {
    return findEvent(outcome, contractHash, "AnchorAppRegistered", (values) =>
      eventText(values[0]) === intent.anchorAppId &&
      eventInteger(values[1]) === BigInt(intent.mode ?? 0) &&
      eventHash(values[2]) === walletHash,
    );
  }
  if (pending.stage === "register-accounts") {
    const accounts = intent.agentAccounts ?? [];
    return accounts.every((account) => findEvent(outcome, pending.aaCoreHash, "AccountRegistered", (values) =>
      eventHash(values[0]) === normalizeAnchorHash(account) && eventHash(values[1]) === walletHash,
    ));
  }
  if (pending.stage === "register-agents") {
    const accounts = intent.agentAccounts ?? [];
    const candidates = intent.candidateKeys ?? [];
    return accounts.every((account, index) => findEvent(outcome, contractHash, "AnchorAgentRegistered", (values) =>
      eventText(values[0]) === intent.anchorAppId && eventInteger(values[1]) === BigInt(index + 1) &&
      eventHash(values[2]) === normalizeAnchorHash(account) && eventCandidate(values[3]) === candidates[index]?.toLowerCase(),
    ));
  }
  if (pending.stage === "stake") {
    return transferMatches(outcome, BLOCKCHAIN_CONSTANTS.NEO_HASH, walletHash, contractHash, intent.amountBase ?? "") &&
      findEvent(outcome, contractHash, "AnchorStakeChanged", (values) =>
        eventText(values[0]) === intent.anchorAppId && eventHash(values[1]) === walletHash &&
        eventInteger(values[2]) === BigInt(intent.expectedValue ?? "-1"),
      );
  }
  if (pending.stage === "withdraw") {
    return transferMatches(outcome, BLOCKCHAIN_CONSTANTS.NEO_HASH, contractHash, walletHash, intent.amountBase ?? "") &&
      findEvent(outcome, contractHash, "AnchorStakeChanged", (values) =>
        eventText(values[0]) === intent.anchorAppId && eventHash(values[1]) === walletHash &&
        eventInteger(values[2]) === BigInt(intent.expectedValue ?? "-1"),
      );
  }
  if (pending.stage === "claim") {
    const amount = intent.beforeValue ?? "";
    return transferMatches(outcome, BLOCKCHAIN_CONSTANTS.GAS_HASH, contractHash, walletHash, amount) &&
      findEvent(outcome, contractHash, "AnchorRewardsClaimed", (values) =>
        eventText(values[0]) === intent.anchorAppId && eventHash(values[1]) === walletHash && eventInteger(values[2]) === BigInt(amount),
      );
  }
  if (pending.stage === "recover-credit") {
    const token = intent.asset === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH;
    return transferMatches(outcome, token, contractHash, walletHash, intent.amountBase ?? "");
  }
  return false;
}

export function nextRegistrationStage(stage: AnchorRegistrationStage): AnchorRegistrationStage | "complete" {
  if (stage === "register-fee") return "register-anchor";
  if (stage === "register-anchor") return "register-accounts";
  if (stage === "register-accounts") return "register-agents";
  return "complete";
}

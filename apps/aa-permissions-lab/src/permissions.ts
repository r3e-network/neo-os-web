import { parseHash160, parseInvokeResult } from "@shared/utils/neo";
import { getExternalIntegrationConfig } from "@shared/constants/rpc";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";

export type PermissionNetwork = "mainnet" | "testnet";
export type PermissionLane = "verifier" | "hook";
export type PermissionOperation =
  | "install-verifier"
  | "propose-verifier"
  | "confirm-verifier"
  | "cancel-verifier"
  | "install-hook"
  | "propose-hook"
  | "confirm-hook"
  | "cancel-hook";
export type PermissionTransactionState = "halt" | "fault" | "unknown";

export interface PermissionSnapshot {
  network: PermissionNetwork;
  aaCore: string;
  accountId: string;
  verifier: string;
  hook: string;
  backupOwner: string;
  hasPendingVerifier: boolean;
  hasPendingHook: boolean;
  pendingVerifierUnlockAt: number;
  pendingHookUnlockAt: number;
  inspectedAt: number;
}

export interface PendingPermissionTransaction {
  version: 1;
  network: PermissionNetwork;
  aaCore: string;
  accountId: string;
  walletHash: string;
  operation: PermissionOperation;
  lane: PermissionLane;
  targetHash: string;
  previousHash: string;
  eventName: string;
  txid: string;
  submittedAt: number;
}

export interface PermissionProposalContext {
  version: 1;
  network: PermissionNetwork;
  aaCore: string;
  accountId: string;
  lane: PermissionLane;
  targetHash: string;
  previousHash: string;
  proposalTxid: string;
  observedAt: number;
}

const HASH160_PATTERN = /^0x[0-9a-f]{40}$/;
const TXID_PATTERN = /^0x[0-9a-f]{64}$/;
const PERMISSION_OPERATIONS = new Set<PermissionOperation>([
  "install-verifier",
  "propose-verifier",
  "confirm-verifier",
  "cancel-verifier",
  "install-hook",
  "propose-hook",
  "confirm-hook",
  "cancel-hook",
]);
const MAX_PENDING_TX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_PROPOSAL_CONTEXT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const ZERO_HASH = `0x${"0".repeat(40)}`;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export function explicitPermissionNetwork(value: unknown): PermissionNetwork | null {
  const raw = clean(value).toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet") return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet") return "testnet";
  return null;
}

export function normalizePermissionNetwork(value: unknown): PermissionNetwork {
  return explicitPermissionNetwork(value) ?? "mainnet";
}

export async function readPermissionTransactionState(
  network: PermissionNetwork,
  transactionId: string,
): Promise<PermissionTransactionState> {
  const txid = clean(transactionId).toLowerCase();
  if (!TXID_PATTERN.test(txid)) return "unknown";
  try {
    const response = await fetchWithTimeout(getExternalIntegrationConfig(network).rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getapplicationlog",
        params: [txid],
      }),
      timeoutMs: 8_000,
    });
    if (!response.ok) return "unknown";
    const payload = await response.json() as {
      error?: unknown;
      result?: { executions?: Array<{ vmstate?: unknown }> };
    };
    if (payload.error) return "unknown";
    const states = (payload.result?.executions ?? [])
      .map((execution) => clean(execution.vmstate).toUpperCase())
      .filter(Boolean);
    if (states.some((state) => state.includes("FAULT"))) return "fault";
    if (states.length && states.every((state) => state.includes("HALT"))) return "halt";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function normalizePermissionHash(value: unknown, allowZero = true): string | null {
  const raw = clean(value).toLowerCase();
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!HASH160_PATTERN.test(normalized)) return null;
  if (!allowZero && normalized === ZERO_HASH) return null;
  return normalized;
}

export function requirePermissionHash(value: unknown, allowZero = true) {
  const hash = normalizePermissionHash(value, allowZero);
  if (!hash) throw new Error("invalidHash");
  return hash;
}

export function normalizeVerifierParams(value: unknown) {
  const raw = clean(value).replace(/^0x/i, "").toLowerCase();
  if (!/^(?:[0-9a-f]{2})*$/.test(raw) || raw.length > 4096) {
    throw new Error("invalidParams");
  }
  return raw;
}

function assertReadableResult(raw: unknown, label: string) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const state = clean((raw as Record<string, unknown>).state).toUpperCase();
    if (state.includes("FAULT")) throw new Error(`permissionReadInvalid:${label}`);
  }
  // `parseInvokeResult` intentionally treats generic falsy input as absent,
  // but `false` and integer `0` are canonical successful permission values.
  const parsed = raw === false || raw === 0 ? raw : parseInvokeResult(raw);
  if (parsed === null || parsed === undefined) {
    throw new Error(`permissionReadInvalid:${label}`);
  }
  return parsed;
}

export function parsePermissionHash(raw: unknown, label: string, allowZero = true) {
  const value = assertReadableResult(raw, label);
  const hash = parseHash160(value).toLowerCase();
  if (!HASH160_PATTERN.test(hash)) throw new Error(`permissionReadInvalid:${label}`);
  if (!allowZero && hash === ZERO_HASH) throw new Error("accountNotRegistered");
  return hash === ZERO_HASH ? "" : hash;
}

export function parsePermissionBoolean(raw: unknown, label: string) {
  const value = assertReadableResult(raw, label);
  if (value === true || value === false) return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  throw new Error(`permissionReadInvalid:${label}`);
}

export function parsePermissionTimestamp(raw: unknown, label: string) {
  const value = assertReadableResult(raw, label);
  const text = clean(value);
  if (!/^\d+$/.test(text)) throw new Error(`permissionReadInvalid:${label}`);
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`permissionReadInvalid:${label}`);
  }
  return number;
}

export function validatePendingTimes(snapshot: PermissionSnapshot) {
  if (snapshot.hasPendingVerifier !== (snapshot.pendingVerifierUnlockAt > 0)) {
    throw new Error("permissionReadInvalid:pendingVerifier");
  }
  if (snapshot.hasPendingHook !== (snapshot.pendingHookUnlockAt > 0)) {
    throw new Error("permissionReadInvalid:pendingHook");
  }
  return snapshot;
}

export function isPermissionBindingCurrent(
  snapshot: PermissionSnapshot | null,
  network: PermissionNetwork,
  aaCore: string,
  accountId: string,
) {
  return Boolean(
    snapshot &&
    snapshot.network === network &&
    snapshot.aaCore === normalizePermissionHash(aaCore, false) &&
    snapshot.accountId === normalizePermissionHash(accountId, false),
  );
}

export function isPermissionUnlockReady(unlockAt: number, now = Date.now()) {
  return Number.isSafeInteger(unlockAt) && unlockAt > 0 && now >= unlockAt;
}

export function formatPermissionUnlock(unlockAt: number, locale = "en") {
  if (!Number.isSafeInteger(unlockAt) || unlockAt <= 0) return "";
  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(unlockAt));
}

export function permissionOperationLane(operation: PermissionOperation): PermissionLane {
  return operation.includes("verifier") ? "verifier" : "hook";
}

export function permissionContractOperation(operation: PermissionOperation) {
  switch (operation) {
    case "install-verifier":
    case "propose-verifier":
      return "updateVerifier";
    case "confirm-verifier":
      return "confirmVerifierUpdate";
    case "cancel-verifier":
      return "cancelVerifierUpdate";
    case "install-hook":
    case "propose-hook":
      return "updateHook";
    case "confirm-hook":
      return "confirmHookUpdate";
    case "cancel-hook":
      return "cancelHookUpdate";
  }
}

export function permissionOperationEvent(operation: PermissionOperation) {
  if (operation === "install-verifier" || operation === "confirm-verifier") {
    return "VerifierUpdateConfirmed";
  }
  if (operation === "propose-verifier") return "VerifierUpdateInitiated";
  if (operation === "cancel-verifier") return "VerifierUpdateCancelled";
  if (operation === "install-hook" || operation === "confirm-hook") {
    return "HookUpdateConfirmed";
  }
  if (operation === "propose-hook") return "HookUpdateInitiated";
  return "HookUpdateCancelled";
}

export function buildPendingPermissionTransaction(input: {
  network: PermissionNetwork;
  aaCore: string;
  accountId: string;
  walletHash: string;
  operation: PermissionOperation;
  targetHash?: string;
  previousHash?: string;
  txid: string;
  submittedAt?: number;
}): PendingPermissionTransaction {
  if (
    (input.network !== "mainnet" && input.network !== "testnet") ||
    !PERMISSION_OPERATIONS.has(input.operation)
  ) {
    throw new Error("invalidPendingTransaction");
  }
  const aaCore = requirePermissionHash(input.aaCore, false);
  const accountId = requirePermissionHash(input.accountId, false);
  const walletHash = requirePermissionHash(input.walletHash, false);
  const lane = permissionOperationLane(input.operation);
  const targetHash = input.targetHash ? requirePermissionHash(input.targetHash) : "";
  const previousHash = input.previousHash ? requirePermissionHash(input.previousHash) : "";
  const txid = clean(input.txid).toLowerCase();
  const submittedAt = input.submittedAt ?? Date.now();
  if (!TXID_PATTERN.test(txid) || !Number.isSafeInteger(submittedAt) || submittedAt <= 0) {
    throw new Error("invalidPendingTransaction");
  }
  return {
    version: 1,
    network: input.network,
    aaCore,
    accountId,
    walletHash,
    operation: input.operation,
    lane,
    targetHash,
    previousHash,
    eventName: permissionOperationEvent(input.operation),
    txid,
    submittedAt,
  };
}

export function restorePendingPermissionTransaction(
  value: unknown,
  network: PermissionNetwork,
  aaCore: string,
  now = Date.now(),
): PendingPermissionTransaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const record = value as PendingPermissionTransaction;
    if (
      record.version !== 1 ||
      record.network !== network ||
      now - record.submittedAt > MAX_PENDING_TX_AGE_MS ||
      record.submittedAt > now + 60_000
    ) return null;
    const restored = buildPendingPermissionTransaction(record);
    return restored.aaCore === normalizePermissionHash(aaCore, false) ? restored : null;
  } catch {
    return null;
  }
}

export function permissionTransactionSatisfied(
  record: PendingPermissionTransaction,
  snapshot: PermissionSnapshot,
  eventConfirmed: boolean,
) {
  if (
    snapshot.network !== record.network ||
    snapshot.aaCore !== record.aaCore ||
    snapshot.accountId !== record.accountId
  ) return false;
  const pending = record.lane === "verifier"
    ? snapshot.hasPendingVerifier
    : snapshot.hasPendingHook;
  const current = record.lane === "verifier" ? snapshot.verifier : snapshot.hook;

  if (record.operation.startsWith("install-")) {
    return Boolean(record.targetHash) && !pending && current === record.targetHash;
  }
  if (record.operation.startsWith("propose-")) {
    return eventConfirmed && pending;
  }
  if (record.operation.startsWith("confirm-")) {
    return eventConfirmed && !pending && (!record.targetHash || current === record.targetHash);
  }
  return eventConfirmed && !pending && (!record.previousHash || current === record.previousHash);
}

export function buildProposalContext(
  record: PendingPermissionTransaction,
  observedAt = Date.now(),
): PermissionProposalContext {
  if (!record.operation.startsWith("propose-") || !record.targetHash) {
    throw new Error("invalidProposalContext");
  }
  return {
    version: 1,
    network: record.network,
    aaCore: record.aaCore,
    accountId: record.accountId,
    lane: record.lane,
    targetHash: record.targetHash,
    previousHash: record.previousHash,
    proposalTxid: record.txid,
    observedAt,
  };
}

export function restoreProposalContext(
  value: unknown,
  snapshot: PermissionSnapshot,
  now = Date.now(),
): PermissionProposalContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const context = value as PermissionProposalContext;
    if (
      context.version !== 1 ||
      context.network !== snapshot.network ||
      context.aaCore !== snapshot.aaCore ||
      context.accountId !== snapshot.accountId ||
      !TXID_PATTERN.test(clean(context.proposalTxid).toLowerCase()) ||
      !Number.isSafeInteger(context.observedAt) ||
      context.observedAt <= 0 ||
      context.observedAt > now + 60_000 ||
      now - context.observedAt > MAX_PROPOSAL_CONTEXT_AGE_MS
    ) return null;
    const targetHash = requirePermissionHash(context.targetHash);
    const previousHash = requirePermissionHash(context.previousHash);
    const stillPending = context.lane === "verifier"
      ? snapshot.hasPendingVerifier
      : snapshot.hasPendingHook;
    if (!stillPending) return null;
    return {
      ...context,
      targetHash,
      previousHash,
      proposalTxid: context.proposalTxid.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function shortPermissionHash(value: string, head = 8, tail = 6) {
  const text = clean(value);
  if (!text) return "";
  return text.length <= head + tail + 1 ? text : `${text.slice(0, head)}…${text.slice(-tail)}`;
}

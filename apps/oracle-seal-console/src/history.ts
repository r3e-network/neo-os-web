import {
  ORACLE_SEAL_PURPOSES,
  expectedOracleContract,
  isPreparedOracleSeal,
  type OracleSealErrorKey,
  type PreparedOracleSeal,
  type StoredOracleSealReceipt,
} from "./seal";

const PENDING_KEY = "pending-seal:v2";
const LEGACY_PENDING_KEY = "pending-seal:v1";
const RECEIPTS_KEY = "stored-receipts:v1";
const PROBE_KEY = "storage-probe:v1";
const MAX_RECEIPTS = 8;

export interface OracleSealStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export type PendingOracleSealState = "prepared" | "stored";

export interface PendingOracleSeal extends PreparedOracleSeal {
  version: 1 | 2;
  recoveryState?: PendingOracleSealState;
  createdAt: number;
  attempts: number;
  lastError?: OracleSealErrorKey;
  storedReceipt?: StoredOracleSealReceipt;
  storedAt?: number;
}

export interface StoredOracleSealRecord extends StoredOracleSealReceipt {
  storedAt: number;
}

export class OracleSealStorageError extends Error {
  readonly action: "probe" | "write" | "delete";

  constructor(action: "probe" | "write" | "delete", message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "OracleSealStorageError";
    this.action = action;
  }
}

function isSafeTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isErrorKey(value: unknown): value is OracleSealErrorKey {
  return [
    "sealErrorInput",
    "sealErrorTooLarge",
    "sealErrorKey",
    "sealErrorAlgorithm",
    "sealErrorEncrypt",
    "sealErrorService",
    "sealErrorStore",
    "sealErrorStorage",
    "sealErrorTimeout",
    "sealErrorGeneric",
  ].includes(String(value));
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function validSecretRef(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const reference = value.trim();
  return (
    reference.length > 0
    && reference.length <= 512
    && !/[\u0000-\u001f\u007f]/.test(reference)
    && !/^(?:0x)?0+$/i.test(reference)
    && !/^(?:null|undefined)$/i.test(reference)
  );
}

function isStoredReceiptPayload(value: unknown): value is StoredOracleSealReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const route = String(record.publicRoute ?? "");
  return (
    validSecretRef(record.secretRef)
    && typeof record.fingerprint === "string"
    && /^0x[0-9a-f]{64}$/i.test(record.fingerprint)
    && ORACLE_SEAL_PURPOSES.includes(record.purpose as never)
    && route.length <= 160
    && !/[\u0000-\u001f\u007f]/.test(route)
    && (record.network === "mainnet" || record.network === "testnet")
    && String(record.contract ?? "").toLowerCase() === expectedOracleContract(String(record.network))
    && record.algorithm === "X25519-HKDF-SHA256-AES-256-GCM"
  );
}

function receiptMatchesPrepared(
  receipt: StoredOracleSealReceipt,
  prepared: PreparedOracleSeal,
): boolean {
  return (
    receipt.fingerprint === prepared.fingerprint
    && receipt.purpose === prepared.purpose
    && receipt.publicRoute === prepared.publicRoute
    && receipt.network === prepared.network
    && receipt.contract.toLowerCase() === prepared.contract.toLowerCase()
    && receipt.algorithm === prepared.algorithm
  );
}

export function pendingOracleSealState(pending: PendingOracleSeal): PendingOracleSealState {
  return pending.version === 2 && pending.recoveryState === "stored"
    ? "stored"
    : "prepared";
}

export function isPendingOracleSeal(value: unknown): value is PendingOracleSeal {
  if (!isPreparedOracleSeal(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  const hasPlaintextField = ["payload", "json", "secret", "recipient", "plaintext"]
    .some((key) => Object.prototype.hasOwnProperty.call(record, key));
  if (
    hasPlaintextField
    || (record.version !== 1 && record.version !== 2)
    || !isSafeTimestamp(record.createdAt)
    || !Number.isSafeInteger(record.attempts)
    || Number(record.attempts) < 1
    || (record.lastError !== undefined && !isErrorKey(record.lastError))
  ) {
    return false;
  }

  if (record.version === 1) {
    return (
      (record.recoveryState === undefined || record.recoveryState === "prepared")
      && record.storedReceipt === undefined
      && record.storedAt === undefined
    );
  }
  if (record.recoveryState === "prepared") {
    return record.storedReceipt === undefined && record.storedAt === undefined;
  }
  if (record.recoveryState !== "stored" || !isSafeTimestamp(record.storedAt)) return false;
  return (
    isStoredReceiptPayload(record.storedReceipt)
    && receiptMatchesPrepared(record.storedReceipt, value)
  );
}

export function inspectPendingOracleSeal(store: OracleSealStore): {
  pending: PendingOracleSeal | null;
  malformed: boolean;
  legacy: boolean;
  unavailable: boolean;
} {
  try {
    const current = store.get<unknown>(PENDING_KEY, null);
    if (current !== null) {
      const valid = isPendingOracleSeal(current);
      return {
        pending: valid ? current : null,
        malformed: !valid,
        legacy: false,
        unavailable: false,
      };
    }
    const legacy = store.get<unknown>(LEGACY_PENDING_KEY, null);
    const valid = isPendingOracleSeal(legacy);
    return {
      pending: valid ? legacy : null,
      malformed: legacy !== null && !valid,
      legacy: legacy !== null,
      unavailable: false,
    };
  } catch {
    return { pending: null, malformed: false, legacy: false, unavailable: true };
  }
}

export function readPendingOracleSeal(store: OracleSealStore): PendingOracleSeal | null {
  return inspectPendingOracleSeal(store).pending;
}

export function assertOracleSealStorageAvailable(store: OracleSealStore): void {
  const marker = {
    version: 1,
    createdAt: Date.now(),
    nonce: Math.random().toString(36).slice(2),
  };
  try {
    store.set(PROBE_KEY, marker);
    if (!sameJson(store.get<unknown>(PROBE_KEY, null), marker)) {
      throw new OracleSealStorageError("probe", "Device recovery storage did not retain the probe");
    }
    store.delete(PROBE_KEY);
    if (store.get<unknown>(PROBE_KEY, null) !== null) {
      throw new OracleSealStorageError("probe", "Device recovery storage did not remove the probe");
    }
  } catch (error) {
    if (error instanceof OracleSealStorageError) throw error;
    throw new OracleSealStorageError("probe", "Device recovery storage is unavailable", error);
  }
}

export function savePendingOracleSeal(
  store: OracleSealStore,
  pending: PendingOracleSeal,
): PendingOracleSeal {
  if (!isPendingOracleSeal(pending)) {
    throw new OracleSealStorageError("write", "Invalid Oracle Seal recovery packet");
  }
  try {
    store.set(PENDING_KEY, pending);
    const stored = store.get<unknown>(PENDING_KEY, null);
    if (!isPendingOracleSeal(stored) || !sameJson(stored, pending)) {
      throw new OracleSealStorageError("write", "Device recovery storage did not retain the exact packet");
    }
    if (pending.version === 2) {
      store.delete(LEGACY_PENDING_KEY);
    }
    return stored;
  } catch (error) {
    if (error instanceof OracleSealStorageError) throw error;
    throw new OracleSealStorageError("write", "Unable to save the recovery packet", error);
  }
}

export function clearPendingOracleSeal(store: OracleSealStore): void {
  try {
    store.delete(PENDING_KEY);
    store.delete(LEGACY_PENDING_KEY);
    if (
      store.get<unknown>(PENDING_KEY, null) !== null
      || store.get<unknown>(LEGACY_PENDING_KEY, null) !== null
    ) {
      throw new OracleSealStorageError("delete", "Device recovery storage did not clear the packet");
    }
  } catch (error) {
    if (error instanceof OracleSealStorageError) throw error;
    throw new OracleSealStorageError("delete", "Unable to clear the recovery packet", error);
  }
}

export function markPendingOracleSealStored(
  pending: PendingOracleSeal,
  receipt: StoredOracleSealReceipt,
  storedAt = Date.now(),
): PendingOracleSeal {
  const next: PendingOracleSeal = {
    ...pending,
    version: 2,
    recoveryState: "stored",
    storedReceipt: receipt,
    storedAt,
  };
  if (!isPendingOracleSeal(next)) {
    throw new OracleSealStorageError("write", "Stored receipt does not match the recovery packet");
  }
  return next;
}

function isStoredReceipt(value: unknown): value is StoredOracleSealRecord {
  if (!isStoredReceiptPayload(value)) return false;
  return isSafeTimestamp((value as unknown as Record<string, unknown>).storedAt);
}

export function readStoredOracleSeals(store: OracleSealStore): StoredOracleSealRecord[] {
  try {
    const records = store.get<unknown>(RECEIPTS_KEY, []);
    if (!Array.isArray(records)) return [];
    return records.slice(0, MAX_RECEIPTS).filter(isStoredReceipt);
  } catch {
    return [];
  }
}

export function appendStoredOracleSeal(
  store: OracleSealStore,
  receipt: StoredOracleSealRecord,
): StoredOracleSealRecord[] {
  if (!isStoredReceipt(receipt)) {
    throw new OracleSealStorageError("write", "Invalid Oracle Seal storage receipt");
  }
  const next = [
    receipt,
    ...readStoredOracleSeals(store).filter((item) => item.fingerprint !== receipt.fingerprint),
  ].slice(0, MAX_RECEIPTS);
  try {
    store.set(RECEIPTS_KEY, next);
    const stored = readStoredOracleSeals(store);
    if (!sameJson(stored, next)) {
      throw new OracleSealStorageError("write", "Device receipt history did not retain the exact result");
    }
    return stored;
  } catch (error) {
    if (error instanceof OracleSealStorageError) throw error;
    throw new OracleSealStorageError("write", "Unable to save the storage receipt", error);
  }
}

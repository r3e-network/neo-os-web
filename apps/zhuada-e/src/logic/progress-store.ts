/**
 * Injected, DOM-independent persistence for progress and resumable runs.
 *
 * The engine receives a synchronous storage adapter. Standalone builds use
 * localStorage; the sandboxed host pre-hydrates a postMessage-backed mirror.
 * Migrations are backed up and written through immediately, every storage
 * failure is returned, and future schema versions are never overwritten.
 */

import {
  PROGRESS_SCHEMA_VERSION,
  createEmptyProgress,
  isProgressReadOnly,
  parseProgressResult,
  serializeProgress,
  type GooseProgress,
  type ProgressParseStatus,
} from "./progress";

export const PROGRESS_STORAGE_KEY = "zhuada-e:progress";
export const PROGRESS_BACKUP_KEY = "zhuada-e:progress:backup";
export const RUN_SNAPSHOT_STORAGE_KEY = "zhuada-e:run:v1";
export const RUN_SNAPSHOT_SCHEMA_VERSION = 1 as const;
export const DEFAULT_RUN_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1_000;

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StorageFailureReason =
  | "read-failed"
  | "write-failed"
  | "delete-failed";

export type StorageMutationResult =
  | { ok: true }
  | { ok: false; reason: StorageFailureReason; error: unknown };

function setItem(
  storage: StringStorage,
  key: string,
  value: string,
): StorageMutationResult {
  try {
    storage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "write-failed", error };
  }
}

function removeItem(
  storage: StringStorage,
  key: string,
): StorageMutationResult {
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "delete-failed", error };
  }
}

export type StoredProgressLoadStatus = ProgressParseStatus | "storage-error";

export interface StoredProgressLoadResult {
  progress: GooseProgress;
  status: StoredProgressLoadStatus;
  sourceVersion: number | null;
  readOnly: boolean;
  /** Raw pre-v3/invalid data copied byte-for-byte before any replacement. */
  backup: StorageMutationResult | null;
  /** Immediate v3 write-through for successful v1/v2 migrations. */
  writeBack: StorageMutationResult | null;
  /** Read failure when status is storage-error. */
  failure: StorageMutationResult | null;
}

/**
 * Load progress and durably complete v1/v2 migrations. A migration only
 * replaces the primary key after its byte-for-byte backup succeeds.
 */
export function loadStoredProgress(
  storage: StringStorage,
): StoredProgressLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(PROGRESS_STORAGE_KEY);
  } catch (error) {
    return {
      progress: createEmptyProgress(),
      status: "storage-error",
      sourceVersion: null,
      readOnly: false,
      backup: null,
      writeBack: null,
      failure: { ok: false, reason: "read-failed", error },
    };
  }

  const parsed = parseProgressResult(raw);
  if (!raw || parsed.status === "current" || parsed.status === "future-version") {
    return {
      ...parsed,
      backup: null,
      writeBack: null,
      failure: null,
    };
  }

  // Preserve corrupt input too. It is not auto-replaced because a later build
  // may know how to recover it; callers still receive safe empty progress.
  const backup = setItem(storage, PROGRESS_BACKUP_KEY, raw);
  if (parsed.status !== "migrated" || !backup.ok) {
    return {
      ...parsed,
      backup,
      writeBack: null,
      failure: null,
    };
  }

  let serialized: string;
  try {
    serialized = serializeProgress(parsed.progress);
  } catch (error) {
    return {
      ...parsed,
      backup,
      writeBack: { ok: false, reason: "write-failed", error },
      failure: null,
    };
  }
  return {
    ...parsed,
    backup,
    writeBack: setItem(storage, PROGRESS_STORAGE_KEY, serialized),
    failure: null,
  };
}

export type ProgressSaveFailureReason =
  | StorageFailureReason
  | "backup-failed"
  | "future-version"
  | "serialization-failed";

export type StoredProgressSaveResult =
  | { ok: true; backup: StorageMutationResult | null }
  | {
      ok: false;
      reason: ProgressSaveFailureReason;
      error?: unknown;
      backup: StorageMutationResult | null;
    };

/**
 * Save v3 progress without ever replacing a newer schema already on disk.
 * Reading the current key is mandatory: if that read fails, safety wins and
 * the write is rejected.
 */
export function saveStoredProgress(
  storage: StringStorage,
  progress: GooseProgress,
): StoredProgressSaveResult {
  if (isProgressReadOnly(progress)) {
    return { ok: false, reason: "future-version", backup: null };
  }

  let existing: string | null;
  try {
    existing = storage.getItem(PROGRESS_STORAGE_KEY);
  } catch (error) {
    return { ok: false, reason: "read-failed", error, backup: null };
  }

  let backup: StorageMutationResult | null = null;
  if (existing) {
    const parsedExisting = parseProgressResult(existing);
    if (parsedExisting.status === "future-version") {
      return { ok: false, reason: "future-version", backup: null };
    }
    if (
      parsedExisting.status === "migrated" ||
      parsedExisting.status === "invalid"
    ) {
      backup = setItem(storage, PROGRESS_BACKUP_KEY, existing);
      if (!backup.ok) {
        return {
          ok: false,
          reason: "backup-failed",
          error: backup.error,
          backup,
        };
      }
    }
  }

  let serialized: string;
  try {
    serialized = serializeProgress(progress);
  } catch (error) {
    return {
      ok: false,
      reason: "serialization-failed",
      error,
      backup,
    };
  }

  const write = setItem(storage, PROGRESS_STORAGE_KEY, serialized);
  if (!write.ok) {
    return {
      ok: false,
      reason: write.reason,
      error: write.error,
      backup,
    };
  }
  return { ok: true, backup };
}

export interface RunSnapshotV1<State = unknown> {
  v: typeof RUN_SNAPSHOT_SCHEMA_VERSION;
  rulesVersion: number;
  runId: string;
  savedAt: number;
  expiresAt: number;
  state: State;
}

export interface SaveRunSnapshotInput<State> {
  rulesVersion: number;
  runId: string;
  state: State;
  /** Defaults to 24 hours. */
  ttlMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: number;
}

export type RunSnapshotSaveFailureReason =
  | StorageFailureReason
  | "future-version"
  | "invalid-snapshot"
  | "serialization-failed";

export type RunSnapshotSaveResult<State> =
  | { ok: true; snapshot: RunSnapshotV1<State> }
  | {
      ok: false;
      reason: RunSnapshotSaveFailureReason;
      error?: unknown;
    };

function parsedObject(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Write a TTL-bound run snapshot, preserving any future snapshot schema. */
export function saveRunSnapshot<State>(
  storage: StringStorage,
  input: SaveRunSnapshotInput<State>,
): RunSnapshotSaveResult<State> {
  const now = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? DEFAULT_RUN_SNAPSHOT_TTL_MS;
  const runId = String(input.runId ?? "").trim();
  if (
    !Number.isFinite(now) ||
    now < 0 ||
    !Number.isInteger(input.rulesVersion) ||
    input.rulesVersion < 1 ||
    !Number.isFinite(ttlMs) ||
    ttlMs <= 0 ||
    !runId ||
    input.state === undefined ||
    !Number.isFinite(now + ttlMs)
  ) {
    return { ok: false, reason: "invalid-snapshot" };
  }

  try {
    const existing = storage.getItem(RUN_SNAPSHOT_STORAGE_KEY);
    if (existing) {
      const parsed = parsedObject(existing);
      const version = parsed?.v;
      if (
        typeof version === "number" &&
        Number.isInteger(version) &&
        version > RUN_SNAPSHOT_SCHEMA_VERSION
      ) {
        return { ok: false, reason: "future-version" };
      }
    }
  } catch (error) {
    return { ok: false, reason: "read-failed", error };
  }

  const snapshot: RunSnapshotV1<State> = {
    v: RUN_SNAPSHOT_SCHEMA_VERSION,
    rulesVersion: input.rulesVersion,
    runId,
    savedAt: now,
    expiresAt: now + ttlMs,
    state: input.state,
  };
  let serialized: string;
  try {
    serialized = JSON.stringify(snapshot);
  } catch (error) {
    return { ok: false, reason: "serialization-failed", error };
  }
  const write = setItem(storage, RUN_SNAPSHOT_STORAGE_KEY, serialized);
  if (!write.ok) {
    return { ok: false, reason: write.reason, error: write.error };
  }
  return { ok: true, snapshot };
}

export type RunSnapshotLoadStatus =
  | "missing"
  | "ready"
  | "expired"
  | "rules-mismatch"
  | "future-version"
  | "invalid-request"
  | "invalid"
  | "storage-error";

export interface LoadRunSnapshotOptions<State> {
  expectedRulesVersion: number;
  /** Injectable clock for deterministic tests. */
  now?: number;
  /** Optional game-state validator; envelope validation always runs. */
  validateState?: (value: unknown) => value is State;
}

export interface RunSnapshotLoadResult<State> {
  status: RunSnapshotLoadStatus;
  snapshot: RunSnapshotV1<State> | null;
  /** Expired, mismatched, and corrupt v1 records are removed best-effort. */
  cleanup: StorageMutationResult | null;
  failure: StorageMutationResult | null;
}

function invalidSnapshotResult<State>(
  storage: StringStorage,
): RunSnapshotLoadResult<State> {
  return {
    status: "invalid",
    snapshot: null,
    cleanup: removeItem(storage, RUN_SNAPSHOT_STORAGE_KEY),
    failure: null,
  };
}

/** Read, validate, and expire a run snapshot for the current rules version. */
export function loadRunSnapshot<State = unknown>(
  storage: StringStorage,
  options: LoadRunSnapshotOptions<State>,
): RunSnapshotLoadResult<State> {
  const now = options.now ?? Date.now();
  if (
    !Number.isInteger(options.expectedRulesVersion) ||
    options.expectedRulesVersion < 1 ||
    !Number.isFinite(now) ||
    now < 0
  ) {
    return {
      status: "invalid-request",
      snapshot: null,
      cleanup: null,
      failure: null,
    };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(RUN_SNAPSHOT_STORAGE_KEY);
  } catch (error) {
    return {
      status: "storage-error",
      snapshot: null,
      cleanup: null,
      failure: { ok: false, reason: "read-failed", error },
    };
  }
  if (!raw) {
    return {
      status: "missing",
      snapshot: null,
      cleanup: null,
      failure: null,
    };
  }

  const parsed = parsedObject(raw);
  if (!parsed) return invalidSnapshotResult(storage);
  if (
    typeof parsed.v === "number" &&
    Number.isInteger(parsed.v) &&
    parsed.v > RUN_SNAPSHOT_SCHEMA_VERSION
  ) {
    return {
      status: "future-version",
      snapshot: null,
      cleanup: null,
      failure: null,
    };
  }

  if (
    parsed.v !== RUN_SNAPSHOT_SCHEMA_VERSION ||
    !Number.isInteger(parsed.rulesVersion) ||
    Number(parsed.rulesVersion) < 1 ||
    typeof parsed.runId !== "string" ||
    !parsed.runId.trim() ||
    !Number.isFinite(parsed.savedAt) ||
    Number(parsed.savedAt) < 0 ||
    !Number.isFinite(parsed.expiresAt) ||
    Number(parsed.expiresAt) <= Number(parsed.savedAt) ||
    parsed.state === undefined
  ) {
    return invalidSnapshotResult(storage);
  }

  const snapshot = parsed as unknown as RunSnapshotV1<State>;
  if (snapshot.rulesVersion !== options.expectedRulesVersion) {
    return {
      status: "rules-mismatch",
      snapshot: null,
      cleanup: removeItem(storage, RUN_SNAPSHOT_STORAGE_KEY),
      failure: null,
    };
  }
  if (now >= snapshot.expiresAt) {
    return {
      status: "expired",
      snapshot: null,
      cleanup: removeItem(storage, RUN_SNAPSHOT_STORAGE_KEY),
      failure: null,
    };
  }
  if (options.validateState && !options.validateState(snapshot.state)) {
    return invalidSnapshotResult(storage);
  }
  return {
    status: "ready",
    snapshot,
    cleanup: null,
    failure: null,
  };
}

export function clearRunSnapshot(
  storage: StringStorage,
): StorageMutationResult {
  return removeItem(storage, RUN_SNAPSHOT_STORAGE_KEY);
}

/** Exported for integration guards and diagnostics. */
export const CURRENT_PROGRESS_SCHEMA_VERSION = PROGRESS_SCHEMA_VERSION;

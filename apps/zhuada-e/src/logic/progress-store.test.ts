import { describe, expect, it } from "vitest";
import {
  PROGRESS_BACKUP_KEY,
  PROGRESS_STORAGE_KEY,
  RUN_SNAPSHOT_STORAGE_KEY,
  clearRunSnapshot,
  loadRunSnapshot,
  loadStoredProgress,
  saveRunSnapshot,
  saveStoredProgress,
  type StringStorage,
} from "./progress-store";
import { createEmptyProgress } from "./progress";

class MemoryStorage implements StringStorage {
  readonly values = new Map<string, string>();
  readonly failSet = new Set<string>();
  readonly failRemove = new Set<string>();
  failRead = false;

  getItem(key: string): string | null {
    if (this.failRead) throw new Error("read blocked");
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failSet.has(key)) throw new Error(`write blocked: ${key}`);
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    if (this.failRemove.has(key)) throw new Error(`delete blocked: ${key}`);
    this.values.delete(key);
  }
}

describe("progress-store migration safety", () => {
  it.each([
    ["v1", JSON.stringify({ level: 6 })],
    [
      "v2",
      JSON.stringify({
        v: 2,
        level: 4,
        wins: 7,
        best: { 1: 80, 3: 210 },
        geese: [0],
      }),
    ],
  ])("backs up and immediately writes %s as v3", (_label, raw) => {
    const storage = new MemoryStorage();
    storage.values.set(PROGRESS_STORAGE_KEY, raw);

    const result = loadStoredProgress(storage);

    expect(result.status).toBe("migrated");
    expect(result.backup).toEqual({ ok: true });
    expect(result.writeBack).toEqual({ ok: true });
    expect(storage.values.get(PROGRESS_BACKUP_KEY)).toBe(raw);
    expect(JSON.parse(storage.values.get(PROGRESS_STORAGE_KEY) ?? "{}").v).toBe(3);
  });

  it("does not replace legacy data when its backup cannot be written", () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ v: 2, level: 8, wins: 4, best: { 2: 40 } });
    storage.values.set(PROGRESS_STORAGE_KEY, raw);
    storage.failSet.add(PROGRESS_BACKUP_KEY);

    const result = loadStoredProgress(storage);

    expect(result.status).toBe("migrated");
    expect(result.backup?.ok).toBe(false);
    expect(result.writeBack).toBeNull();
    expect(storage.values.get(PROGRESS_STORAGE_KEY)).toBe(raw);
  });

  it("reports a failed migration write while retaining the backup and source", () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ level: 3 });
    storage.values.set(PROGRESS_STORAGE_KEY, raw);
    storage.failSet.add(PROGRESS_STORAGE_KEY);

    const result = loadStoredProgress(storage);

    expect(result.backup).toEqual({ ok: true });
    expect(result.writeBack?.ok).toBe(false);
    expect(storage.values.get(PROGRESS_BACKUP_KEY)).toBe(raw);
    expect(storage.values.get(PROGRESS_STORAGE_KEY)).toBe(raw);
  });

  it("backs up invalid bytes but leaves the primary key for later recovery", () => {
    const storage = new MemoryStorage();
    storage.values.set(PROGRESS_STORAGE_KEY, "{broken-json");

    const result = loadStoredProgress(storage);

    expect(result.status).toBe("invalid");
    expect(result.backup).toEqual({ ok: true });
    expect(result.writeBack).toBeNull();
    expect(storage.values.get(PROGRESS_BACKUP_KEY)).toBe("{broken-json");
    expect(storage.values.get(PROGRESS_STORAGE_KEY)).toBe("{broken-json");
  });

  it("never overwrites an unknown future progress version", () => {
    const storage = new MemoryStorage();
    const future = JSON.stringify({
      v: 9,
      highestUnlockedLevel: 12,
      lastPlayedLevel: 8,
      lastTheme: "night-market",
      levels: {},
      wins: 20,
      geese: [],
    });
    storage.values.set(PROGRESS_STORAGE_KEY, future);

    const loaded = loadStoredProgress(storage);
    expect(loaded.status).toBe("future-version");
    expect(loaded.readOnly).toBe(true);
    expect(loaded.backup).toBeNull();
    expect(loaded.writeBack).toBeNull();

    const saved = saveStoredProgress(storage, createEmptyProgress());
    expect(saved).toMatchObject({ ok: false, reason: "future-version" });
    expect(storage.values.get(PROGRESS_STORAGE_KEY)).toBe(future);
  });

  it("returns read and write failures instead of swallowing them", () => {
    const readBlocked = new MemoryStorage();
    readBlocked.failRead = true;
    const loaded = loadStoredProgress(readBlocked);
    expect(loaded.status).toBe("storage-error");
    expect(loaded.failure).toMatchObject({ ok: false, reason: "read-failed" });
    expect(saveStoredProgress(readBlocked, createEmptyProgress())).toMatchObject({
      ok: false,
      reason: "read-failed",
    });

    const writeBlocked = new MemoryStorage();
    writeBlocked.failSet.add(PROGRESS_STORAGE_KEY);
    expect(saveStoredProgress(writeBlocked, createEmptyProgress())).toMatchObject({
      ok: false,
      reason: "write-failed",
    });
  });
});

interface TestRunState {
  level: number;
  score: number;
}

function isTestRunState(value: unknown): value is TestRunState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<TestRunState>;
  return Number.isInteger(state.level) && Number.isFinite(state.score);
}

describe("run snapshot store", () => {
  it("round-trips a valid snapshot before its TTL expires", () => {
    const storage = new MemoryStorage();
    const saved = saveRunSnapshot(storage, {
      rulesVersion: 4,
      runId: "run-123",
      state: { level: 5, score: 320 },
      now: 1_000,
      ttlMs: 5_000,
    });
    expect(saved.ok).toBe(true);

    const loaded = loadRunSnapshot<TestRunState>(storage, {
      expectedRulesVersion: 4,
      now: 2_000,
      validateState: isTestRunState,
    });
    expect(loaded.status).toBe("ready");
    expect(loaded.snapshot).toMatchObject({
      v: 1,
      rulesVersion: 4,
      runId: "run-123",
      savedAt: 1_000,
      expiresAt: 6_000,
      state: { level: 5, score: 320 },
    });
  });

  it("expires and removes stale snapshots", () => {
    const storage = new MemoryStorage();
    saveRunSnapshot(storage, {
      rulesVersion: 1,
      runId: "expired-run",
      state: { level: 1 },
      now: 100,
      ttlMs: 50,
    });

    const loaded = loadRunSnapshot(storage, {
      expectedRulesVersion: 1,
      now: 150,
    });
    expect(loaded.status).toBe("expired");
    expect(loaded.cleanup).toEqual({ ok: true });
    expect(storage.values.has(RUN_SNAPSHOT_STORAGE_KEY)).toBe(false);
  });

  it("invalidates snapshots from a different rules version", () => {
    const storage = new MemoryStorage();
    saveRunSnapshot(storage, {
      rulesVersion: 2,
      runId: "old-rules",
      state: { level: 2 },
      now: 100,
      ttlMs: 1_000,
    });

    const loaded = loadRunSnapshot(storage, {
      expectedRulesVersion: 3,
      now: 200,
    });
    expect(loaded.status).toBe("rules-mismatch");
    expect(storage.values.has(RUN_SNAPSHOT_STORAGE_KEY)).toBe(false);
  });

  it("does not delete a valid snapshot when load options are invalid", () => {
    const storage = new MemoryStorage();
    saveRunSnapshot(storage, {
      rulesVersion: 2,
      runId: "valid-run",
      state: { level: 2 },
      now: 100,
      ttlMs: 1_000,
    });

    const loaded = loadRunSnapshot(storage, {
      expectedRulesVersion: 0,
      now: Number.NaN,
    });
    expect(loaded.status).toBe("invalid-request");
    expect(loaded.cleanup).toBeNull();
    expect(storage.values.has(RUN_SNAPSHOT_STORAGE_KEY)).toBe(true);
  });

  it("preserves a snapshot written by a future schema", () => {
    const storage = new MemoryStorage();
    const future = JSON.stringify({ v: 7, state: { opaque: true } });
    storage.values.set(RUN_SNAPSHOT_STORAGE_KEY, future);

    const loaded = loadRunSnapshot(storage, {
      expectedRulesVersion: 1,
      now: 100,
    });
    expect(loaded.status).toBe("future-version");
    expect(loaded.cleanup).toBeNull();
    expect(
      saveRunSnapshot(storage, {
        rulesVersion: 1,
        runId: "replacement",
        state: {},
        now: 100,
      }),
    ).toMatchObject({ ok: false, reason: "future-version" });
    expect(storage.values.get(RUN_SNAPSHOT_STORAGE_KEY)).toBe(future);
  });

  it("cleans corrupt state and reports cleanup/storage failures", () => {
    const storage = new MemoryStorage();
    saveRunSnapshot(storage, {
      rulesVersion: 1,
      runId: "bad-state",
      state: { level: "not-a-level" },
      now: 100,
    });
    storage.failRemove.add(RUN_SNAPSHOT_STORAGE_KEY);

    const loaded = loadRunSnapshot<TestRunState>(storage, {
      expectedRulesVersion: 1,
      now: 200,
      validateState: isTestRunState,
    });
    expect(loaded.status).toBe("invalid");
    expect(loaded.cleanup).toMatchObject({ ok: false, reason: "delete-failed" });
    expect(clearRunSnapshot(storage)).toMatchObject({
      ok: false,
      reason: "delete-failed",
    });

    storage.failRead = true;
    expect(loadRunSnapshot(storage, { expectedRulesVersion: 1 })).toMatchObject({
      status: "storage-error",
      failure: { ok: false, reason: "read-failed" },
    });
  });

  it("rejects invalid envelopes and serialization failures", () => {
    const storage = new MemoryStorage();
    expect(
      saveRunSnapshot(storage, {
        rulesVersion: 0,
        runId: "",
        state: {},
        ttlMs: 0,
        now: 0,
      }),
    ).toMatchObject({ ok: false, reason: "invalid-snapshot" });
    expect(
      saveRunSnapshot(storage, {
        rulesVersion: 1,
        runId: "bigint",
        state: { unsafe: 1n },
        now: 0,
      }),
    ).toMatchObject({ ok: false, reason: "serialization-failed" });
  });
});

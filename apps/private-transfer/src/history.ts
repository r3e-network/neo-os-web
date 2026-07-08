/**
 * history.ts — Local, device-scoped persistence for sealed transfer intents.
 *
 * The seal flow produces a `secret_ref` that is the ONLY handle to the stored
 * ciphertext; it lived in component state, so navigating away discarded it and
 * the user had no record their intent existed. We persist a compact record per
 * successful seal via `app.storage.local` so the "Sealed intents" card and the
 * header stat tiles (requestCount / lastDigest) survive remounts.
 *
 * Storage keys: the app pins `storagePrefix: "miniapp-private-transfer:"` in
 * defineMiniApp, so {@link STORAGE_KEY} resolves to the legacy
 * "miniapp-private-transfer:sealed-intents:v1" localStorage key byte-for-byte —
 * intents sealed before the framework migration still load.
 *
 * Plaintext transfer details are NEVER persisted — only the public commitment,
 * nullifier, the opaque secret reference, and routing metadata.
 */

export interface SealedIntent {
  secretRef: string;
  commitment: string;
  nullifier: string;
  network: string;
  asset: string;
  /** Epoch milliseconds at seal time. */
  ts: number;
}

/**
 * Synchronous device-local store — structurally satisfied by
 * `app.storage.local` (the framework local-storage surface).
 */
export interface SealedIntentStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

// Composed with the app's storagePrefix ("miniapp-private-transfer:") this
// resolves to the legacy "miniapp-private-transfer:sealed-intents:v1" key.
const STORAGE_KEY = "sealed-intents:v1";
const MAX_RECORDS = 50;

function isSealedIntent(value: unknown): value is SealedIntent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.secretRef === "string" &&
    typeof record.commitment === "string" &&
    typeof record.nullifier === "string" &&
    typeof record.network === "string" &&
    typeof record.asset === "string" &&
    typeof record.ts === "number"
  );
}

/** Read the persisted sealed intents, newest first. Returns [] on any failure. */
export function readSealedIntents(store: SealedIntentStore): SealedIntent[] {
  const raw = store.get<unknown>(STORAGE_KEY, null);
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isSealedIntent);
}

/**
 * Prepend a new sealed intent and persist (capped at {@link MAX_RECORDS}).
 * Returns the new list (newest first) so callers can update component state in
 * one step without a second read.
 */
export function appendSealedIntent(store: SealedIntentStore, intent: SealedIntent): SealedIntent[] {
  const next = [intent, ...readSealedIntents(store)].slice(0, MAX_RECORDS);
  store.set(STORAGE_KEY, next);
  return next;
}

/** Drop all persisted sealed intents. */
export function clearSealedIntents(store: SealedIntentStore): void {
  store.delete(STORAGE_KEY);
}

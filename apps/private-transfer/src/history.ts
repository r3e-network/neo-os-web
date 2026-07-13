import {
  isMorpheusCiphertextEnvelope,
  PRIVATE_TRANSFER_TESTNET_ORACLE_CONTRACT,
} from "./protocol";

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
 * Ciphertext-only recovery record written before the confidential-store call.
 *
 * A store timeout can mean either "nothing was saved" or "the response was
 * lost after saving". Keeping the exact encrypted packet lets the user retry
 * without rebuilding a second intent. No recipient, amount, memo, note secret,
 * or other plaintext field is persisted here.
 */
export interface PendingSealedIntent {
  version: 1;
  name: string;
  ciphertext: string;
  publicEnvelope: Record<string, unknown>;
  commitment: string;
  nullifier: string;
  network: string;
  asset: string;
  contract: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
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
const PENDING_STORAGE_KEY = "pending-intent:v1";
const MAX_RECORDS = 50;

function parseSealedIntent(value: unknown): SealedIntent | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.secretRef !== "string" ||
    record.secretRef.trim().length === 0 ||
    record.secretRef.length > 512 ||
    typeof record.commitment !== "string" ||
    !/^0x[0-9a-f]{64}$/i.test(record.commitment) ||
    typeof record.nullifier !== "string" ||
    !/^0x[0-9a-f]{64}$/i.test(record.nullifier) ||
    record.network !== "testnet" ||
    (record.asset !== "GAS" && record.asset !== "NEO") ||
    typeof record.ts !== "number" ||
    !Number.isFinite(record.ts) ||
    record.ts <= 0
  ) {
    return null;
  }
  return {
    secretRef: record.secretRef.trim(),
    commitment: record.commitment,
    nullifier: record.nullifier,
    network: record.network,
    asset: record.asset,
    ts: record.ts,
  };
}

/** Read the persisted sealed intents, newest first. Returns [] on any failure. */
export function readSealedIntents(store: SealedIntentStore): SealedIntent[] {
  const raw = store.get<unknown>(STORAGE_KEY, null);
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .slice(0, MAX_RECORDS)
    .map(parseSealedIntent)
    .filter((record): record is SealedIntent => record !== null);
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

function isPendingSealedIntent(value: unknown): value is PendingSealedIntent {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const publicEnvelope = record.publicEnvelope as Record<string, unknown> | null;
  const allowedEnvelopeKeys = new Set([
    "kind",
    "app_id",
    "target_chain",
    "network",
    "asset",
    "note_commitment",
    "nullifier_hash",
    "privacy_model",
  ]);
  const hasPlaintextField = ["recipient", "amount", "memo", "noteSecret", "note_secret"]
    .some((key) => Object.prototype.hasOwnProperty.call(record, key));
  return (
    !hasPlaintextField &&
    record.version === 1 &&
    isMorpheusCiphertextEnvelope(record.ciphertext) &&
    publicEnvelope !== null &&
    typeof publicEnvelope === "object" &&
    !Array.isArray(record.publicEnvelope) &&
    Object.keys(publicEnvelope).every((key) => allowedEnvelopeKeys.has(key)) &&
    Object.keys(publicEnvelope).length === allowedEnvelopeKeys.size &&
    typeof record.commitment === "string" &&
    /^0x[0-9a-f]{64}$/i.test(record.commitment) &&
    typeof record.nullifier === "string" &&
    /^0x[0-9a-f]{64}$/i.test(record.nullifier) &&
    record.name === `private-transfer:${record.commitment}` &&
    publicEnvelope.kind === "miniapp.private_transfer.intent.v1" &&
    publicEnvelope.app_id === "miniapp-private-transfer" &&
    publicEnvelope.target_chain === "neo_n3" &&
    publicEnvelope.note_commitment === record.commitment &&
    publicEnvelope.nullifier_hash === record.nullifier &&
    publicEnvelope.privacy_model === "morpheus_confidential_compute" &&
    record.network === "testnet" &&
    (record.asset === "GAS" || record.asset === "NEO") &&
    publicEnvelope.network === record.network &&
    publicEnvelope.asset === record.asset &&
    typeof record.contract === "string" &&
    record.contract.toLowerCase() === PRIVATE_TRANSFER_TESTNET_ORACLE_CONTRACT.toLowerCase() &&
    typeof record.createdAt === "number" &&
    Number.isFinite(record.createdAt) &&
    typeof record.attempts === "number" &&
    Number.isInteger(record.attempts) &&
    record.attempts >= 0 &&
    record.attempts <= 10_000 &&
    (
      record.lastError === undefined ||
      (typeof record.lastError === "string" && record.lastError.length <= 128)
    )
  );
}

/** Read the one unresolved ciphertext packet, rejecting malformed local data. */
export function readPendingSealedIntent(store: SealedIntentStore): PendingSealedIntent | null {
  const value = store.get<unknown>(PENDING_STORAGE_KEY, null);
  return isPendingSealedIntent(value) ? value : null;
}

/** Persist the exact ciphertext packet before its first storage attempt. */
export function savePendingSealedIntent(
  store: SealedIntentStore,
  pending: PendingSealedIntent,
): PendingSealedIntent {
  if (!isPendingSealedIntent(pending)) {
    throw new Error("Invalid private-transfer recovery packet");
  }
  store.set(PENDING_STORAGE_KEY, pending);
  return pending;
}

/** Remove recovery state only after a confirmed secret reference or user discard. */
export function clearPendingSealedIntent(store: SealedIntentStore): void {
  store.delete(PENDING_STORAGE_KEY);
}

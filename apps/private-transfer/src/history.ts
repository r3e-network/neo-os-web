/**
 * history.ts — Local, device-scoped persistence for sealed transfer intents.
 *
 * The seal flow produces a `secret_ref` that is the ONLY handle to the stored
 * ciphertext; it lived in component state, so navigating away discarded it and
 * the user had no record their intent existed. We persist a compact record per
 * successful seal to safe-storage so the "Sealed intents" card and the header
 * stat tiles (requestCount / lastDigest) survive remounts.
 *
 * Plaintext transfer details are NEVER persisted — only the public commitment,
 * nullifier, the opaque secret reference, and routing metadata.
 */

import { safeReadJSON, safeWriteJSON, safeRemoveStorage } from "@shared/utils/safe-storage";

export interface SealedIntent {
  secretRef: string;
  commitment: string;
  nullifier: string;
  network: string;
  asset: string;
  /** Epoch milliseconds at seal time. */
  ts: number;
}

const STORAGE_KEY = "miniapp-private-transfer:sealed-intents:v1";
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
export function readSealedIntents(): SealedIntent[] {
  const raw = safeReadJSON<unknown>(STORAGE_KEY);
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
export function appendSealedIntent(intent: SealedIntent): SealedIntent[] {
  const next = [intent, ...readSealedIntents()].slice(0, MAX_RECORDS);
  safeWriteJSON(STORAGE_KEY, next);
  return next;
}

/** Drop all persisted sealed intents. */
export function clearSealedIntents(): void {
  safeRemoveStorage(STORAGE_KEY);
}

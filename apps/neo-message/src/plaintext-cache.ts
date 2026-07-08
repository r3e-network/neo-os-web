/**
 * plaintext-cache.ts — Device-local persistence for recipient-only plaintext.
 *
 * Recipient-only plaintext is decrypted off-chain (never written on-chain), so
 * a refresh re-reads chain state with revealed=false and wipes it. Persist the
 * decrypted plaintext on-device, keyed by id:recipient, and overlay it back
 * onto rows where the connected wallet is the recipient — a just-decrypted
 * message then survives a refresh without a fresh signature + oracle
 * round-trip.
 *
 * Storage keys: the app pins `storagePrefix` in defineMiniApp to
 * `${MESSAGE_EVM_ADDRESS.toLowerCase()}:`, so {@link PLAINTEXT_STORE_KEY}
 * resolves through app.storage.local to the legacy
 * "<contract-address>:plaintext:v1" localStorage key byte-for-byte — messages
 * decrypted before the framework migration still overlay.
 */

import { addressesEqual, type MessageView } from "./message-logic";

/**
 * Synchronous device-local store — structurally satisfied by
 * `app.storage.local` (the framework local-storage surface).
 */
export interface PlaintextStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
}

// Composed with the app's storagePrefix ("<contract-address>:") this resolves
// to the legacy "<contract-address>:plaintext:v1" localStorage key.
export const PLAINTEXT_STORE_KEY = "plaintext:v1";

export function plaintextCacheKey(id: string, recipient: string): string {
  return `${id}:${recipient.toLowerCase()}`;
}

/** Read the persisted plaintext cache. Returns {} on any failure. */
export function readPlaintextCache(store: PlaintextStore): Record<string, string> {
  const raw = store.get<Record<string, string>>(PLAINTEXT_STORE_KEY, null);
  return raw && typeof raw === "object" ? raw : {};
}

/**
 * Persist a decrypted plaintext. Best-effort: a failed write (quota, disabled
 * storage) must never fail the reveal that produced the plaintext — the
 * pre-migration safe-storage helpers swallowed write errors the same way.
 */
export function cachePlaintext(
  store: PlaintextStore,
  id: string,
  recipient: string,
  plaintext: string,
): void {
  try {
    const cache = readPlaintextCache(store);
    cache[plaintextCacheKey(id, recipient)] = plaintext;
    store.set(PLAINTEXT_STORE_KEY, cache);
  } catch {
    /* device-cache write failure must not fail the reveal that produced it */
  }
}

/**
 * Overlay any device-cached recipient-only plaintext back onto rows so a
 * just-decrypted message survives a refresh (only for rows the connected
 * wallet can decrypt).
 */
export function overlayCachedPlaintext(
  store: PlaintextStore,
  rows: MessageView[],
  who: string,
): MessageView[] {
  const cache = readPlaintextCache(store);
  return rows.map((row) => {
    if (row.revealed || row.plaintext || !addressesEqual(who, row.recipient)) {
      return row;
    }
    const cached = cache[plaintextCacheKey(row.id, row.recipient)];
    return cached ? { ...row, plaintext: cached, revealed: true } : row;
  });
}

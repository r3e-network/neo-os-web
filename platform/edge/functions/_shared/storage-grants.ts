/**
 * Shared-storage grant persistence + visibility filtering.
 *
 * Audit fix C9: the OS "shared storage" access model used to apply no filtering —
 * grant-access returned `granted: true` without recording anything and
 * read-shared read any owner app's kernel state without consulting any grant.
 * These helpers back the model with the `miniapp_storage_grants` table so
 * grant-access records a row (or throws) and read-shared filters out reads that
 * lack a matching recorded grant.
 *
 * IMPORTANT: the grant table is an ADVISORY / VISIBILITY filter, NOT a
 * confidentiality boundary. Shared-storage values live in the on-chain kernel
 * state, which is world-readable: anyone can read an owner app's kernel state
 * directly via a public RPC node regardless of what (or whether) a grant exists.
 * The filter only governs what this edge endpoint will surface; it does not and
 * cannot keep the underlying data secret. Treat any value written to shared
 * storage as public. Real per-reader confidentiality must instead use the
 * TEE / sealed-storage lane, which encrypts data so only authorized readers can
 * decrypt it.
 *
 * A grant means: `ownerAppId` advertises that `readerAppId` may read
 * shared-storage keys that start with `keyPrefix` via this endpoint (an empty
 * prefix covers all of the owner's keys).
 */

import { supabaseServiceClient } from "./supabase.ts";

const GRANTS_TABLE = "miniapp_storage_grants";

/** Max length for app ids / key prefixes persisted to the grants table. */
const MAX_FIELD_LEN = 256;

function assertField(name: string, value: string, allowEmpty = false): string {
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) throw new Error(`${name} required`);
  if (trimmed.length > MAX_FIELD_LEN) throw new Error(`${name} too long`);
  return trimmed;
}

/**
 * Persist (upsert) a grant advertising that `readerAppId` may read
 * `ownerAppId`'s shared storage under `keyPrefix` via this endpoint. Throws on
 * validation or DB failure so the caller never reports success without a
 * recorded grant. Note: this only affects this endpoint's visibility filter —
 * the underlying kernel state is world-readable on-chain regardless.
 */
export async function recordStorageGrant(
  ownerAppId: string,
  readerAppId: string,
  keyPrefix: string,
): Promise<{ ownerAppId: string; readerAppId: string; keyPrefix: string }> {
  const owner = assertField("ownerAppId", ownerAppId);
  const reader = assertField("readerAppId", readerAppId);
  const prefix = assertField("keyPrefix", keyPrefix, true);

  if (owner === reader) {
    throw new Error("cannot grant shared-storage access to the granting app itself");
  }

  const supabase = supabaseServiceClient();
  const { error: upsertErr } = await supabase
    .from(GRANTS_TABLE)
    .upsert(
      {
        owner_app_id: owner,
        reader_app_id: reader,
        key_prefix: prefix,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_app_id,reader_app_id,key_prefix" },
    );

  if (upsertErr) {
    throw new Error(`failed to persist storage grant: ${upsertErr.message}`);
  }

  return { ownerAppId: owner, readerAppId: reader, keyPrefix: prefix };
}

/**
 * Return true when `readerAppId` has a recorded grant from `ownerAppId` whose
 * `key_prefix` is a prefix of `key`. Throws on DB failure (the caller treats a
 * thrown error as "not visible"). This drives an advisory visibility filter
 * only — a false result hides the value from this endpoint but does not make it
 * confidential, since the kernel state is world-readable on-chain.
 */
export async function hasStorageGrant(
  ownerAppId: string,
  readerAppId: string,
  key: string,
): Promise<boolean> {
  const owner = ownerAppId.trim();
  const reader = readerAppId.trim();
  if (!owner || !reader) return false;

  const supabase = supabaseServiceClient();
  const { data, error: selErr } = await supabase
    .from(GRANTS_TABLE)
    .select("key_prefix")
    .eq("owner_app_id", owner)
    .eq("reader_app_id", reader);

  if (selErr) {
    throw new Error(`failed to load storage grants: ${selErr.message}`);
  }
  if (!Array.isArray(data) || data.length === 0) return false;

  return data.some((row) => {
    const prefix = String((row as { key_prefix?: unknown }).key_prefix ?? "");
    return key.startsWith(prefix);
  });
}

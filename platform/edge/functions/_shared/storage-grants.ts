/**
 * Shared-storage grant persistence + enforcement.
 *
 * Audit fix C9: the OS "shared storage" access model used to be unenforced —
 * grant-access returned `granted: true` without recording anything and
 * read-shared read any owner app's kernel state with no check. These helpers
 * back the model with the `miniapp_storage_grants` table so grant-access
 * fail-closes (it must persist a row or throw) and read-shared denies any read
 * that lacks a matching recorded grant.
 *
 * A grant means: `ownerAppId` allows `readerAppId` to read shared-storage keys
 * that start with `keyPrefix` (an empty prefix grants all of the owner's keys).
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
 * Persist (upsert) a grant allowing `readerAppId` to read `ownerAppId`'s shared
 * storage under `keyPrefix`. Throws on validation or DB failure so the caller
 * never reports success without a recorded grant.
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
 * `key_prefix` is a prefix of `key`. Throws on DB failure (fail-closed: the
 * caller must treat a thrown error as "deny").
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

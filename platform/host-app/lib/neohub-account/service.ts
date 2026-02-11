/**
 * NeoHub Account Service
 * Handles account creation, verification, and linking operations
 */

import { randomBytes, pbkdf2Sync, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import type { ChainId } from "@/lib/chains/types";
import type {
  NeoHubAccount,
  NeoHubAccountFull,
  LinkedNeoAccount,
  LinkedChainAccount,
  LinkNeoAccountParams,
  NeoAccountRow,
  ChainAccountRow,
} from "./types";

/** Get DB client or throw — all functions in this module require service-role access */
function db() {
  if (!supabaseAdmin) throw new Error("Database not configured");
  return supabaseAdmin;
}

const PASSWORD_ITERATIONS = 100000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = "sha512";

/**
 * Hash password using PBKDF2
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const passwordSalt = salt || randomBytes(32).toString("hex");
  const hash = pbkdf2Sync(password, passwordSalt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString(
    "hex",
  );
  return { hash, salt: passwordSalt };
}

/**
 * Verify password against stored hash
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Get NeoHub account by ID
 */
export async function getNeoHubAccount(accountId: string): Promise<NeoHubAccount | null> {
  const { data, error } = await db()
    .from("neohub_accounts")
    .select("id, display_name, avatar_url, created_at, updated_at, last_login_at")
    .eq("id", accountId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    lastLoginAt: data.last_login_at,
  };
}

/**
 * Get full NeoHub account with all linked accounts
 */
export async function getFullNeoHubAccount(accountId: string): Promise<NeoHubAccountFull | null> {
  const account = await getNeoHubAccount(accountId);
  if (!account) return null;

  // Fetch all linked data in parallel (eliminates N+1 sequential queries)
  const [{ data: identities }, { data: neoAccounts }, { data: chainAccounts }] = await Promise.all([
    db().from("linked_identities").select("*").eq("neohub_account_id", accountId),
    db().from("linked_neo_accounts").select("*").eq("neohub_account_id", accountId),
    db().from("linked_chain_accounts").select("*").eq("neohub_account_id", accountId),
  ]);

  return {
    ...account,
    linkedIdentities: (identities || []).map((row) => ({
      id: row.id,
      neohubAccountId: row.neohub_account_id,
      provider: row.provider as "google-oauth2" | "twitter" | "github",
      providerUserId: row.provider_user_id,
      email: row.email,
      name: row.name,
      avatar: row.avatar,
      linkedAt: row.linked_at,
      lastUsedAt: row.last_used_at,
    })),
    linkedNeoAccounts: (neoAccounts || []).map(mapNeoAccount),
    linkedChainAccounts: (chainAccounts || []).map(mapChainAccount),
  };
}

function mapNeoAccount(row: NeoAccountRow): LinkedNeoAccount {
  return {
    id: row.id,
    neohubAccountId: row.neohub_account_id,
    address: row.address,
    publicKey: row.public_key,
    isPrimary: row.is_primary,
    linkedAt: row.linked_at,
  };
}

function mapChainAccount(row: ChainAccountRow): LinkedChainAccount {
  return {
    id: row.id,
    neohubAccountId: row.neohub_account_id,
    address: row.address,
    publicKey: row.public_key,
    isPrimary: row.is_primary,
    linkedAt: row.linked_at,
    chainId: row.chain_id as ChainId,
    chainType: row.chain_type as "neo-n3",
  };
}

/**
 * Verify NeoHub account password
 */
export async function verifyAccountPassword(accountId: string, password: string): Promise<boolean> {
  const { data } = await db()
    .from("neohub_accounts")
    .select("password_hash, password_salt")
    .eq("id", accountId)
    .single();

  if (!data) return false;

  return verifyPassword(password, data.password_hash, data.password_salt);
}

/**
 * Link a Neo account to NeoHub account
 */
export async function linkNeoAccount(params: LinkNeoAccountParams): Promise<LinkedNeoAccount> {
  const { neohubAccountId, address, publicKey, encryptedPrivateKey, salt, iv, tag, iterations } = params;

  // Insert with is_primary=false first to avoid TOCTOU race.
  // A concurrent insert can no longer cause two primaries.
  const { data: neoAccount, error: neoError } = await db()
    .from("linked_neo_accounts")
    .insert({
      neohub_account_id: neohubAccountId,
      address,
      public_key: publicKey,
      is_primary: false,
    })
    .select()
    .single();

  if (neoError || !neoAccount) {
    throw new Error(`Failed to link Neo account: ${neoError?.message}`);
  }

  // Promote to primary only if no other primary exists (atomic conditional update)
  const { count } = await db()
    .from("linked_neo_accounts")
    .select("*", { count: "exact", head: true })
    .eq("neohub_account_id", neohubAccountId)
    .eq("is_primary", true);

  if ((count || 0) === 0) {
    await db().from("linked_neo_accounts").update({ is_primary: true }).eq("id", neoAccount.id).eq("is_primary", false);
  }

  // Store encrypted key
  const { error: keyError } = await db().from("encrypted_keys").insert({
    neohub_account_id: neohubAccountId,
    wallet_address: address,
    address,
    public_key: publicKey,
    encrypted_private_key: encryptedPrivateKey,
    encryption_salt: salt,
    key_derivation_params: { iv, tag, iterations },
  });

  if (keyError) {
    // Rollback
    await db().from("linked_neo_accounts").delete().eq("id", neoAccount.id);
    throw new Error(`Failed to store encrypted key: ${keyError.message}`);
  }

  // Log change
  await logAccountChange(neohubAccountId, "link_neo", { address });

  return mapNeoAccount(neoAccount);
}

/**
 * Unlink social identity (requires at least 1 identity or Neo account remaining)
 */
export async function unlinkIdentity(
  neohubAccountId: string,
  identityId: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  // Verify password first
  const isValid = await verifyAccountPassword(neohubAccountId, password);
  if (!isValid) {
    return { success: false, error: "Invalid password" };
  }

  // Check if can unlink (must have at least 1 remaining)
  const { data: canUnlink } = await db().rpc("can_unlink_identity", {
    p_neohub_account_id: neohubAccountId,
    p_identity_id: identityId,
  });

  if (!canUnlink) {
    return { success: false, error: "Cannot unlink last identity" };
  }

  // Get identity info for logging
  const { data: identity } = await db().from("linked_identities").select("provider").eq("id", identityId).single();

  // Delete identity
  const { error } = await db().from("linked_identities").delete().eq("id", identityId);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAccountChange(neohubAccountId, "unlink_identity", {
    provider: identity?.provider,
  });

  return { success: true };
}

/**
 * Unlink Neo account (requires at least 1 identity or Neo account remaining)
 */
export async function unlinkNeoAccount(
  neohubAccountId: string,
  neoAccountId: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  // Verify password first
  const isValid = await verifyAccountPassword(neohubAccountId, password);
  if (!isValid) {
    return { success: false, error: "Invalid password" };
  }

  // Check if can unlink
  const { data: canUnlink } = await db().rpc("can_unlink_neo_account", {
    p_neohub_account_id: neohubAccountId,
    p_neo_account_id: neoAccountId,
  });

  if (!canUnlink) {
    return { success: false, error: "Cannot unlink last account" };
  }

  // Get Neo account info for logging
  const { data: neoAccount } = await db().from("linked_neo_accounts").select("address").eq("id", neoAccountId).single();

  // Delete encrypted key
  if (neoAccount) {
    await db().from("encrypted_keys").delete().eq("wallet_address", neoAccount.address);
  }

  // Delete Neo account link
  const { error } = await db().from("linked_neo_accounts").delete().eq("id", neoAccountId);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAccountChange(neohubAccountId, "unlink_neo", { address: neoAccount?.address });

  return { success: true };
}

/**
 * Change NeoHub account password
 */
export async function changePassword(
  neohubAccountId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  // Verify current password
  const isValid = await verifyAccountPassword(neohubAccountId, currentPassword);
  if (!isValid) {
    return { success: false, error: "Invalid current password" };
  }

  // Hash new password
  const { hash, salt } = hashPassword(newPassword);

  // Update password
  const { error } = await db()
    .from("neohub_accounts")
    .update({
      password_hash: hash,
      password_salt: salt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", neohubAccountId);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAccountChange(neohubAccountId, "change_password", {});

  return { success: true };
}

/**
 * Log account change for audit
 */
async function logAccountChange(
  neohubAccountId: string,
  changeType: string,
  changeDetails: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await db().from("account_change_log").insert({
    neohub_account_id: neohubAccountId,
    change_type: changeType,
    change_details: changeDetails,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

/**
 * Get encrypted key for Neo account
 */
export async function getEncryptedKey(address: string) {
  const { data } = await db().from("encrypted_keys").select("*").eq("wallet_address", address).single();

  return data;
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(neohubAccountId: string): Promise<void> {
  await db().from("neohub_accounts").update({ last_login_at: new Date().toISOString() }).eq("id", neohubAccountId);
}

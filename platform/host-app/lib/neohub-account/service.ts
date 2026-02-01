/**
 * NeoHub Account Service
 * Handles account creation, verification, and linking operations
 */

import { randomBytes, pbkdf2Sync } from "crypto";
import { supabase } from "@/lib/supabase";
import type { ChainId } from "@/lib/chains/types";
import type {
  NeoHubAccount,
  NeoHubAccountFull,
  LinkedIdentity,
  LinkedNeoAccount,
  LinkedChainAccount,
  CreateAccountParams,
  LinkIdentityParams,
  LinkNeoAccountParams,
  IdentityRow,
  NeoAccountRow,
  ChainAccountRow,
} from "./types";

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
  return hash === storedHash;
}

/**
 * Get NeoHub account by ID
 */
export async function getNeoHubAccount(accountId: string): Promise<NeoHubAccount | null> {
  const { data, error } = await supabase
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
 * Get NeoHub account by Auth0 sub (social login)
 */
export async function getNeoHubAccountByAuth0Sub(auth0Sub: string): Promise<NeoHubAccountFull | null> {
  // Find linked identity
  const { data: identity } = await supabase
    .from("linked_identities")
    .select("neohub_account_id")
    .eq("auth0_sub", auth0Sub)
    .single();

  if (!identity) return null;

  return getFullNeoHubAccount(identity.neohub_account_id);
}

/**
 * Get full NeoHub account with all linked accounts
 */
export async function getFullNeoHubAccount(accountId: string): Promise<NeoHubAccountFull | null> {
  const account = await getNeoHubAccount(accountId);
  if (!account) return null;

  // Get linked identities
  const { data: identities } = await supabase.from("linked_identities").select("*").eq("neohub_account_id", accountId);

  // Get linked Neo accounts
  const { data: neoAccounts } = await supabase
    .from("linked_neo_accounts")
    .select("*")
    .eq("neohub_account_id", accountId);

  // Get linked chain accounts (multi-chain)
  const { data: chainAccounts } = await supabase
    .from("linked_chain_accounts")
    .select("*")
    .eq("neohub_account_id", accountId);

  return {
    ...account,
    linkedIdentities: (identities || []).map(mapIdentity),
    linkedNeoAccounts: (neoAccounts || []).map(mapNeoAccount),
    linkedChainAccounts: (chainAccounts || []).map(mapChainAccount),
  };
}

 
function mapIdentity(row: IdentityRow): LinkedIdentity {
  return {
    id: row.id,
    neohubAccountId: row.neohub_account_id,
    provider: row.provider as LinkedIdentity["provider"],
    providerUserId: row.provider_user_id,
    auth0Sub: row.auth0_sub,
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    linkedAt: row.linked_at,
    lastUsedAt: row.last_used_at,
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
 * Create a new NeoHub account with initial social identity
 */
export async function createNeoHubAccount(params: CreateAccountParams): Promise<NeoHubAccountFull> {
  const { password, auth0Sub, provider, email, name, avatar } = params;

  // Hash password
  const { hash, salt } = hashPassword(password);

  // Extract provider user ID from auth0_sub (e.g., "google-oauth2|123456" -> "123456")
  const providerUserId = auth0Sub.includes("|") ? auth0Sub.split("|")[1] : auth0Sub;

  // Create NeoHub account
  const { data: account, error: accountError } = await supabase
    .from("neohub_accounts")
    .insert({
      password_hash: hash,
      password_salt: salt,
      password_iterations: PASSWORD_ITERATIONS,
      display_name: name,
      avatar_url: avatar,
    })
    .select()
    .single();

  if (accountError || !account) {
    throw new Error(`Failed to create NeoHub account: ${accountError?.message}`);
  }

  // Link initial social identity
  const { error: identityError } = await supabase.from("linked_identities").insert({
    neohub_account_id: account.id,
    provider,
    provider_user_id: providerUserId,
    auth0_sub: auth0Sub,
    email,
    name,
    avatar,
  });

  if (identityError) {
    // Rollback account creation
    await supabase.from("neohub_accounts").delete().eq("id", account.id);
    throw new Error(`Failed to link identity: ${identityError.message}`);
  }

  return getFullNeoHubAccount(account.id) as Promise<NeoHubAccountFull>;
}

/**
 * Verify NeoHub account password
 */
export async function verifyAccountPassword(accountId: string, password: string): Promise<boolean> {
  const { data } = await supabase
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

  // Check if this is the first Neo account (make it primary)
  const { count } = await supabase
    .from("linked_neo_accounts")
    .select("*", { count: "exact", head: true })
    .eq("neohub_account_id", neohubAccountId);

  const isPrimary = (count || 0) === 0;

  // Insert linked Neo account
  const { data: neoAccount, error: neoError } = await supabase
    .from("linked_neo_accounts")
    .insert({
      neohub_account_id: neohubAccountId,
      address,
      public_key: publicKey,
      is_primary: isPrimary,
    })
    .select()
    .single();

  if (neoError || !neoAccount) {
    throw new Error(`Failed to link Neo account: ${neoError?.message}`);
  }

  // Store encrypted key
  const { error: keyError } = await supabase.from("encrypted_keys").insert({
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
    await supabase.from("linked_neo_accounts").delete().eq("id", neoAccount.id);
    throw new Error(`Failed to store encrypted key: ${keyError.message}`);
  }

  // Log change
  await logAccountChange(neohubAccountId, "link_neo", { address });

  return mapNeoAccount(neoAccount);
}

/**
 * Link additional social identity to NeoHub account
 */
export async function linkIdentity(params: LinkIdentityParams): Promise<LinkedIdentity> {
  const { neohubAccountId, auth0Sub, provider, providerUserId, email, name, avatar } = params;

  const { data: identity, error } = await supabase
    .from("linked_identities")
    .insert({
      neohub_account_id: neohubAccountId,
      provider,
      provider_user_id: providerUserId,
      auth0_sub: auth0Sub,
      email,
      name,
      avatar,
    })
    .select()
    .single();

  if (error || !identity) {
    throw new Error(`Failed to link identity: ${error?.message}`);
  }

  await logAccountChange(neohubAccountId, "link_identity", { provider, auth0Sub });

  return mapIdentity(identity);
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
  const { data: canUnlink } = await supabase.rpc("can_unlink_identity", {
    p_neohub_account_id: neohubAccountId,
    p_identity_id: identityId,
  });

  if (!canUnlink) {
    return { success: false, error: "Cannot unlink last identity" };
  }

  // Get identity info for logging
  const { data: identity } = await supabase
    .from("linked_identities")
    .select("provider, auth0_sub")
    .eq("id", identityId)
    .single();

  // Delete identity
  const { error } = await supabase.from("linked_identities").delete().eq("id", identityId);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAccountChange(neohubAccountId, "unlink_identity", {
    provider: identity?.provider,
    auth0Sub: identity?.auth0_sub,
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
  const { data: canUnlink } = await supabase.rpc("can_unlink_neo_account", {
    p_neohub_account_id: neohubAccountId,
    p_neo_account_id: neoAccountId,
  });

  if (!canUnlink) {
    return { success: false, error: "Cannot unlink last account" };
  }

  // Get Neo account info for logging
  const { data: neoAccount } = await supabase
    .from("linked_neo_accounts")
    .select("address")
    .eq("id", neoAccountId)
    .single();

  // Delete encrypted key
  if (neoAccount) {
    await supabase.from("encrypted_keys").delete().eq("wallet_address", neoAccount.address);
  }

  // Delete Neo account link
  const { error } = await supabase.from("linked_neo_accounts").delete().eq("id", neoAccountId);

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
  const { error } = await supabase
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
  await supabase.from("account_change_log").insert({
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
  const { data } = await supabase.from("encrypted_keys").select("*").eq("wallet_address", address).single();

  return data;
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(neohubAccountId: string): Promise<void> {
  await supabase.from("neohub_accounts").update({ last_login_at: new Date().toISOString() }).eq("id", neohubAccountId);
}

/**
 * NeoHub Account System Types
 * Supports Neo N3 accounts.
 */

import type { ChainId } from "../chains/types";

export interface NeoHubAccount {
  id: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface LinkedIdentity {
  id: string;
  neohubAccountId: string;
  provider: "google-oauth2" | "twitter" | "github";
  providerUserId: string;
  auth0Sub: string;
  email?: string;
  name?: string;
  avatar?: string;
  linkedAt: string;
  lastUsedAt?: string;
}

/**
 * Linked blockchain account (multi-chain support)
 * @deprecated Use LinkedChainAccount for new code
 */
export interface LinkedNeoAccount {
  id: string;
  neohubAccountId: string;
  address: string;
  publicKey: string;
  isPrimary: boolean;
  linkedAt: string;
  /** Chain ID - defaults to neo-n3-mainnet for legacy accounts */
  chainId?: ChainId;
}

/**
 * Multi-chain linked account
 */
export interface LinkedChainAccount {
  id: string;
  neohubAccountId: string;
  address: string;
  publicKey: string;
  isPrimary: boolean;
  linkedAt: string;
  /** Chain ID this account belongs to */
  chainId: ChainId;
  /** Chain type for quick filtering */
  chainType: "neo-n3";
}

export interface AccountChangeLog {
  id: string;
  neohubAccountId: string;
  changeType: "link_identity" | "unlink_identity" | "link_neo" | "unlink_neo" | "change_password" | "regenerate_neo";
  changeDetails: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface NeoHubAccountFull extends NeoHubAccount {
  linkedIdentities: LinkedIdentity[];
  /** @deprecated use linkedChainAccounts */
  linkedNeoAccounts: LinkedNeoAccount[];
  linkedChainAccounts: LinkedChainAccount[];
}

export interface CreateAccountParams {
  password: string;
  auth0Sub: string;
  provider: string;
  email?: string;
  name?: string;
  avatar?: string;
}

export interface LinkIdentityParams {
  neohubAccountId: string;
  auth0Sub: string;
  provider: string;
  providerUserId: string;
  email?: string;
  name?: string;
  avatar?: string;
}

export interface LinkNeoAccountParams {
  neohubAccountId: string;
  address: string;
  publicKey: string;
  encryptedPrivateKey: string;
  salt: string;
  iv: string;
  tag: string;
  iterations: number;
}

// ============================================================================
// Database Row Types (for Supabase queries)
// ============================================================================

export interface IdentityRow {
  id: string;
  neohub_account_id: string;
  provider: string;
  provider_user_id: string;
  auth0_sub: string;
  email?: string;
  name?: string;
  avatar?: string;
  linked_at: string;
  last_used_at?: string;
}

export interface NeoAccountRow {
  id: string;
  neohub_account_id: string;
  address: string;
  public_key: string;
  is_primary: boolean;
  linked_at: string;
}

export interface ChainAccountRow {
  id: string;
  neohub_account_id: string;
  address: string;
  public_key: string;
  chain_id: string;
  chain_type: string;
  is_primary: boolean;
  linked_at: string;
  label?: string;
}

/**
 * NeoHub Account System Types
 */

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

export interface LinkedNeoAccount {
  id: string;
  neohubAccountId: string;
  address: string;
  publicKey: string;
  isPrimary: boolean;
  linkedAt: string;
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
  linkedNeoAccounts: LinkedNeoAccount[];
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

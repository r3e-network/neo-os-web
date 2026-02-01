/**
 * Browser-side Neo account generation
 * Private key is generated and encrypted entirely in the browser
 */

import { wallet } from "@cityofzion/neon-js";
import type { BrowserEncryptionResult } from "../wallet/crypto-browser";
import { encryptPrivateKeyBrowser } from "../wallet/crypto-browser";

export interface BrowserNeoAccount {
  address: string;
  publicKey: string;
  privateKey: string;
}

export interface EncryptedBrowserAccount {
  address: string;
  publicKey: string;
  encrypted: BrowserEncryptionResult;
}

/**
 * Generate new Neo account in browser
 */
export function generateNeoAccountBrowser(): BrowserNeoAccount {
  const account = new wallet.Account();
  return {
    address: account.address,
    publicKey: account.publicKey,
    privateKey: account.privateKey,
  };
}

/**
 * Generate and encrypt Neo account in browser
 * Private key never leaves browser unencrypted
 */
export async function generateEncryptedAccount(password: string): Promise<EncryptedBrowserAccount> {
  const account = generateNeoAccountBrowser();
  const encrypted = await encryptPrivateKeyBrowser(account.privateKey, password);

  return {
    address: account.address,
    publicKey: account.publicKey,
    encrypted,
  };
}

/**
 * Import WIF and encrypt in browser
 */
export async function importAndEncryptWif(wif: string, password: string): Promise<EncryptedBrowserAccount> {
  const account = new wallet.Account(wif);
  const encrypted = await encryptPrivateKeyBrowser(account.privateKey, password);

  return {
    address: account.address,
    publicKey: account.publicKey,
    encrypted,
  };
}

/**
 * Validate WIF format
 */
export function validateWif(wif: string): boolean {
  try {
    new wallet.Account(wif);
    return true;
  } catch {
    return false;
  }
}

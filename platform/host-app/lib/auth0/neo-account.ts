/**
 * Neo account generation and management for OAuth users
 */

import { wallet } from "@cityofzion/neon-js";
import { encryptPrivateKey, decryptPrivateKey } from "./crypto";

export interface NeoAccount {
  address: string;
  publicKey: string;
  privateKey: string;
}

export interface EncryptedAccount {
  address: string;
  publicKey: string;
  encryptedPrivateKey: string;
  salt: string;
  iv: string;
  tag: string;
  iterations: number;
}

/**
 * Generate new Neo account
 */
export function generateNeoAccount(): NeoAccount {
  const account = new wallet.Account();

  return {
    address: account.address,
    publicKey: account.publicKey,
    privateKey: account.privateKey,
  };
}

/**
 * Encrypt Neo account with password
 */
export function encryptNeoAccount(account: NeoAccount, password: string): EncryptedAccount {
  const encrypted = encryptPrivateKey(account.privateKey, password);

  return {
    address: account.address,
    publicKey: account.publicKey,
    encryptedPrivateKey: encrypted.encryptedData,
    salt: encrypted.salt,
    iv: encrypted.iv,
    tag: encrypted.tag,
    iterations: encrypted.iterations,
  };
}

/**
 * Decrypt Neo account with password
 */
export function decryptNeoAccount(encryptedAccount: EncryptedAccount, password: string): NeoAccount {
  const privateKey = decryptPrivateKey(
    encryptedAccount.encryptedPrivateKey,
    password,
    encryptedAccount.salt,
    encryptedAccount.iv,
    encryptedAccount.tag,
    encryptedAccount.iterations,
  );

  return {
    address: encryptedAccount.address,
    publicKey: encryptedAccount.publicKey,
    privateKey,
  };
}

/**
 * Verify account password
 */
export function verifyAccountPassword(encryptedAccount: EncryptedAccount, password: string): boolean {
  try {
    decryptNeoAccount(encryptedAccount, password);
    return true;
  } catch {
    return false;
  }
}

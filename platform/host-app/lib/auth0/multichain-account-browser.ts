/**
 * Multi-Chain Account Generation (Browser-side)
 * Supports Neo N3 with client-side encryption
 */

import { wallet } from "@cityofzion/neon-js";
import type { BrowserEncryptionResult } from "../wallet/crypto-browser";
import { encryptPrivateKeyBrowser } from "../wallet/crypto-browser";
import type { ChainId, ChainType } from "../chains/types";

// ============================================================================
// Types
// ============================================================================

export interface MultiChainAccount {
  chainId: ChainId;
  chainType: ChainType;
  address: string;
  publicKey: string;
  privateKey: string;
}

export interface EncryptedMultiChainAccount {
  chainId: ChainId;
  chainType: ChainType;
  address: string;
  publicKey: string;
  encrypted: BrowserEncryptionResult;
}

// ============================================================================
// Neo N3 Account Generation
// ============================================================================

function generateNeoAccount(chainId: ChainId): MultiChainAccount {
  const account = new wallet.Account();
  return {
    chainId,
    chainType: "neo-n3",
    address: account.address,
    publicKey: account.publicKey,
    privateKey: account.privateKey,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate account for specified chain
 */
export async function generateMultiChainAccount(chainId: ChainId, chainType: ChainType): Promise<MultiChainAccount> {
  if (chainType === "neo-n3") {
    return generateNeoAccount(chainId);
  }
  throw new Error(`Unsupported chain type: ${chainType}`);
}

/**
 * Generate and encrypt account for specified chain
 */
export async function generateEncryptedMultiChainAccount(
  chainId: ChainId,
  chainType: ChainType,
  password: string,
): Promise<EncryptedMultiChainAccount> {
  const account = await generateMultiChainAccount(chainId, chainType);
  const encrypted = await encryptPrivateKeyBrowser(account.privateKey, password);

  return {
    chainId: account.chainId,
    chainType: account.chainType,
    address: account.address,
    publicKey: account.publicKey,
    encrypted,
  };
}

/**
 * Generate accounts for multiple chains with same password
 */
export async function generateMultipleChainAccounts(
  chains: Array<{ chainId: ChainId; chainType: ChainType }>,
  password: string,
): Promise<EncryptedMultiChainAccount[]> {
  const accounts: EncryptedMultiChainAccount[] = [];

  for (const { chainId, chainType } of chains) {
    const account = await generateEncryptedMultiChainAccount(chainId, chainType, password);
    accounts.push(account);
  }

  return accounts;
}

/**
 * Import private key and encrypt for specified chain
 */
export async function importAndEncryptPrivateKey(
  chainId: ChainId,
  chainType: ChainType,
  privateKey: string,
  password: string,
): Promise<EncryptedMultiChainAccount> {
  let address: string;
  let publicKey: string;

  if (chainType === "neo-n3") {
    // Neo N3: Import WIF or hex private key
    const account = new wallet.Account(privateKey);
    address = account.address;
    publicKey = account.publicKey;
  } else {
    throw new Error(`Unsupported chain type: ${chainType}`);
  }

  const encrypted = await encryptPrivateKeyBrowser(privateKey, password);

  return {
    chainId,
    chainType,
    address,
    publicKey,
    encrypted,
  };
}

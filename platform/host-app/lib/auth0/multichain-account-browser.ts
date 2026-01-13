/**
 * Multi-Chain Account Generation (Browser-side)
 * Supports Neo N3 and EVM chains with client-side encryption
 */

import { wallet } from "@cityofzion/neon-js";
import { encryptPrivateKeyBrowser, BrowserEncryptionResult } from "../wallet/crypto-browser";
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
// EVM Account Generation
// ============================================================================

async function generateEVMAccount(chainId: ChainId): Promise<MultiChainAccount> {
  // Generate random 32 bytes for private key
  const privateKeyBytes = window.crypto.getRandomValues(new Uint8Array(32));
  const privateKey =
    "0x" +
    Array.from(privateKeyBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  // Derive public key and address using secp256k1
  // For browser, we use a simplified approach with ethers-like derivation
  const { address, publicKey } = await deriveEVMAddressFromPrivateKey(privateKeyBytes);

  return {
    chainId,
    chainType: "evm",
    address,
    publicKey,
    privateKey,
  };
}

/**
 * Derive EVM address from private key using Web Crypto
 * Uses secp256k1 curve (standard for Ethereum)
 */
async function deriveEVMAddressFromPrivateKey(
  privateKeyBytes: Uint8Array,
): Promise<{ address: string; publicKey: string }> {
  // Import secp256k1 operations
  // Note: Web Crypto doesn't support secp256k1 directly, so we use a pure JS implementation
  const { getPublicKey, keccak256 } = await import("./evm-crypto");

  const publicKeyBytes = getPublicKey(privateKeyBytes);
  const publicKey =
    "0x" +
    Array.from(publicKeyBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  // Ethereum address = last 20 bytes of keccak256(publicKey[1:])
  const publicKeyWithoutPrefix = publicKeyBytes.slice(1); // Remove 0x04 prefix
  const hash = keccak256(publicKeyWithoutPrefix);
  const addressBytes = hash.slice(-20);
  const address =
    "0x" +
    Array.from(addressBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  return { address: address.toLowerCase(), publicKey };
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
  } else if (chainType === "evm") {
    return await generateEVMAccount(chainId);
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
  } else if (chainType === "evm") {
    // EVM: Import hex private key
    const keyHex = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
    const keyBytes = new Uint8Array(keyHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
    const derived = await deriveEVMAddressFromPrivateKey(keyBytes);
    address = derived.address;
    publicKey = derived.publicKey;
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

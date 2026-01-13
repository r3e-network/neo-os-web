/**
 * Input validation utilities
 * Supports multi-chain address validation (Neo N3, EVM)
 */

import type { ChainType } from "../chains/types";

// Address format patterns
const NEO_N3_ADDRESS_PATTERN = /^N[A-Za-z0-9]{33}$/;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * Validate Neo N3 address format
 */
export function isValidNeoAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  return NEO_N3_ADDRESS_PATTERN.test(address);
}

/**
 * Validate EVM address format (Ethereum, NeoX, Polygon, BSC, etc.)
 */
export function isValidEVMAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  return EVM_ADDRESS_PATTERN.test(address);
}

/**
 * Validate wallet address for any supported chain type
 */
export function isValidWalletAddress(address: string, chainType?: ChainType): boolean {
  if (!address || typeof address !== "string") return false;

  if (chainType === "neo-n3") {
    return isValidNeoAddress(address);
  }
  if (chainType === "evm") {
    return isValidEVMAddress(address);
  }

  // If no chain type specified, accept either format
  return isValidNeoAddress(address) || isValidEVMAddress(address);
}

/**
 * Detect chain type from address format
 */
export function detectAddressChainType(address: string): ChainType | null {
  if (!address || typeof address !== "string") return null;

  if (isValidNeoAddress(address)) return "neo-n3";
  if (isValidEVMAddress(address)) return "evm";

  return null;
}

/**
 * Normalize EVM address to checksum format
 */
export function normalizeEVMAddress(address: string): string {
  if (!isValidEVMAddress(address)) return address;
  return address.toLowerCase();
}

export function isValidAppId(appId: string): boolean {
  if (!appId || typeof appId !== "string") return false;
  // Allow alphanumeric, hyphens, underscores, 1-64 chars
  return /^[a-zA-Z0-9_-]{1,64}$/.test(appId);
}

export function sanitizeString(input: string, maxLength = 500): string {
  if (!input || typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

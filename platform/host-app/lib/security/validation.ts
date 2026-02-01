/**
 * Input validation utilities
 * Supports Neo N3 address validation
 */

import type { ChainType } from "../chains/types";

// ============================================================================
// Patterns
// ============================================================================

const NEO_N3_ADDRESS_PATTERN = /^N[A-Za-z0-9]{33}$/;
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

// ============================================================================
// Address Validation
// ============================================================================

export function isValidNeoAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  return NEO_N3_ADDRESS_PATTERN.test(address);
}

export function isValidWalletAddress(address: string, chainType?: ChainType): boolean {
  if (!address || typeof address !== "string") return false;
  if (chainType && chainType !== "neo-n3") return false;
  return isValidNeoAddress(address);
}

export function detectAddressChainType(address: string): ChainType | null {
  if (!address || typeof address !== "string") return null;
  if (isValidNeoAddress(address)) return "neo-n3";
  return null;
}

// ============================================================================
// String Validation
// ============================================================================

export function isValidAppId(appId: string): boolean {
  if (!appId || typeof appId !== "string") return false;
  return /^[a-zA-Z0-9_-]{1,64}$/.test(appId);
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string" || email.length > 254) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email);
}

export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== "string") return false;
  return UUID_PATTERN.test(uuid);
}

export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return URL_PATTERN.test(url);
}

export function isValidTxHash(hash: string): boolean {
  if (!hash || typeof hash !== "string") return false;
  return TX_HASH_PATTERN.test(hash);
}

// ============================================================================
// Sanitization
// ============================================================================

export function sanitizeString(input: string, maxLength = 500): string {
  if (!input || typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}

export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ============================================================================
// Number Validation
// ============================================================================

export function isValidAmount(amount: string): boolean {
  if (!amount || typeof amount !== "string") return false;
  const num = parseFloat(amount);
  return !isNaN(num) && isFinite(num) && num >= 0;
}

export function isValidInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export function isInRange(value: number, min: number, max: number): boolean {
  return typeof value === "number" && value >= min && value <= max;
}

// ============================================================================
// Validation Result Type
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function createValidationResult(errors: string[] = []): ValidationResult {
  return { valid: errors.length === 0, errors };
}

export function validateRequired(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === "") {
    return `${fieldName} is required`;
  }
  return null;
}

export function validateMaxLength(value: string, max: number, fieldName: string): string | null {
  if (value && value.length > max) {
    return `${fieldName} must be at most ${max} characters`;
  }
  return null;
}

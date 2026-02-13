/**
 * Input validation utilities
 * Supports Neo N3 address validation
 * Powered by zod schemas with backward-compatible function API
 */

import { z } from "zod";
import type { ChainType } from "../chains/types";

// ============================================================================
// Zod Schemas
// ============================================================================

const neoN3AddressSchema = z.string().regex(/^N[A-Za-z0-9]{33}$/);
const txHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const uuidSchema = z.string().uuid();
const urlSchema = z.string().regex(/^https?:\/\/[^\s/$.?#].[^\s]*$/i);
const appIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const emailSchema = z
  .string()
  .max(254)
  .regex(
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  );

// ============================================================================
// Address Validation
// ============================================================================

export function isValidNeoAddress(address: string): boolean {
  return neoN3AddressSchema.safeParse(address).success;
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
  return appIdSchema.safeParse(appId).success;
}

export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

export function isValidUUID(uuid: string): boolean {
  return uuidSchema.safeParse(uuid).success;
}

export function isValidUrl(url: string): boolean {
  return urlSchema.safeParse(url).success;
}

export function isValidTxHash(hash: string): boolean {
  return txHashSchema.safeParse(hash).success;
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

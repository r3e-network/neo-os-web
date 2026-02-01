/**
 * Type Safety Utilities
 *
 * Provides type guards, validators, and runtime type checking utilities
 * for Edge Functions to improve type safety and reduce runtime errors.
 */

// Deno global type definitions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is not null or undefined
 */
export function isNotNullOrUndefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Check if a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && value > 0;
}

/**
 * Check if a value is a valid integer
 */
export function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/**
 * Check if a value is a valid hex string
 */
export function isHexString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^0x[0-9a-fA-F]*$/.test(value);
}

/**
 * Check if a value is a valid Neo address
 */
export function isNeoAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // Neo N3 addresses are 20 bytes (40 hex chars) with optional 0x prefix
  const hexPattern = /^0x[0-9a-fA-F]{40}$/;
  return hexPattern.test(value);
}

/**
 * Check if a value is a valid chain ID
 */
export function isValidChainId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // Chain IDs should be lowercase with hyphens (e.g., neo-n3-mainnet)
  return /^[a-z0-9-]+$/.test(value) && value.length > 0;
}

// ============================================================================
// Array Type Guards
// ============================================================================

/**
 * Check if array has at least one element
 */
export function isNonEmptyArray<T>(value: unknown): value is [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Check if array has exact length
 */
export function hasLength<T>(arr: T[], length: number): boolean {
  return arr.length === length;
}

/**
 * Check if array has at least minimum length
 */
export function hasMinLength<T>(arr: T[], minLength: number): boolean {
  return arr.length >= minLength;
}

/**
 * Check if array has at most maximum length
 */
export function hasMaxLength<T>(arr: T[], maxLength: number): boolean {
  return arr.length <= maxLength;
}

// ============================================================================
// Object Type Guards
// ============================================================================

/**
 * Check if value is a plain object (not null, not array, not function)
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  );
}

/**
 * Check if object has a specific property
 */
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return isPlainObject(obj) && key in obj;
}

/**
 * Check if object has all required properties
 */
export function hasProperties<K extends string>(obj: unknown, keys: K[]): obj is Record<K, unknown> {
  if (!isPlainObject(obj)) return false;
  return keys.every((key) => key in obj);
}

// ============================================================================
// String Validators
// ============================================================================

/**
 * Validate email format (basic check)
 */
export function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Validate URL format
 */
export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate UUID format
 */
export function isValidUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate that string is within length bounds
 */
export function isValidLength(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

// ============================================================================
// Number Validators
// ============================================================================

/**
 * Validate number is within range (inclusive)
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate BigInt is positive
 */
export function isPositiveBigInt(value: bigint): boolean {
  return value > 0n;
}

/**
 * Validate BigInt is within range
 */
export function isBigIntInRange(value: bigint, min: bigint, max: bigint): boolean {
  return value >= min && value <= max;
}

// ============================================================================
// Assertion Functions (throw on failure)
// ============================================================================

/**
 * Assert that value is not null or undefined, throw otherwise
 */
export function assertNotNull<T>(value: T | null | undefined, message?: string): T {
  if (value === null || value === undefined) {
    throw new Error(message || "Value is null or undefined");
  }
  return value;
}

/**
 * Assert that value is a non-empty string, throw otherwise
 */
export function assertNonEmptyString(value: unknown, message?: string): string {
  if (!isNonEmptyString(value)) {
    throw new Error(message || "Value must be a non-empty string");
  }
  return value;
}

/**
 * Assert that value is a positive number, throw otherwise
 */
export function assertPositiveNumber(value: unknown, message?: string): number {
  if (!isPositiveNumber(value)) {
    throw new Error(message || "Value must be a positive number");
  }
  return value;
}

/**
 * Assert that condition is true, throw otherwise
 */
export function assert(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

// ============================================================================
// Type Coercion Utilities
// ============================================================================

/**
 * Safely convert value to string, throw on invalid input
 */
export function toString(value: unknown, fieldName?: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  throw new Error(`Cannot convert ${typeof value} to string${fieldName ? ` for field: ${fieldName}` : ""}`);
}

/**
 * Safely convert value to number, throw on invalid input
 */
export function toNumber(value: unknown, fieldName?: string): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number(value);
    if (!isNaN(num)) return num;
  }
  throw new Error(`Cannot convert ${typeof value} to number${fieldName ? ` for field: ${fieldName}` : ""}`);
}

/**
 * Safely convert value to BigInt, throw on invalid input
 */
export function toBigInt(value: unknown, fieldName?: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") {
    try {
      return BigInt(value);
    } catch {
      throw new Error(`Invalid BigInt string: ${value}`);
    }
  }
  throw new Error(`Cannot convert ${typeof value} to BigInt${fieldName ? ` for field: ${fieldName}` : ""}`);
}

// ============================================================================
// Enum-like Type Guards
// ============================================================================

/**
 * Check if value is one of the allowed values
 */
export function isOneOf<T>(value: unknown, allowed: readonly T[]): value is T {
  return allowed.some((item) => item === value);
}

/**
 * Create a type guard from an array of allowed values
 */
export function createEnumGuard<T extends string>(allowed: readonly T[]): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return typeof value === "string" && allowed.includes(value as T);
  };
}

// ============================================================================
// Default Value Utilities
// ============================================================================

/**
 * Get value or default if null/undefined
 */
export function withDefault<T>(value: T | null | undefined, defaultValue: T): T {
  return value !== null && value !== undefined ? value : defaultValue;
}

/**
 * Get value or compute default if null/undefined
 */
export function withDefaultLazy<T>(value: T | null | undefined, defaultFactory: () => T): T {
  return value !== null && value !== undefined ? value : defaultFactory();
}

// ============================================================================
// Environment Variable Validators
// ============================================================================

/**
 * Get required environment variable or throw
 */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Required environment variable not set: ${name}`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
export function getEnvOrDefault(name: string, defaultValue: string): string {
  return Deno.env.get(name) || defaultValue;
}

/**
 * Get environment variable as number or throw
 */
export function requireEnvNumber(name: string): number {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Required environment variable not set: ${name}`);
  }
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${name} must be a number: ${value}`);
  }
  return num;
}

/**
 * Get environment variable as boolean
 */
export function getEnvBoolean(name: string, defaultValue: boolean = false): boolean {
  const value = Deno.env.get(name)?.toLowerCase();
  if (!value) return defaultValue;
  return value === "true" || value === "1" || value === "yes";
}

/**
 * Validate environment variable matches pattern
 */
export function requireEnvMatch(name: string, pattern: RegExp): string {
  const value = requireEnv(name);
  if (!pattern.test(value)) {
    throw new Error(`Environment variable ${name} must match pattern ${pattern.source}: ${value}`);
  }
  return value;
}

// ============================================================================
// Record Type Utilities
// ============================================================================

/**
 * Pick specific keys from a record
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from a record
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

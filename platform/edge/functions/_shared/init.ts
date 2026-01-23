/**
 * Edge Function Initialization Module
 *
 * This module should be imported at the top level of Edge functions
 * to ensure environment validation happens at startup (fail-fast).
 *
 * Usage:
 *   import "./_shared/init.ts";
 *
 * The validation runs once when the module is first loaded,
 * preventing the function from starting if critical config is missing.
 */

// Deno global type definitions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { validateOrFail } from "./env-validation.ts";

// ============================================================================
// Startup Validation (Fail-Fast)
// ============================================================================

/**
 * Validate environment at module load time.
 *
 * This throws if critical environment variables are missing,
 * preventing the Edge function from starting in an invalid state.
 *
 * In development, warnings are logged but don't block startup.
 * In production, missing critical variables will throw.
 */
try {
  validateOrFail();
  console.log("[Init] Environment validation passed");
} catch (error) {
  console.error("[Init] CRITICAL: Environment validation failed:");
  console.error(error);
  throw error;
}

// ============================================================================
// Runtime Configuration (Cached)
// ============================================================================

/**
 * Get validated environment variable
 * @throws Error if variable is not set (should not happen after validation)
 */
export function getValidatedEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Required environment variable not set: ${name}`);
  }
  return value;
}

/**
 * Get validated environment variable with fallback
 */
export function getValidatedEnvOrDefault(name: string, defaultValue: string): string {
  return Deno.env.get(name) || defaultValue;
}

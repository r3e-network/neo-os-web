/**
 * Environment Configuration Validation (Zod-based)
 *
 * Validates required environment variables at Edge function startup.
 * Provides clear error messages for missing or invalid configuration.
 */

import { z } from "npm:zod";

// Deno global type definitions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// ============================================================================
// Zod Schema Definition
// ============================================================================

const envSchema = z.object({
  // Core Infrastructure
  DATABASE_URL: z.string().startsWith("postgresql://"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32),

  // Neo Blockchain RPC
  NEO_RPC_URL: z.string().startsWith("http"),
  NEO_MAINNET_RPC_URL: z.string().startsWith("http").optional(),
  NEO_TESTNET_RPC_URL: z.string().startsWith("http").optional(),

  // Platform Services
  SERVICE_LAYER_URL: z.string().startsWith("http"),
  TXPROXY_URL: z.string().startsWith("http"),
  PLATFORM_EDGE_URL: z.string().optional(),

  // Security
  EDGE_CORS_ORIGINS: z.string().min(1),
  DENO_ENV: z.string().optional().default("production"),

  // Chain Configuration
  CHAINS_CONFIG_JSON: z.string().optional(),

  // TEE Services (optional)
  TEE_VRF_URL: z.string().optional(),
  TEE_PRICEFEED_URL: z.string().optional(),
  TEE_COMPUTE_URL: z.string().optional(),
});

/** All env var names tracked by the schema */
const ALL_ENV_KEYS = Object.keys(envSchema.shape) as (keyof typeof envSchema.shape)[];

// ============================================================================
// Exported Interfaces (backward-compatible)
// ============================================================================

export interface EnvValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  variable: string;
  message: string;
  severity: "critical";
}

export interface ValidationWarning {
  variable: string;
  message: string;
  severity: "info";
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Build a partial env object from Deno.env for all schema keys */
function buildEnvObject(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const key of ALL_ENV_KEYS) {
    env[key] = Deno.env.get(key);
  }
  return env;
}

/** Convert Zod issues into our ValidationError format */
function zodIssuesToErrors(issues: z.ZodIssue[]): ValidationError[] {
  return issues.map((issue) => ({
    variable: issue.path.join("."),
    message: `${issue.path.join(".")}: ${issue.message}`,
    severity: "critical" as const,
  }));
}

// ============================================================================
// Exported Functions (signatures identical to previous implementation)
// ============================================================================

/**
 * Validate all environment variables
 * @param _categories - Unused, kept for backward compatibility
 * @returns Validation result with errors and warnings
 */
export function validateEnvironment(_categories?: unknown): EnvValidationResult {
  const env = buildEnvObject();
  const result = envSchema.safeParse(env);

  const errors: ValidationError[] = result.success ? [] : zodIssuesToErrors(result.error.issues);
  const warnings: ValidationWarning[] = [];

  // Additional validation: CORS must be set in production
  const denoEnv = Deno.env.get("DENO_ENV") || "";
  const isProduction = denoEnv.includes("prod");
  const corsOrigins = Deno.env.get("EDGE_CORS_ORIGINS");

  if (isProduction && !corsOrigins) {
    errors.push({
      variable: "EDGE_CORS_ORIGINS",
      message: "EDGE_CORS_ORIGINS must be set in production mode",
      severity: "critical",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get environment variable with error handling
 * @throws Error if required variable is missing
 */
export function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Required environment variable not set: ${name}`);
  }
  return value;
}

/**
 * Get environment variable with fallback
 */
export function getEnv(name: string, defaultValue?: string): string | undefined {
  return Deno.env.get(name) || defaultValue;
}

/**
 * Validate environment and throw if critical errors found.
 * Use this at Edge function startup for fail-fast behavior.
 * @param categories - Unused, kept for backward compatibility
 * @throws Error if validation fails
 */
export function validateOrFail(categories?: unknown): void {
  const result = validateEnvironment(categories);

  if (!result.valid) {
    const errorMessages = result.errors.map((e) => `${e.variable}: ${e.message}`).join("\n");
    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }

  if (result.warnings.length > 0) {
    console.warn("[Environment] Warnings:");
    for (const warning of result.warnings) {
      console.warn(`  - ${warning.variable}: ${warning.message}`);
    }
  }
}

/**
 * Get environment validation summary for health checks
 */
export function getEnvSummary(): {
  valid: boolean;
  error_count: number;
  warning_count: number;
  errors: string[];
  warnings: string[];
} {
  const result = validateEnvironment();

  return {
    valid: result.valid,
    error_count: result.errors.length,
    warning_count: result.warnings.length,
    errors: result.errors.map((e) => e.variable),
    warnings: result.warnings.map((w) => w.variable),
  };
}

/**
 * Environment Configuration Validation
 *
 * Validates required environment variables at Edge function startup.
 * Provides clear error messages for missing or invalid configuration.
 */

// Deno global type definitions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// ============================================================================
// Environment Variable Definitions
// ============================================================================

interface EnvVarSpec {
  name: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
  defaultValue?: string;
  examples?: string[];
}

// Core Infrastructure
const CORE_ENV_VARS: EnvVarSpec[] = [
  {
    name: "DATABASE_URL",
    required: true,
    description: "PostgreSQL connection string for database",
    validator: (v) => v.startsWith("postgresql://"),
  },
  {
    name: "SUPABASE_URL",
    required: true,
    description: "Supabase project URL",
    validator: (v) => v.startsWith("https://"),
  },
  {
    name: "SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous/public key for RLS",
  },
  {
    name: "JWT_SECRET",
    required: true,
    description: "Secret key for JWT token validation",
    validator: (v) => v.length >= 32,
  },
];

// Neo Blockchain RPC
const NEO_RPC_ENV_VARS: EnvVarSpec[] = [
  {
    name: "NEO_RPC_URL",
    required: true,
    description: "Primary Neo N3 RPC endpoint",
    validator: (v) => v.startsWith("http"),
  },
  {
    name: "NEO_MAINNET_RPC_URL",
    required: false,
    description: "Neo N3 Mainnet RPC endpoint",
    validator: (v) => v.startsWith("http"),
  },
  {
    name: "NEO_TESTNET_RPC_URL",
    required: false,
    description: "Neo N3 Testnet RPC endpoint",
    validator: (v) => v.startsWith("http"),
  },
];

// Platform Services
const PLATFORM_ENV_VARS: EnvVarSpec[] = [
  {
    name: "SERVICE_LAYER_URL",
    required: true,
    description: "Service layer gateway URL",
    validator: (v) => v.startsWith("http"),
  },
  {
    name: "TXPROXY_URL",
    required: true,
    description: "TxProxy service URL",
    validator: (v) => v.startsWith("http"),
  },
  {
    name: "PLATFORM_EDGE_URL",
    required: false,
    description: "Platform Edge base URL (optional)",
  },
];

// Security
const SECURITY_ENV_VARS: EnvVarSpec[] = [
  {
    name: "EDGE_CORS_ORIGINS",
    required: true,
    description: "CORS allowed origins (comma-separated, required in production)",
    validator: (v) => v.length > 0,
  },
  {
    name: "DENO_ENV",
    required: false,
    description: "Deno environment (development/production)",
    defaultValue: "production",
    examples: ["development", "production", "dev", "prod"],
  },
];

// Chain Configuration
const CHAIN_ENV_VARS: EnvVarSpec[] = [
  {
    name: "CHAINS_CONFIG_JSON",
    required: false,
    description: "Optional JSON override for chain configurations",
  },
];

// TEE Services (optional)
const TEE_ENV_VARS: EnvVarSpec[] = [
  {
    name: "TEE_VRF_URL",
    required: false,
    description: "TEE VRF service URL",
  },
  {
    name: "TEE_PRICEFEED_URL",
    required: false,
    description: "TEE PriceFeed service URL",
  },
  {
    name: "TEE_COMPUTE_URL",
    required: false,
    description: "TEE Compute service URL",
  },
];

// All environment categories
const ALL_ENV_SPECS = [
  ...CORE_ENV_VARS,
  ...NEO_RPC_ENV_VARS,
  ...PLATFORM_ENV_VARS,
  ...SECURITY_ENV_VARS,
  ...CHAIN_ENV_VARS,
  ...TEE_ENV_VARS,
];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Result of environment variable validation
 */
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

/**
 * Validate a single environment variable
 */
function validateEnvVar(spec: EnvVarSpec): ValidationError | ValidationWarning | null {
  const value = Deno.env.get(spec.name);

  // Check if required but missing
  if (spec.required && !value && !spec.defaultValue) {
    return {
      variable: spec.name,
      message: `Required environment variable not set: ${spec.name}`,
      severity: "critical",
    };
  }

  // Use default value if present
  const actualValue = value || spec.defaultValue;

  // Skip validation if empty and not required
  if (!actualValue) {
    return null;
  }

  // Run custom validator if provided
  if (spec.validator && !spec.validator(actualValue)) {
    return {
      variable: spec.name,
      message: `Invalid value for ${spec.name}: ${actualValue}`,
      severity: "critical",
    };
  }

  return null;
}

/**
 * Validate all environment variables
 * @returns Validation result with errors and warnings
 */
export function validateEnvironment(categories?: EnvVarSpec[]): EnvValidationResult {
  const specs = categories || ALL_ENV_SPECS;

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const spec of specs) {
    const result = validateEnvVar(spec);
    if (result?.severity === "critical") {
      errors.push(result);
    } else if (result) {
      warnings.push(result);
    }
  }

  // Additional validation: check for development mode in production
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
 * Validate environment and throw if critical errors found
 * Use this at Edge function startup for fail-fast behavior
 * @throws Error if validation fails
 */
export function validateOrFail(categories?: EnvVarSpec[]): void {
  const result = validateEnvironment(categories);

  if (!result.valid) {
    const errorMessages = result.errors.map((e) => `${e.variable}: ${e.message}`).join("\n");
    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }

  // Log warnings if any (non-blocking)
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

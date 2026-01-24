# Environment Validation System

## Overview

The Edge Functions use a centralized environment validation system to ensure all required configuration is present at startup. This implements **fail-fast** behavior - functions will not start if critical environment variables are missing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Edge Function Startup                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  1. Import init.ts (side-effect import)                   │ │
│  │     ↓                                                      │ │
│  │  2. validateOrFail() called                               │ │
│  │     ↓                                                      │ │
│  │  3. Environment variables validated                       │ │
│  │     ↓                                                      │ │
│  │  4. Function starts OR throws error                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Runtime: Use getValidatedEnv() for type-safe access      │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Files

- **`_shared/env-validation.ts`**: Core validation logic
- **`_shared/init.ts`**: Startup initialization module
- **`_shared/error-codes.ts`**: Error code definitions

## Usage

### 1. Basic Integration

Add this as the **first import** in your Edge function:

```typescript
// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

import { handleCorsPreflight } from "../_shared/cors.ts";
// ... rest of imports
```

### 2. Validated Environment Access

Use the exported helper functions for type-safe environment access:

```typescript
import { getValidatedEnv, getValidatedEnvOrDefault } from "../_shared/init.ts";

// Required variable (throws if missing)
const dbUrl = getValidatedEnv("DATABASE_URL");

// Optional variable with default
const port = getValidatedEnvOrDefault("PORT", "8080");
```

### 3. Manual Validation (Advanced)

For custom validation scenarios:

```typescript
import { validateEnvironment, validateOrFail } from "../_shared/env-validation.ts";

// Fail-fast validation (throws on error)
validateOrFail();

// Or validate and handle result
const result = validateEnvironment();
if (!result.valid) {
    console.error("Environment errors:", result.errors);
}
```

## Environment Variable Categories

### Core Infrastructure (Required)

- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `JWT_SECRET` - JWT validation secret (min 32 chars)

### Neo Blockchain RPC

- `NEO_RPC_URL` - Primary Neo N3 RPC endpoint (required)
- `NEO_MAINNET_RPC_URL` - Mainnet RPC (optional)
- `NEO_TESTNET_RPC_URL` - Testnet RPC (optional)

### Platform Services (Required)

- `SERVICE_LAYER_URL` - Service layer gateway
- `TXPROXY_URL` - TxProxy service URL
- `PLATFORM_EDGE_URL` - Platform Edge base URL (optional)

### Security (Required)

- `EDGE_CORS_ORIGINS` - CORS allowed origins (comma-separated)
- `DENO_ENV` - Environment mode (default: "production")

### Chain Configuration

- `CHAINS_CONFIG_JSON` - Optional JSON override for chains

### TEE Services (Optional)

- `TEE_VRF_URL` - VRF service URL
- `TEE_PRICEFEED_URL` - PriceFeed service URL
- `TEE_COMPUTE_URL` - Compute service URL

## Validation Rules

### Required Variables

- Must be present and non-empty
- Validators run additional checks (format, length, etc.)
- Missing required variables cause startup to **fail**

### Optional Variables

- May be missing or empty
- No error if absent
- Validators only run if value is present

### Production Mode Checks

When `DENO_ENV` contains "prod":

- `EDGE_CORS_ORIGINS` must be set (security requirement)

## Error Handling

### Startup Failure

If validation fails, the function logs detailed errors and throws:

```
[Init] CRITICAL: Environment validation failed:
Error: Environment validation failed:
DATABASE_URL: Required environment variable not set: DATABASE_URL
SUPABASE_URL: Required environment variable not set: SUPABASE_URL
```

### Runtime Access

Using `getValidatedEnv()` after startup should never fail (validation already happened):

```typescript
// Safe to use - env was validated at startup
const dbUrl = getValidatedEnv("DATABASE_URL");
```

## Testing

### Local Development

Set environment variables in `.env` or via shell:

```bash
export DATABASE_URL="postgresql://localhost:5432/mydb"
export SUPABASE_URL="https://myproject.supabase.co"
export SUPABASE_ANON_KEY="my-anon-key"
export JWT_SECRET="my-super-secret-key-at-least-32-chars"

# Run function
deno run --allow-env --allow-net function/index.ts
```

### Supabase Edge Functions

Set environment variables in Supabase dashboard:

1. Go to Project Settings → Edge Functions
2. Add environment variables
3. Deploy function

Validation runs automatically on each deployment.

## Best Practices

1. **Always import `init.ts` first** - before any other imports
2. **Use `getValidatedEnv()`** for runtime access instead of `Deno.env.get()`
3. **Set defaults in code** for non-critical values using `getValidatedEnvOrDefault()`
4. **Document required env vars** in your function's README
5. **Test validation** by removing env vars and verifying startup fails

## Troubleshooting

### Function won't start

Check the logs for validation errors:

```typescript
Error: Environment validation failed:
NEO_RPC_URL: Required environment variable not set: NEO_RPC_URL
```

**Solution**: Add the missing environment variable to your deployment.

### Type errors in IDE

If you see "Cannot find name 'Deno' errors":

1. Ensure you have Deno types installed
2. The `declare const Deno` block in `env-validation.ts` provides basic types
3. For full IDE support, use the Deno language server

### Validation passes but function fails later

This indicates a logic error, not a configuration error:

1. Check your code uses `getValidatedEnv()` correctly
2. Verify the variable name matches exactly (case-sensitive)
3. Check for typos in environment variable names

## Migration Guide

### Existing Functions

To add validation to an existing Edge function:

1. Add the init import at the top of the file:

    ```typescript
    import "../_shared/init.ts";
    ```

2. Replace `Deno.env.get()` calls:

    ```typescript
    // Before
    const dbUrl = Deno.env.get("DATABASE_URL");

    // After
    import { getValidatedEnv } from "../_shared/init.ts";
    const dbUrl = getValidatedEnv("DATABASE_URL");
    ```

3. Deploy and test

### New Functions

Always include the init import from the start:

```typescript
// My new Edge Function
import "../_shared/init.ts";

import { handleCorsPreflight } from "../_shared/cors.ts";
// ... rest of code
```

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-23
**Related Docs:** [EMERGENCY_RUNBOOK.md](./EMERGENCY_RUNBOOK.md), [CONTRACT_UPGRADE_SOP.md](./CONTRACT_UPGRADE_SOP.md)

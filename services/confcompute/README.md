# NeoCompute Service

Confidential JavaScript execution service for the Neo Service Layer.

## Overview

The NeoCompute service executes user-provided JavaScript inside the MarbleRun TEE using the `goja` runtime. It supports injecting user secrets (by reference) into the script environment and returns structured output plus optional cryptographic protection fields (output hash + HMAC signature, and optional encrypted output).

This service is intended to be reached via the gateway (Supabase Edge) rather than directly.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    User      │     │ NeoCompute   │     │ TEE          │
│              │     │ Service      │     │ (MarbleRun)  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ Submit Data        │                    │
       │ (encrypted)        │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ Decrypt & Process  │
       │                    │───────────────────>│
       │                    │                    │
       │                    │ Encrypted Result   │
       │                    │<───────────────────│
       │                    │                    │
       │ Result + Attestation                    │
       │<───────────────────│                    │
```

## Features

- **Script execution**: JavaScript execution with resource limits
- **Secret injection**: `secret_refs` are resolved via the shared secrets subsystem with per-secret allowlists
- **Output protection**: optional `output_hash` + HMAC `signature` and optional `encrypted_output`
- **Job retention**: results are kept in-memory for a configurable TTL

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/info` | GET | Service status |
| `/execute` | POST | Execute JavaScript |
| `/jobs` | GET | List user's jobs |
| `/jobs/{id}` | GET | Get job result |

## Request/Response Types

### Execute JavaScript

```json
POST /execute
{
    "script": "function main(input, secrets) { return { ok: true } }",
    "entry_point": "main",
    "input": {"any": "json"},
    "secret_refs": ["my_api_key"],
    "timeout": 30
}
```

### Execute Response

```json
{
    "job_id": "uuid",
    "status": "completed",
    "output": {"ok": true},
    "logs": ["..."],
    "gas_used": 12345,
    "started_at": "2025-12-07T09:00:00Z",
    "duration": "12ms",
    "encrypted_output": "<base64>",
    "output_hash": "<hex>",
    "signature": "<hex>"
}
```

## Configuration

| Variable | Description |
|----------|-------------|
| `NEOCOMPUTE_RESULT_TTL` | Result retention TTL (e.g. `24h`) |

Required secrets (strict identity / SGX mode):

- `COMPUTE_MASTER_KEY` (32 bytes+): master key used for output encryption + signing key derivation.
- `SECRETS_MASTER_KEY` (32 bytes): required when using `secret_refs` (shared secrets subsystem).

## Testing

```bash
go test ./services/confcompute/... -v -cover
```

Current test coverage: **65.3%**

## Version

- Service ID: `neocompute`
- Version: `1.0.0`
- Status: **Beta**

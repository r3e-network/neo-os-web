# Nitro SDK Wrapper

This package is a thin SDK that wraps  primitives for services:
- Loads KMS/Platform-injected TLS certs/CA and builds an mTLS HTTP client for cross-nitro traffic.
- Exposes injected secrets via `Nitro.Secret/UseSecret`.
- Surfaces TEE identity (report, UUID, nitro type) to services.

We keep this layer even though  is used because it provides:
1. A stable Go API inside services (tests can mock it).
2. A single place to translate environment injection (`NITRO_CERT`, `NITRO_KEY`, `NITRO_ROOT_CA`, `NITRO_SECRETS`, `NITRO_UUID`) into usable clients/configs.
3. Enforcement of the official cross-nitro communication path (mTLS via `Nitro.HTTPClient`), rather than ad-hoc HTTP clients.

## Components

### Nitro (`nitro.go`)

Core Nitro type for TEE service configuration.

```go
m, err := nitro.New(nitro.Config{
    NitroType: "neocompute",
})
```

### Service (`service.go`)

Low-level service base (identity + router + dependency holders).

Most services should embed `infrastructure/service.BaseService`, which wraps
`*nitro.Service` and adds:
- Lifecycle hooks (`Start/Stop`) with safe shutdown handling
- Background worker registration helpers
- Standard endpoints (`/health`, `/ready`, `/info`)

```go
base := commonservice.NewBase(&commonservice.BaseConfig{
    ID:      "myservice",
    Name:    "My Service",
    Version: "1.0.0",
    Nitro:  cfg.Nitro,
    DB:      cfg.DB,
})

base.RegisterStandardRoutes()
```

## Secret Management

Secrets are injected by  KMS/Platform and accessed via the Nitro instance:

```go
// Get secret (returns false if not found)
secret, ok := m.Secret("COMPUTE_MASTER_KEY")
if !ok {
    return errors.New("COMPUTE_MASTER_KEY not configured")
}
defer crypto.ZeroBytes(secret) // Always zero secrets after use
```

### Available Secrets

| Secret | Service | Description |
|--------|---------|-------------|
| `NEOFEEDS_SIGNING_KEY` | Datafeed | ECDSA private key for signing prices |
| `NEOVRF_SIGNING_KEY` | NeoVRF | Master key for VRF signing (>= 32 bytes) |
| `COMPUTE_MASTER_KEY` | Confidential Compute | Master key for encryption/signing (>= 32 bytes) |
| `POOL_MASTER_KEY` | AccountPool | HD derivation master key (>= 32 bytes) |
| `POOL_MASTER_KEY_HASH` | AccountPool | SHA-256 hash of derived master pubkey (32 bytes; required in enclave mode) |
| `POOL_MASTER_ATTESTATION_HASH` | AccountPool | Optional attestation/bundle hash (for on-chain anchoring) |
| `GLOBALSIGNER_MASTER_SEED` | GlobalSigner | 32-byte master seed for deterministic key derivation |
| `SECRETS_MASTER_KEY` | Edge + Services | AES-256 master key for user secrets (32 bytes; same envelope across Edge + TEE) |

## mTLS Communication

For secure inter-service communication within the  mesh:

```go
// Get mTLS HTTP client
httpClient := m.HTTPClient()

// Make request to another nitro
resp, err := httpClient.Get("https://neoaccounts:8085/info")
```

### External Gateways (Supabase Edge)

By default, enclave services only accept client certificates signed by the
 root CA (`NITRO_ROOT_CA`). To support external gateways that must
connect via mTLS (e.g. Supabase Edge Functions), you can append additional PEM
roots to the server-side client CA pool by setting:

- `NITRO_EXTRA_CLIENT_CA` (PEM)

This affects **inbound** mTLS verification (`tls.Config.ClientCAs`) and does not
change the trust roots used for outbound mesh calls.

## External HTTP Calls

For outbound calls to non-mesh endpoints (Supabase, Neo RPC, third-party APIs), use:

```go
httpClient := m.ExternalHTTPClient()
resp, err := httpClient.Get("https://api.coingecko.com/api/v3/ping")
```

## Service Lifecycle

```go
// Service lifecycle and workers are provided by `infrastructure/service.BaseService`.

// Get service info
id := svc.ID()
name := svc.Name()
version := svc.Version()

// Get HTTP router
router := svc.Router()

// Get database repository
db := svc.DB()
```

## Testing

For testing without actual :

```go
m, _ := nitro.New(nitro.Config{NitroType: "test"})

// Set test secrets
m.SetTestSecret("MY_SECRET", []byte("test-value"))
```

```bash
go test ./infrastructure/nitro/... -v
```

Current test coverage: **43.8%**

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NITRO_TYPE` | Service type identifier |
| `NITRO_CERT` | TLS certificate (injected) |
| `NITRO_KEY` | TLS private key (injected) |
| `NITRO_ROOT_CA` | Root CA certificate (injected) |
| `NITRO_EXTRA_CLIENT_CA` | Optional extra client CA PEMs (inbound mTLS) |
| `NITRO_SECRETS` | JSON-encoded secrets (injected) |
| `NITRO_UUID` | Unique nitro instance ID |

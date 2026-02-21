# GlobalSigner Service

TEE-protected master key management + domain-separated signing.

GlobalSigner is an **infrastructure marble**: it keeps master seed material
inside the enclave and offers a small, authenticated API for other internal
services to obtain signatures and derived public keys.

## Responsibilities

- Deterministic P-256 key derivation from a master seed (`GLOBALSIGNER_MASTER_SEED`)
- Key versioning + rotation (active + overlap window)
- Domain-separated signing (e.g. `randomness:*`, `datafeed:*`, `automation:*`)
- Attestation artifacts binding the active public key to the enclave identity

## API Endpoints

Public (read-only):

- `GET /health`, `GET /ready`, `GET /info`
- `GET /attestation`: current key + enclave metadata
- `GET /keys`: list key versions
- `GET /status`: detailed status view

Protected (service-auth required):

- `POST /sign`: sign hex-encoded data with a domain prefix
- `POST /sign-raw`: sign hex-encoded data without a domain prefix (tx witnesses / legacy on-chain)
- `POST /derive`: derive a deterministic child key (public key output)
- `POST /rotate`: trigger rotation (ops/admin only)

## Configuration

- `GLOBALSIGNER_MASTER_SEED`: 32-byte master seed (hex or raw bytes)
- `GLOBALSIGNER_DOMAIN_ALLOWLIST`: optional CSV of `service_id:domain_prefix` entries.
  Use `|` or `;` to specify multiple domain prefixes per service
  (example: `neovrf:randomness:*|vrf:*,neofeeds:datafeed:*`)
- `GLOBALSIGNER_SIGN_RAW_ALLOWLIST`: optional CSV of service IDs allowed to call `sign-raw`
- `GLOBALSIGNER_MAX_BODY_BYTES`: optional request body limit (bytes; default 1048576)
- `GLOBALSIGNER_REQUIRE_QUOTE`: optional override for SGX quote enforcement in enclave mode

## Signing API Example

```bash
curl -X POST https://globalsigner:8092/sign \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "randomness:proof",
    "data": "0x1234abcd"
  }'
```

Response:

```json
{
  "signature": "0x...",
  "key_version": "v2025-01",
  "pubkey_hex": "0x..."
}
```

## How Services Use It

- Services should not share long-lived signing keys directly.
- Instead, services can call GlobalSigner over the MarbleRun mesh and request
  signatures scoped to a domain (`domain` is included in the signed message).

Code helpers:

- `infrastructure/globalsigner/client`: HTTP client
- `infrastructure/service.BaseSignerAdapter`: convenience wrapper

## Testing

```bash
go test ./infrastructure/globalsigner/... -v
```

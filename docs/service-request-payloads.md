# Service Request Payloads (On-Chain)

This document defines the **payload format** for on-chain service requests
submitted via `ServiceLayerGateway.RequestService(...)`.

All payloads are passed as **ByteString** and are interpreted as **UTF-8 JSON**
unless explicitly stated otherwise.

## Common Fields

- `app_id`: MiniApp identifier (supplied by the caller contract).
- `request_id`: optional client-provided correlation id (string).

## Service Types

### `rng`

Randomness requests do not require a payload. If provided, the dispatcher will
honor the optional `request_id`.

Example:

```json
{ "request_id": "optional-id" }
```

**Result (`ByteString`)**: 32-byte randomness output. The dispatcher may also
attach a JSON blob (signature, public key, attestation hash) when configured.

### `oracle`

Payload mirrors the Edge `oracle-query` API:

```json
{
  "url": "https://api.example.com/price",
  "method": "GET",
  "headers": { "X-Api-Key": "..." },
  "body": "",
  "json_path": "data.price",
  "secret_name": "optional-secret",
  "secret_as_key": "optional-key"
}
```

**Result (`ByteString`)**: UTF-8 JSON containing the fetched value or parsed
JSONPath output plus metadata.

### `compute`

Payload mirrors the Edge `compute-execute` API:

```json
{
  "script": "function main(input){ return { ok: true, input } }",
  "entry_point": "main",
  "input": { "hello": "world" },
  "secret_refs": ["api-key"]
}
```

**Result (`ByteString`)**: UTF-8 JSON containing the compute result + metadata.

## Callback Contract Parameters

When the request completes, `ServiceLayerGateway.FulfillRequest(...)` calls the
MiniApp callback method with:

```
(request_id, app_id, service_type, success, result, error)
```

- `request_id`: `Integer`
- `app_id`: `String`
- `service_type`: `String`
- `success`: `Boolean`
- `result`: `ByteString`
- `error`: `String`

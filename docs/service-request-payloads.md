# Oracle Request Payloads (Direct Morpheus Oracle)

This document defines the preferred **payload format** for MiniApp contracts
that call the external Morpheus Oracle contract directly.

The request shape follows:

```text
MorpheusOracle.request(requestType, payload, callbackContract, "onOracleResult")
MorpheusOracle.requestFromCallback(requester, requestType, payload, callbackContract, "onOracleResult")
```

Payloads are passed as **ByteString** and interpreted as **UTF-8 JSON** unless
explicitly stated otherwise.

For MiniApp contracts that validate the user or AA context themselves and then
call Morpheus from inside contract execution, prefer
`requestFromCallback(...)`. That path keeps the callback contract as the
explicit caller boundary and is the supported pattern for direct MiniApp ->
Morpheus callback flows.

## Common Fields

- `request_id`: optional client-provided correlation id (string).

## Service Types

### `rng`

Randomness requests do not require a structured payload. The current worker
ignores the payload body and returns raw randomness bytes.

Example:

```json
{ "request_id": "optional-id" }
```

**Result (`ByteString`)**: raw 32-byte randomness output.

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

Payload mirrors the external Morpheus compute runtime.

Inline-script mode:

```json
{
  "script": "function main(input){ return { ok: true, input } }",
  "entry_point": "main",
  "input": { "hello": "world" },
  "secret_refs": ["api-key"]
}
```

When the callback / notification size is too small for inline source, prefer a
registered script reference. This matches the Morpheus worker `script_ref`
resolver and lets the MiniApp send only a script name plus the registry getter
location:

```json
{
  "script_ref": {
    "contract_hash": "0x1111111111111111111111111111111111111111",
    "method": "getScript",
    "script_name": "sum"
  },
  "entry_point": "main",
  "input": { "a": 2, "b": 3 }
}
```

Equivalent shorthand fields are also accepted by the external runtime:

```json
{
  "script_registry_contract": "0x1111111111111111111111111111111111111111",
  "script_registry_method": "getScript",
  "script_name": "sum",
  "entry_point": "main",
  "input": { "a": 2, "b": 3 }
}
```

**Result (`ByteString`)**: UTF-8 JSON containing the compute result + metadata.

## Callback Contract Parameters

When the request completes, `MorpheusOracle.fulfillRequest(...)` calls the
MiniApp callback method with:

```
(request_id, request_type, success, result, error)
```

- `request_id`: `Integer`
- `request_type`: `String`
- `success`: `Boolean`
- `result`: `ByteString`
- `error`: `String`

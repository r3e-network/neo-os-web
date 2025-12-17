# txproxy Marble

`txproxy` is a MarbleRun/EGo service that builds + signs + broadcasts allowlisted
transactions.

Endpoints:

- `POST /invoke` (service-auth required)

Configuration:

- `TXPROXY_ALLOWLIST` (JSON):

```json
{
  "contracts": {
    "0x<hash>": ["MethodA", "MethodB"],
    "<hash-without-0x>": ["*"]
  }
}
```

Notes:

- Contract hashes are normalized to lowercase **without** `0x` prefix.
- Method names are canonicalized by lowercasing the first character (to match Neo C# devpack manifest names like `getLatest`, `setUpdater`, `pay`).
- `*` allows all methods for a contract (not recommended in production).

Optional policy gating:

- Request field `intent` enables stricter checks for platform user flows:
  - `intent: "payments"` → requires `CONTRACT_PAYMENTHUB_HASH` configured and only allows `pay`
  - `intent: "governance"` → requires `CONTRACT_GOVERNANCE_HASH` configured and only allows `stake`/`unstake`/`vote`

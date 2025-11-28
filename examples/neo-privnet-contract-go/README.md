Neo privnet contract helper (Go)
================================

Push Service Layer data on-chain via a Neo privnet node (RPC on 20332 from `make run-neo`). This helper:
- pulls the latest price snapshot from a Service Layer price feed
- builds/signs a transaction calling a contract method (default `updatePrice`)
- waits for execution success

Setup
-----
```bash
cd examples/neo-privnet-contract-go
cp .env.example .env
go mod tidy
```

Fill `.env` with:
- `SERVICE_LAYER_API` – e.g. `http://localhost:8080`
- `SERVICE_LAYER_TOKEN` / `SERVICE_LAYER_TENANT`
- `ACCOUNT_ID` and `PRICE_FEED_ID` (feed with snapshots)
- `RPC_URL` – privnet RPC (defaults to `http://localhost:20332`)
- `WIF` – privnet wallet key with GAS
- `CONTRACT_HASH` – target contract script hash (little-endian string, prefixed `0x` ok)
- `CONTRACT_METHOD` – method to call (default `updatePrice`)

Run
---
```bash
go run ./...
```

The helper logs the pulled price, builds a transaction via `actor.SendCall`, and waits for HALT execution.

Notes
-----
- Uses a single signer with `CalledByEntry` scope; adapt `actor.New` if you need custom scopes or multiple signers.
- Invocation params are sent as a string price; adjust in code if your contract expects integers/structs (e.g., multiply by `1e8` before sending).
- System fee is estimated by the RPC node during transaction creation; network fee defaults to a small value suitable for privnet.

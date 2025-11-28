Neo privnet contract helper
===========================

Push Service Layer data on-chain via a Neo privnet node (RPC on 20332 from `make run-neo`). This helper:
- pulls the latest price snapshot from a Service Layer price feed
- builds and signs an invocation transaction against a contract method (default `updatePrice`)
- submits the transaction to the privnet node

Setup
-----
```bash
cd examples/neo-privnet-contract
cp .env.example .env
npm install
```

Fill `.env` with:
- `SERVICE_LAYER_API` – e.g. `http://localhost:8080`
- `SERVICE_LAYER_TOKEN` / `SERVICE_LAYER_TENANT`
- `ACCOUNT_ID` and `PRICE_FEED_ID` (existing feed with snapshots)
- `RPC_URL` – privnet RPC (defaults to `http://localhost:20332`)
- `WIF` – privnet wallet key with GAS to pay fees
- `CONTRACT_HASH` – target contract script hash
- `CONTRACT_METHOD` – method to call (default `updatePrice`)
- `NETWORK_FEE` – optional override (default 0.001)

Run
---
```bash
npm run invoke
```

The script logs the pulled price, estimated system fee, chosen network fee, and the transaction hash. If the node rejects the transaction, the RPC response will include the reason (insufficient fee, invalid params, etc.). Adjust `NETWORK_FEE` or the contract args as needed.

Notes
-----
- The helper uses a simple signer scope (`CalledByEntry`). Adjust if your contract requires different scopes or multiple signers.
- System fee is derived from `invokeFunction` gas consumption; network fee defaults to a small value suitable for privnet. Increase `NETWORK_FEE` if the node rejects with `insufficient network fee`.
- If your contract expects an integer price, convert inside the contract or adapt the argument in `invoke-price.mjs`.

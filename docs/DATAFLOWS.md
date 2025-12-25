# Dataflow Reference

This document describes how data moves through the platform, including
event ingestion, service dispatch, and audit persistence.

## Components

- **MiniApp Contract**: emits `ServiceRequested`, receives callbacks.
- **ServiceLayerGateway**: on-chain request router + callback dispatcher.
- **NeoRequests**: on-chain event listener + service dispatcher.
- **TEE Services**: neovrf, neooracle, neocompute (and others).
- **TxProxy**: allowlisted transaction signer + broadcaster.
- **Supabase**: Auth, RLS, and audit tables.
- **Edge Functions**: gateway API surface for the SDK/host.

## Dataflow: On-Chain Request + Callback

```
MiniApp Contract
  └─ RequestService(...) ──▶ ServiceLayerGateway
      └─ ServiceRequested event ──▶ NeoRequests
          ├─ contract_events (Supabase)
          ├─ processed_events (idempotency)
          ├─ service_requests (status + payload)
          └─ call TEE service (neovrf/neooracle/neocompute)
                 └─ result payload
          └─ TxProxy.FulfillRequest ──▶ ServiceLayerGateway
              └─ ServiceFulfilled event
              └─ callback to MiniApp Contract
              └─ chain_txs (Supabase)
```

`ServiceRequested` and `ServiceFulfilled` are the **authoritative notifications**
for MiniApp service lifecycles. NeoRequests is the only component that consumes
`ServiceRequested` and produces `FulfillRequest` callback transactions.
Payload formats are defined in `docs/service-request-payloads.md`.

## Dataflow: MiniApp Registration (AppRegistry)

```
Developer ──▶ Edge app-register (manifest validation + hash)
  └─ Supabase miniapps upsert (canonical manifest)
  └─ AppRegistry.register intent (wallet signed)
Wallet ──▶ Neo N3 chain (AppRegistry.register)
Admin ──▶ Neo N3 chain (AppRegistry.setStatus Approved/Disabled)
```

Supabase remains the runtime cache for quick lookups; AppRegistry is the
immutable on-chain anchor for audits and governance.

## Dataflow: Edge-Gated Payments / Governance

```
SDK ──▶ Edge Function (pay-gas / vote-neo)
  ├─ validate permissions + limits + assets (GAS/NEO only)
  └─ return contract invocation for wallet signing
Wallet ──▶ Neo N3 chain (PaymentHub / Governance)
```

## Dataflow: Datafeed Updates

```
External exchanges ──▶ neofeeds
  └─ median + threshold
  └─ txproxy submit PriceFeed update
  └─ PriceFeed emits events (on-chain audit)
```

## Dataflow: GasBank Deposits (Optional)

```
User ──▶ Edge gasbank-* functions
  └─ deposit_requests (Supabase)
      └─ neogasbank verifies on-chain deposits
          └─ gasbank_accounts / gasbank_transactions (Supabase)
          └─ optional fee deductions for services
```

## Supabase Tables (Audit + Idempotency)

- `contract_events`: raw on-chain events captured by NeoRequests.
- `processed_events`: idempotency guard for event processing.
- `service_requests`: normalized request/response state for MiniApp callbacks.
- `chain_txs`: callback transaction auditing (status, errors, gas).

## Supabase Tables (Account Pool Persistence)

- `pool_accounts`: account metadata + lock state used by AccountPool.
- `pool_account_balances`: per-token balances for each pool account.

These tables must remain persistent across restarts to preserve account
allocation history and lock ownership.

## Configuration Sources

Runtime values are sourced from:

- `.env` / `.env.local` for local dev.
- `config/development.env`, `config/testing.env`, `config/production.env` for
  deployment defaults.
- `deploy/config/testnet_contracts.json` for testnet contract hashes.

All service and gateway deployments should read contract hashes and URLs from
these sources to avoid hardcoding.

# Chain Module

The `infrastructure/chain` module is the **single source of truth** for Neo N3
chain communication in this repository.

It centralizes:

- Neo JSON-RPC client + endpoint pooling/failover
- contract invocation helpers (invoke + wait)
- transaction construction + signing helpers
- event monitoring/listening and typed event parsing
- stack item parsing helpers for typed wrappers
- platform contract wrappers (PriceFeed / RandomnessLog / AutomationAnchor)

## Key Components

### RPC Client (`client.go`, `rpcpool.go`)

Create a Neo N3 client:

```go
client, err := chain.NewClient(chain.Config{
    RPCURL:    "https://testnet1.neo.coz.io:443",
    NetworkID: 894710606,
})
```

### Contract Addresses (`contracts_common.go`)

Contract hashes are typically provided via env vars. For the MiniApp platform,
these are the primary contract vars:

- `CONTRACT_PAYMENTHUB_HASH`
- `CONTRACT_GOVERNANCE_HASH`
- `CONTRACT_PRICEFEED_HASH`
- `CONTRACT_RANDOMNESSLOG_HASH`
- `CONTRACT_APPREGISTRY_HASH`
- `CONTRACT_AUTOMATIONANCHOR_HASH`
- `CONTRACT_SERVICEGATEWAY_HASH`

```go
contracts := chain.ContractAddressesFromEnv()
```

### Event Listener (`listener_core.go`)

The listener polls Neo RPC for application logs and emits typed events for the
Service Layer contracts. Contract hashes are normalized (strip `0x`, lowercase)
before filtering, to avoid silent mismatches between configs and RPC output.

```go
listener := chain.NewEventListener(&chain.ListenerConfig{
    Client:     client,
    Contracts:  contracts,
    StartBlock: 0, // or a saved cursor
})
go listener.Start(ctx)
```

### Signers (Local / GlobalSigner)

Transactions that write to platform contracts are signed by the enclave-managed
signer (recommended: GlobalSigner). The chain module provides signer adapters:

- `NewLocalTEESignerFromPrivateKeyHex` (dev/testing)
- `NewGlobalSignerSigner` (production; key never leaves enclave)

## Responsibility Rules

- Services should **not** talk to Neo RPC directly.
- Contract bindings and typed event parsing live in `infrastructure/chain`
  (`contracts_*.go`, `listener_events_*.go`) so services don't duplicate chain I/O.

## Testing

```bash
go test ./infrastructure/chain/... -v
```

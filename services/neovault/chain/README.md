# NeoVault Chain Integration

Neo N3 blockchain integration for the NeoVault privacy mixing service.

## Overview

This package provides Go bindings for interacting with the `NeoVaultService` smart contract on Neo N3. The contract role is **minimal** - it handles only:
- Service registration and bond management
- Dispute submission and resolution
- Refund claims

Normal mixing operations happen entirely **off-chain** for privacy.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   NeoVault Chain Package                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐              ┌─────────────────┐          │
│  │ NeoVaultContract│              │  Event Parsers  │          │
│  ├─────────────────┤              ├─────────────────┤          │
│  │ GetAdmin        │              │ ServiceRegistered│          │
│  │ IsPaused        │              │ BondDeposited    │          │
│  │ GetService      │              │ DisputeSubmitted │          │
│  │ GetDispute      │              │ DisputeResolved  │          │
│  │ IsRequestResolved│             │ DisputeRefunded  │          │
│  │ CanClaimDisputeRefund│         │ BondSlashed      │          │
│  └────────┬────────┘              └─────────────────┘          │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      internal/chain                              │
│    (Client, ContractParam, InvokeResult, TEEFulfiller)          │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Neo N3 Network                              │
│              (NeoVaultService Contract - Dispute Only)           │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

| File | Purpose |
|------|---------|
| `contract.go` | Contract method invocations |
| `events.go` | Event parsing utilities |

## Contract Interface

### NeoVaultContract

```go
type NeoVaultContract struct {
    client       *chain.Client
    contractHash string
}
```

### Read Methods

#### GetAdmin

Returns the contract admin address.

```go
func (m *NeoVaultContract) GetAdmin(ctx context.Context) (string, error)
```

#### IsPaused

Returns whether the contract is paused.

```go
func (m *NeoVaultContract) IsPaused(ctx context.Context) (bool, error)
```

#### GetService

Returns service information by service ID.

```go
func (m *NeoVaultContract) GetService(ctx context.Context, serviceID []byte) (*NeoVaultServiceInfo, error)
```

#### GetDispute

Returns dispute information by request hash.

```go
func (m *NeoVaultContract) GetDispute(ctx context.Context, requestHash []byte) (*NeoVaultDisputeInfo, error)
```

#### IsDisputeResolved

Checks if a dispute has been resolved.

```go
func (m *NeoVaultContract) IsDisputeResolved(ctx context.Context, requestHash []byte) (bool, error)
```

#### IsRequestResolved

Checks if a request hash has been marked resolved on-chain.

```go
func (m *NeoVaultContract) IsRequestResolved(ctx context.Context, requestHash []byte) (bool, error)
```

### Dispute Resolution (TEE)

State-changing operations are executed by the TEE via centralized chain writers (TxSubmitter) or via `chain.TEEFulfiller`.

## Data Types

### NeoVaultServiceInfo

Represents a registered mixing service.

```go
type NeoVaultServiceInfo struct {
    ServiceID         []byte
    TeePubKey         []byte
    BondAmount        *big.Int
    OutstandingAmount *big.Int
    Status            uint8
    Active            bool
    RegisteredAt      uint64
}
```

### NeoVaultDisputeInfo

Represents a dispute record.

```go
type NeoVaultDisputeInfo struct {
    RequestHash     []byte
    User            string
    Amount          *big.Int
    RequestProof    []byte
    ServiceID       []byte
    SubmittedAt     uint64
    Deadline        uint64
    Status          uint8     // 0=Pending, 1=Resolved, 2=Refunded
    CompletionProof []byte
    ResolvedAt      uint64
}
```

### Dispute Status Constants

```go
const (
    DisputeStatusPending  uint8 = 0  // User submitted, waiting for TEE
    DisputeStatusResolved uint8 = 1  // TEE submitted completion proof
    DisputeStatusRefunded uint8 = 2  // TEE failed, user refunded
)
```

## Event Parsers

### ServiceRegistered

Emitted when a mixing service registers.

```go
type NeoVaultServiceRegisteredEvent struct {
    ServiceID []byte
    TeePubKey []byte
}
```

### BondDeposited

Emitted when a service deposits bond.

```go
type NeoVaultBondDepositedEvent struct {
    ServiceID []byte
    Amount    uint64
    TotalBond uint64
}
```

### DisputeSubmitted

Emitted when a user submits a dispute.

```go
type NeoVaultDisputeSubmittedEvent struct {
    RequestHash []byte
    User        string
    Amount      uint64
    Deadline    uint64
}
```

### DisputeResolved

Emitted when TEE resolves a dispute with completion proof.

```go
type NeoVaultDisputeResolvedEvent struct {
    RequestHash []byte
    ServiceID   []byte
    CompletionProof []byte
}
```

### DisputeRefunded

Emitted when user claims refund after deadline.

```go
type NeoVaultDisputeRefundedEvent struct {
    RequestHash []byte
    User        string
    Amount      uint64
}
```

### BondSlashed

Emitted when service bond is slashed.

```go
type NeoVaultBondSlashedEvent struct {
    ServiceID     []byte
    SlashedAmount uint64
    RemainingBond uint64
}
```

## Usage Examples

### Creating Contract Instance

```go
import (
    "github.com/R3E-Network/service_layer/internal/chain"
    neovaultchain "github.com/R3E-Network/service_layer/services/neovault/chain"
)

client, err := chain.NewClient(rpcURL)
if err != nil {
    return err
}

contract := neovaultchain.NewNeoVaultContract(client, contractHash, nil)
```

### Resolving a Dispute (TEE)

```go
ctx := context.Background()

// Only called when user disputes - normal flow is off-chain
txHash, err := fulfiller.ResolveDispute(ctx, contractHash, []byte("neovault"), requestHash, completionProof)
if err != nil {
    return fmt.Errorf("resolve dispute: %w", err)
}

fmt.Printf("Dispute resolved: %s\n", txHash)
```

### Checking Dispute Status

```go
dispute, err := contract.GetDispute(ctx, requestHash)
if err != nil {
    return err
}

switch dispute.Status {
case neovaultchain.DisputeStatusPending:
    fmt.Println("Dispute pending TEE response")
case neovaultchain.DisputeStatusResolved:
    fmt.Println("Dispute resolved with proof")
case neovaultchain.DisputeStatusRefunded:
    fmt.Println("User refunded")
}
```

## Event Flow

### Normal Flow (No On-Chain Events)

```
User → API Request → Off-Chain Mixing → Delivery
         │
         └── ZERO on-chain events (privacy preserved)
```

### Dispute Flow (On-Chain Events)

```
User                           Contract                        TEE
  │                               │                             │
  │ SubmitDispute                 │                             │
  │──────────────────────────────>│                             │
  │                               │                             │
  │                  DisputeSubmitted Event                     │
  │                               │                             │
  │                               │<────────────────────────────│
  │                               │   ResolveDispute            │
  │                               │                             │
  │                  DisputeResolved Event                      │
  │                               │                             │

      OR (if TEE fails to respond within deadline):

User                           Contract
  │                               │
  │ ClaimRefund (after deadline)  │
  │──────────────────────────────>│
  │                               │
      │                  DisputeRefunded Event
      │                  BondSlashed Event
      │                               │
```

## Dependencies

### Internal Packages

| Package | Purpose |
|---------|---------|
| `internal/chain` | Core blockchain client and types |

## Related Documentation

- [Marble Service](../marble/README.md)
- [Smart Contract](../contract/README.md)
- [Internal Chain Package](../../../internal/chain/README.md)

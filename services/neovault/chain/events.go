package neovaultchain

import (
	"fmt"

	"github.com/R3E-Network/service_layer/internal/chain"
)

// =============================================================================
// NeoVault Service Events (v5.1 - Off-Chain First with On-Chain Dispute Only)
// =============================================================================
//
// Architecture: Off-Chain Mixing with On-Chain Dispute Resolution Only
// - Normal flow has ZERO on-chain events (all off-chain)
// - On-chain events only occur during:
//   1. Service registration and bond management
//   2. Dispute submission by user
//   3. Dispute resolution by TEE
//   4. Refund claims
//
// Pool accounts are managed entirely off-chain via HD derivation.
// No on-chain pool account registration events - preserves privacy.

// NeoVaultServiceRegisteredEvent represents a ServiceRegistered event.
// Event: ServiceRegistered(serviceId, teePubKey)
type NeoVaultServiceRegisteredEvent struct {
	ServiceID []byte
	TeePubKey []byte
}

// ParseNeoVaultServiceRegisteredEvent parses a ServiceRegistered event.
func ParseNeoVaultServiceRegisteredEvent(event *chain.ContractEvent) (*NeoVaultServiceRegisteredEvent, error) {
	if event.EventName != "ServiceRegistered" {
		return nil, fmt.Errorf("not a ServiceRegistered event")
	}
	if len(event.State) < 2 {
		return nil, fmt.Errorf("invalid event state: expected 2 items, got %d", len(event.State))
	}

	serviceID, err := chain.ParseByteArray(event.State[0])
	if err != nil {
		return nil, fmt.Errorf("parse serviceId: %w", err)
	}

	teePubKey, err := chain.ParseByteArray(event.State[1])
	if err != nil {
		return nil, fmt.Errorf("parse teePubKey: %w", err)
	}

	return &NeoVaultServiceRegisteredEvent{
		ServiceID: serviceID,
		TeePubKey: teePubKey,
	}, nil
}

// NeoVaultBondDepositedEvent represents a BondDeposited event.
// Event: BondDeposited(serviceId, amount, totalBond)
type NeoVaultBondDepositedEvent struct {
	ServiceID []byte
	Amount    uint64
	TotalBond uint64
}

// ParseNeoVaultBondDepositedEvent parses a BondDeposited event.
func ParseNeoVaultBondDepositedEvent(event *chain.ContractEvent) (*NeoVaultBondDepositedEvent, error) {
	if event.EventName != "BondDeposited" {
		return nil, fmt.Errorf("not a BondDeposited event")
	}
	if len(event.State) < 3 {
		return nil, fmt.Errorf("invalid event state: expected 3 items, got %d", len(event.State))
	}

	serviceID, err := chain.ParseByteArray(event.State[0])
	if err != nil {
		return nil, fmt.Errorf("parse serviceId: %w", err)
	}

	amount, err := chain.ParseInteger(event.State[1])
	if err != nil {
		return nil, fmt.Errorf("parse amount: %w", err)
	}

	totalBond, err := chain.ParseInteger(event.State[2])
	if err != nil {
		return nil, fmt.Errorf("parse totalBond: %w", err)
	}

	return &NeoVaultBondDepositedEvent{
		ServiceID: serviceID,
		Amount:    amount.Uint64(),
		TotalBond: totalBond.Uint64(),
	}, nil
}

// NeoVaultDisputeSubmittedEvent represents a DisputeSubmitted event.
// Event: DisputeSubmitted(requestHash, user, amount, deadline)
// This event is emitted when a user submits a dispute for an incomplete mix request.
type NeoVaultDisputeSubmittedEvent struct {
	RequestHash []byte
	User        string
	Amount      uint64
	Deadline    uint64
}

// ParseNeoVaultDisputeSubmittedEvent parses a DisputeSubmitted event.
func ParseNeoVaultDisputeSubmittedEvent(event *chain.ContractEvent) (*NeoVaultDisputeSubmittedEvent, error) {
	if event.EventName != "DisputeSubmitted" {
		return nil, fmt.Errorf("not a DisputeSubmitted event")
	}
	if len(event.State) < 4 {
		return nil, fmt.Errorf("invalid event state: expected 4 items, got %d", len(event.State))
	}

	requestHash, err := chain.ParseByteArray(event.State[0])
	if err != nil {
		return nil, fmt.Errorf("parse requestHash: %w", err)
	}

	user, err := chain.ParseHash160(event.State[1])
	if err != nil {
		return nil, fmt.Errorf("parse user: %w", err)
	}

	amount, err := chain.ParseInteger(event.State[2])
	if err != nil {
		return nil, fmt.Errorf("parse amount: %w", err)
	}

	deadline, err := chain.ParseInteger(event.State[3])
	if err != nil {
		return nil, fmt.Errorf("parse deadline: %w", err)
	}

	return &NeoVaultDisputeSubmittedEvent{
		RequestHash: requestHash,
		User:        user,
		Amount:      amount.Uint64(),
		Deadline:    deadline.Uint64(),
	}, nil
}

// NeoVaultDisputeResolvedEvent represents a DisputeResolved event.
// Event: DisputeResolved(requestHash, serviceId, completionProof)
// This event is emitted when the TEE submits completion proof to resolve a dispute.
type NeoVaultDisputeResolvedEvent struct {
	RequestHash     []byte
	ServiceID       []byte
	CompletionProof []byte
}

// ParseNeoVaultDisputeResolvedEvent parses a DisputeResolved event.
func ParseNeoVaultDisputeResolvedEvent(event *chain.ContractEvent) (*NeoVaultDisputeResolvedEvent, error) {
	if event.EventName != "DisputeResolved" {
		return nil, fmt.Errorf("not a DisputeResolved event")
	}
	if len(event.State) < 3 {
		return nil, fmt.Errorf("invalid event state: expected 3 items, got %d", len(event.State))
	}

	requestHash, err := chain.ParseByteArray(event.State[0])
	if err != nil {
		return nil, fmt.Errorf("parse requestHash: %w", err)
	}

	serviceID, err := chain.ParseByteArray(event.State[1])
	if err != nil {
		return nil, fmt.Errorf("parse serviceId: %w", err)
	}

	completionProof, err := chain.ParseByteArray(event.State[2])
	if err != nil {
		return nil, fmt.Errorf("parse completionProof: %w", err)
	}

	return &NeoVaultDisputeResolvedEvent{
		RequestHash:     requestHash,
		ServiceID:       serviceID,
		CompletionProof: completionProof,
	}, nil
}

// NeoVaultDisputeRefundedEvent represents a DisputeRefunded event.
// Event: DisputeRefunded(requestHash, user, amount)
// This event is emitted when a user claims a refund after dispute deadline passes.
type NeoVaultDisputeRefundedEvent struct {
	RequestHash []byte
	User        string
	Amount      uint64
}

// ParseNeoVaultDisputeRefundedEvent parses a DisputeRefunded event.
func ParseNeoVaultDisputeRefundedEvent(event *chain.ContractEvent) (*NeoVaultDisputeRefundedEvent, error) {
	if event.EventName != "DisputeRefunded" {
		return nil, fmt.Errorf("not a DisputeRefunded event")
	}
	if len(event.State) < 3 {
		return nil, fmt.Errorf("invalid event state: expected 3 items, got %d", len(event.State))
	}

	requestHash, err := chain.ParseByteArray(event.State[0])
	if err != nil {
		return nil, fmt.Errorf("parse requestHash: %w", err)
	}

	user, err := chain.ParseHash160(event.State[1])
	if err != nil {
		return nil, fmt.Errorf("parse user: %w", err)
	}

	amount, err := chain.ParseInteger(event.State[2])
	if err != nil {
		return nil, fmt.Errorf("parse amount: %w", err)
	}

	return &NeoVaultDisputeRefundedEvent{
		RequestHash: requestHash,
		User:        user,
		Amount:      amount.Uint64(),
	}, nil
}

// NeoVaultBondSlashedEvent represents a BondSlashed event.
// Event: BondSlashed(serviceId, slashedAmount, remainingBond)
// This event is emitted when a service's bond is slashed due to failed dispute resolution.
type NeoVaultBondSlashedEvent struct {
	ServiceID     []byte
	SlashedAmount uint64
	RemainingBond uint64
}

// ParseNeoVaultBondSlashedEvent parses a BondSlashed event.
func ParseNeoVaultBondSlashedEvent(event *chain.ContractEvent) (*NeoVaultBondSlashedEvent, error) {
	if event.EventName != "BondSlashed" {
		return nil, fmt.Errorf("not a BondSlashed event")
	}
	if len(event.State) < 3 {
		return nil, fmt.Errorf("invalid event state: expected 3 items, got %d", len(event.State))
	}

	serviceID, err := chain.ParseByteArray(event.State[0])
	if err != nil {
		return nil, fmt.Errorf("parse serviceId: %w", err)
	}

	slashedAmount, err := chain.ParseInteger(event.State[1])
	if err != nil {
		return nil, fmt.Errorf("parse slashedAmount: %w", err)
	}

	remainingBond, err := chain.ParseInteger(event.State[2])
	if err != nil {
		return nil, fmt.Errorf("parse remainingBond: %w", err)
	}

	return &NeoVaultBondSlashedEvent{
		ServiceID:     serviceID,
		SlashedAmount: slashedAmount.Uint64(),
		RemainingBond: remainingBond.Uint64(),
	}, nil
}

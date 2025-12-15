package neovaultchain

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"

	"github.com/R3E-Network/service_layer/internal/chain"
)

// =============================================================================
// NeoVault Contract Interface (v5.1 - Off-Chain First with On-Chain Dispute)
// =============================================================================
//
// Architecture: Off-Chain Mixing with On-Chain Dispute Resolution Only
// - User requests mix via API → NeoVault service directly (NO on-chain)
// - NeoVault returns RequestProof (requestHash + TEE signature) + deposit address
// - User deposits DIRECTLY to pool account on-chain (NOT gasbank)
// - NeoVault processes off-chain (HD pool accounts, random mixing)
// - NeoVault delivers NetAmount to targets (fee deducted from delivery)
// - Fee collected from random pool account to master fee address
// - Normal path: User happy, ZERO on-chain link to service layer
// - Dispute path: User submits dispute → NeoVault submits CompletionProof on-chain
//
// Contract Role (Minimal):
// - Service registration and bond management
// - Dispute submission by user
// - Dispute resolution by TEE (completion proof)
// - Refund if TEE fails to resolve within deadline

// NeoVaultContract provides interaction with the NeoVaultService contract.
type NeoVaultContract struct {
	client       *chain.Client
	contractHash string
}

// NewNeoVaultContract creates a new neovault contract interface.
func NewNeoVaultContract(client *chain.Client, contractHash string, _ *chain.Wallet) *NeoVaultContract {
	return &NeoVaultContract{
		client:       client,
		contractHash: contractHash,
	}
}

// =============================================================================
// Read Methods
// =============================================================================

// GetAdmin returns the contract admin address.
func (m *NeoVaultContract) GetAdmin(ctx context.Context) (string, error) {
	result, err := m.client.InvokeFunction(ctx, m.contractHash, "admin", nil)
	if err != nil {
		return "", err
	}
	if result.State != "HALT" {
		return "", fmt.Errorf("execution failed: %s", result.Exception)
	}
	if len(result.Stack) == 0 {
		return "", fmt.Errorf("no result")
	}
	return chain.ParseHash160(result.Stack[0])
}

// IsPaused returns whether the contract is paused.
func (m *NeoVaultContract) IsPaused(ctx context.Context) (bool, error) {
	result, err := m.client.InvokeFunction(ctx, m.contractHash, "paused", nil)
	if err != nil {
		return false, err
	}
	if result.State != "HALT" {
		return false, fmt.Errorf("execution failed: %s", result.Exception)
	}
	if len(result.Stack) == 0 {
		return false, fmt.Errorf("no result")
	}
	return chain.ParseBoolean(result.Stack[0])
}

// GetService returns service information by service ID.
func (m *NeoVaultContract) GetService(ctx context.Context, serviceID []byte) (*NeoVaultServiceInfo, error) {
	params := []chain.ContractParam{chain.NewByteArrayParam(serviceID)}
	result, err := m.client.InvokeFunction(ctx, m.contractHash, "getService", params)
	if err != nil {
		return nil, err
	}
	if result.State != "HALT" {
		return nil, fmt.Errorf("execution failed: %s", result.Exception)
	}
	if len(result.Stack) == 0 {
		return nil, fmt.Errorf("no result")
	}
	return parseNeoVaultServiceInfo(result.Stack[0])
}

// GetDispute returns dispute information by request hash.
func (m *NeoVaultContract) GetDispute(ctx context.Context, requestHash []byte) (*NeoVaultDisputeInfo, error) {
	params := []chain.ContractParam{chain.NewByteArrayParam(requestHash)}
	result, err := m.client.InvokeFunction(ctx, m.contractHash, "getDispute", params)
	if err != nil {
		return nil, err
	}
	if result.State != "HALT" {
		return nil, fmt.Errorf("execution failed: %s", result.Exception)
	}
	if len(result.Stack) == 0 {
		return nil, fmt.Errorf("no result")
	}
	return parseNeoVaultDisputeInfo(result.Stack[0])
}

// IsRequestResolved checks if a request hash has been marked resolved on-chain.
func (m *NeoVaultContract) IsRequestResolved(ctx context.Context, requestHash []byte) (bool, error) {
	params := []chain.ContractParam{chain.NewByteArrayParam(requestHash)}
	result, err := m.client.InvokeFunction(ctx, m.contractHash, "isRequestResolved", params)
	if err != nil {
		return false, err
	}
	if result.State != "HALT" {
		return false, fmt.Errorf("execution failed: %s", result.Exception)
	}
	if len(result.Stack) == 0 {
		return false, fmt.Errorf("no result")
	}
	return chain.ParseBoolean(result.Stack[0])
}

// CanClaimDisputeRefund checks whether a dispute refund is currently claimable
// (i.e. the dispute exists, is pending, and the deadline has passed).
func (m *NeoVaultContract) CanClaimDisputeRefund(ctx context.Context, requestHash []byte) (bool, error) {
	params := []chain.ContractParam{chain.NewByteArrayParam(requestHash)}
	result, err := m.client.InvokeFunction(ctx, m.contractHash, "canClaimDisputeRefund", params)
	if err != nil {
		return false, err
	}
	if result.State != "HALT" {
		return false, fmt.Errorf("execution failed: %s", result.Exception)
	}
	if len(result.Stack) == 0 {
		return false, fmt.Errorf("no result")
	}
	return chain.ParseBoolean(result.Stack[0])
}

// IsDisputeResolved is kept for backward compatibility with older wrappers.
// It is equivalent to IsRequestResolved.
func (m *NeoVaultContract) IsDisputeResolved(ctx context.Context, requestHash []byte) (bool, error) {
	return m.IsRequestResolved(ctx, requestHash)
}

// =============================================================================
// Types
// =============================================================================

// NeoVaultServiceInfo represents registered service information.
type NeoVaultServiceInfo struct {
	ServiceID         []byte
	TeePubKey         []byte
	BondAmount        *big.Int
	OutstandingAmount *big.Int
	Status            uint8
	Active            bool
	RegisteredAt      uint64
}

// NeoVaultDisputeInfo represents dispute information.
type NeoVaultDisputeInfo struct {
	RequestHash     []byte
	User            string
	Amount          *big.Int
	RequestProof    []byte
	ServiceID       []byte
	SubmittedAt     uint64
	Deadline        uint64
	Status          uint8 // 0=Pending, 1=Resolved, 2=Refunded
	CompletionProof []byte
	ResolvedAt      uint64
}

// DisputeStatus constants
const (
	DisputeStatusPending  uint8 = 0
	DisputeStatusResolved uint8 = 1
	DisputeStatusRefunded uint8 = 2
)

// =============================================================================
// Parsers
// =============================================================================

// parseNeoVaultServiceInfo parses service info from contract result.
func parseNeoVaultServiceInfo(item chain.StackItem) (*NeoVaultServiceInfo, error) {
	if item.Type == "Null" {
		return nil, nil
	}
	if item.Type != "Array" && item.Type != "Struct" {
		return nil, fmt.Errorf("expected Array or Struct, got %s", item.Type)
	}

	var arr []chain.StackItem
	if err := json.Unmarshal(item.Value, &arr); err != nil {
		return nil, fmt.Errorf("unmarshal array: %w", err)
	}
	if len(arr) < 6 {
		return nil, fmt.Errorf("invalid NeoVaultServiceInfo: expected 6 items, got %d", len(arr))
	}

	serviceID, err := chain.ParseByteArray(arr[0])
	if err != nil {
		return nil, fmt.Errorf("parse serviceId: %w", err)
	}

	teePubKey, err := chain.ParseByteArray(arr[1])
	if err != nil {
		return nil, fmt.Errorf("parse teePubKey: %w", err)
	}

	bondAmount, err := chain.ParseInteger(arr[2])
	if err != nil {
		return nil, fmt.Errorf("parse bondAmount: %w", err)
	}

	outstandingAmount, err := chain.ParseInteger(arr[3])
	if err != nil {
		return nil, fmt.Errorf("parse outstandingAmount: %w", err)
	}

	status, err := chain.ParseInteger(arr[4])
	if err != nil {
		return nil, fmt.Errorf("parse status: %w", err)
	}

	registeredAt, err := chain.ParseInteger(arr[5])
	if err != nil {
		return nil, fmt.Errorf("parse registeredAt: %w", err)
	}

	statusByte := uint8(status.Uint64())

	return &NeoVaultServiceInfo{
		ServiceID:         serviceID,
		TeePubKey:         teePubKey,
		BondAmount:        bondAmount,
		OutstandingAmount: outstandingAmount,
		Status:            statusByte,
		Active:            statusByte == 1,
		RegisteredAt:      registeredAt.Uint64(),
	}, nil
}

// parseNeoVaultDisputeInfo parses dispute info from contract result.
func parseNeoVaultDisputeInfo(item chain.StackItem) (*NeoVaultDisputeInfo, error) {
	if item.Type == "Null" {
		return nil, nil
	}
	if item.Type != "Array" && item.Type != "Struct" {
		return nil, fmt.Errorf("expected Array or Struct, got %s", item.Type)
	}

	var arr []chain.StackItem
	if err := json.Unmarshal(item.Value, &arr); err != nil {
		return nil, fmt.Errorf("unmarshal array: %w", err)
	}
	if len(arr) < 10 {
		return nil, fmt.Errorf("invalid NeoVaultDisputeInfo: expected 10 items, got %d", len(arr))
	}

	requestHash, err := chain.ParseByteArray(arr[0])
	if err != nil {
		return nil, fmt.Errorf("parse requestHash: %w", err)
	}

	user, err := chain.ParseHash160(arr[1])
	if err != nil {
		return nil, fmt.Errorf("parse user: %w", err)
	}

	amount, err := chain.ParseInteger(arr[2])
	if err != nil {
		return nil, fmt.Errorf("parse amount: %w", err)
	}

	requestProof, err := chain.ParseByteArray(arr[3])
	if err != nil {
		return nil, fmt.Errorf("parse requestProof: %w", err)
	}

	serviceID, err := chain.ParseByteArray(arr[4])
	if err != nil {
		return nil, fmt.Errorf("parse serviceId: %w", err)
	}

	submittedAt, err := chain.ParseInteger(arr[5])
	if err != nil {
		return nil, fmt.Errorf("parse submittedAt: %w", err)
	}

	deadline, err := chain.ParseInteger(arr[6])
	if err != nil {
		return nil, fmt.Errorf("parse deadline: %w", err)
	}

	status, err := chain.ParseInteger(arr[7])
	if err != nil {
		return nil, fmt.Errorf("parse status: %w", err)
	}

	completionProof, err := chain.ParseByteArray(arr[8])
	if err != nil {
		return nil, fmt.Errorf("parse completionProof: %w", err)
	}

	resolvedAt, err := chain.ParseInteger(arr[9])
	if err != nil {
		return nil, fmt.Errorf("parse resolvedAt: %w", err)
	}

	return &NeoVaultDisputeInfo{
		RequestHash:     requestHash,
		User:            user,
		Amount:          amount,
		RequestProof:    requestProof,
		ServiceID:       serviceID,
		SubmittedAt:     submittedAt.Uint64(),
		Deadline:        deadline.Uint64(),
		Status:          uint8(status.Uint64()),
		CompletionProof: completionProof,
		ResolvedAt:      resolvedAt.Uint64(),
	}, nil
}

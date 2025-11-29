package contract

import (
	"context"
)

// BaseContract provides common functionality for service contracts.
// Embed this in your contract implementation to get standard behaviors.
type BaseContract struct {
	spec     Spec
	accounts AccountResolver
	gasBank  GasBankClient
	emitter  EventEmitter
}

// NewBaseContract creates a base contract with the given specification.
func NewBaseContract(spec Spec) *BaseContract {
	return &BaseContract{spec: spec}
}

// Spec returns the contract specification.
func (bc *BaseContract) Spec() Spec {
	return bc.spec
}

// SetAccountResolver sets the account resolver.
func (bc *BaseContract) SetAccountResolver(resolver AccountResolver) {
	bc.accounts = resolver
}

// SetGasBankClient sets the gas bank client.
func (bc *BaseContract) SetGasBankClient(client GasBankClient) {
	bc.gasBank = client
}

// SetEventEmitter sets the event emitter.
func (bc *BaseContract) SetEventEmitter(emitter EventEmitter) {
	bc.emitter = emitter
}

// RequireAccount verifies account ownership and returns an error if the caller
// does not own the specified account.
func (bc *BaseContract) RequireAccount(ctx context.Context, accountID string) error {
	cc, ok := FromContext(ctx)
	if !ok {
		return &ContractError{Code: "NO_CONTEXT", Message: "contract context not found"}
	}
	if bc.accounts == nil {
		return nil // No resolver configured, skip check
	}
	ownedBy, err := bc.accounts.VerifyAccountOwnership(ctx, accountID, cc.Caller)
	if err != nil {
		return &ContractError{Code: "ACCOUNT_ERROR", Message: err.Error()}
	}
	if !ownedBy {
		return &ContractError{Code: "UNAUTHORIZED", Message: "caller does not own account"}
	}
	return nil
}

// ReserveGas reserves gas from the account's gas bank for the operation.
func (bc *BaseContract) ReserveGas(ctx context.Context, amount float64, reason string) (string, error) {
	cc, ok := FromContext(ctx)
	if !ok {
		return "", &ContractError{Code: "NO_CONTEXT", Message: "contract context not found"}
	}
	if bc.gasBank == nil {
		return "", nil // No gas bank configured
	}
	return bc.gasBank.Reserve(ctx, cc.AccountID, amount, reason)
}

// ReleaseGas releases a previously reserved gas amount.
func (bc *BaseContract) ReleaseGas(ctx context.Context, reservationID string) error {
	if bc.gasBank == nil {
		return nil
	}
	return bc.gasBank.Release(ctx, reservationID)
}

// Emit emits an event from the contract.
func (bc *BaseContract) Emit(ctx context.Context, eventName string, data map[string]any) error {
	if bc.emitter == nil {
		return nil // No emitter configured
	}
	return bc.emitter.Emit(ctx, eventName, data)
}

// ContractError represents a contract execution error.
type ContractError struct {
	Code    string
	Message string
}

func (e *ContractError) Error() string {
	return e.Code + ": " + e.Message
}

// Common error codes
const (
	ErrUnauthorized  = "UNAUTHORIZED"
	ErrInvalidInput  = "INVALID_INPUT"
	ErrNotFound      = "NOT_FOUND"
	ErrInsufficientGas = "INSUFFICIENT_GAS"
	ErrContractPaused  = "CONTRACT_PAUSED"
)

// NewError creates a new contract error.
func NewError(code, message string) *ContractError {
	return &ContractError{Code: code, Message: message}
}

// Package database provides Supabase database integration.
package database

import (
	"context"
)

// =============================================================================
// Core Interfaces (Shared across services)
// =============================================================================

// UserRepository defines user-related data access methods.
type UserRepository interface {
	GetUser(ctx context.Context, id string) (*User, error)
	GetUserByAddress(ctx context.Context, address string) (*User, error)
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	CreateUser(ctx context.Context, user *User) error
	UpdateUserEmail(ctx context.Context, userID, email string) error
	UpdateUserNonce(ctx context.Context, userID, nonce string) error
}

// ServiceRequestRepository defines service request data access methods.
type ServiceRequestRepository interface {
	GetServiceRequests(ctx context.Context, userID string, limit int) ([]ServiceRequest, error)
	CreateServiceRequest(ctx context.Context, req *ServiceRequest) error
	UpdateServiceRequest(ctx context.Context, req *ServiceRequest) error
}

// PriceFeedRepository defines price feed data access methods.
type PriceFeedRepository interface {
	GetLatestPrice(ctx context.Context, feedID string) (*PriceFeed, error)
	CreatePriceFeed(ctx context.Context, feed *PriceFeed) error
}

// GasBankRepository defines gas bank data access methods.
type GasBankRepository interface {
	GetGasBankAccount(ctx context.Context, userID string) (*GasBankAccount, error)
	CreateGasBankAccount(ctx context.Context, account *GasBankAccount) error
	GetOrCreateGasBankAccount(ctx context.Context, userID string) (*GasBankAccount, error)
	UpdateGasBankBalance(ctx context.Context, userID string, balance, reserved int64) error
	CreateGasBankTransaction(ctx context.Context, tx *GasBankTransaction) error
	GetGasBankTransactions(ctx context.Context, accountID string, limit int) ([]GasBankTransaction, error)
	CreateDepositRequest(ctx context.Context, deposit *DepositRequest) error
	GetDepositRequests(ctx context.Context, userID string, limit int) ([]DepositRequest, error)
	GetDepositByTxHash(ctx context.Context, txHash string) (*DepositRequest, error)
	UpdateDepositStatus(ctx context.Context, depositID, status string, confirmations int) error
	GetPendingDeposits(ctx context.Context, limit int) ([]DepositRequest, error)

	// Atomic operations backed by database stored procedures.
	DeductFeeAtomic(ctx context.Context, userID string, amount int64, serviceID, referenceID string) (*AtomicDeductResult, error)
	CreditDepositAtomic(ctx context.Context, userID string, amount int64, txHash, fromAddress, referenceID string) (*AtomicCreditResult, error)
	ReserveFundsAtomic(ctx context.Context, userID string, amount int64) (*AtomicReserveResult, error)
	ReleaseFundsAtomic(ctx context.Context, userID string, amount int64, commit bool) (*AtomicReleaseResult, error)
}

// AtomicDeductResult holds the result of an atomic fee deduction.
type AtomicDeductResult struct {
	Success       bool
	NewBalance    int64
	TransactionID string
	Error         string
}

// AtomicCreditResult holds the result of an atomic deposit credit.
type AtomicCreditResult struct {
	Success       bool
	NewBalance    int64
	TransactionID string
	Error         string
}

// AtomicReserveResult holds the result of an atomic fund reservation.
type AtomicReserveResult struct {
	Success     bool
	NewBalance  int64
	NewReserved int64
	Error       string
}

// AtomicReleaseResult holds the result of an atomic release/commit of reserved funds.
type AtomicReleaseResult struct {
	Success     bool
	NewBalance  int64
	NewReserved int64
	Error       string
}

// ReplayRepository defines replay protection data access methods.
type ReplayRepository interface {
	// MarkRequestSeen atomically checks and marks a request as seen.
	// Returns true if the request is new (not a replay), false if already seen.
	MarkRequestSeen(ctx context.Context, serviceID, requestID string, windowSeconds int) (bool, error)
	// DeleteSeenRequest removes a request marker so it can be retried.
	DeleteSeenRequest(ctx context.Context, serviceID, requestID string) error
	// CleanupSeenRequests removes expired entries. Pass empty serviceID to clean all.
	CleanupSeenRequests(ctx context.Context, serviceID string) (int, error)
}

// =============================================================================
// Base Repository Interface (For nitro.Service framework)
// =============================================================================

// BaseRepository defines the minimal interface required by the nitro framework.
// Services should use this interface for framework integration, and define their
// own service-specific repository interfaces for domain operations.
type BaseRepository interface {
	UserRepository
	ServiceRequestRepository
	GasBankRepository
	ReplayRepository
}

// =============================================================================
// Full Repository Interface
// =============================================================================

// RepositoryInterface defines all data access methods.
// Service-specific operations have been moved to services/*/supabase packages.
// This interface now only contains shared operations used by multiple services.
type RepositoryInterface interface {
	BaseRepository
	PriceFeedRepository
	// HealthCheck verifies connectivity with the underlying database.
	HealthCheck(ctx context.Context) error
}

// Ensure Repository implements RepositoryInterface
var _ RepositoryInterface = (*Repository)(nil)

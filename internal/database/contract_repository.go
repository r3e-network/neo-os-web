package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/willtech-services/service_layer/internal/models"
)

// ContractRepository provides access to contract storage
type ContractRepository struct {
	db *sqlx.DB
}

// NewContractRepository creates a new contract repository
func NewContractRepository(db *sqlx.DB) *ContractRepository {
	return &ContractRepository{
		db: db,
	}
}

// Create creates a new contract
func (r *ContractRepository) Create(ctx context.Context, contract *models.Contract) error {
	query := `
		INSERT INTO contracts (
			id, name, description, source, bytecode, manifest,
			address, network, created_at, updated_at, user_id, status, tx_hash
		) VALUES (
			:id, :name, :description, :source, :bytecode, :manifest,
			:address, :network, :created_at, :updated_at, :user_id, :status, :tx_hash
		)
	`

	_, err := r.db.NamedExecContext(ctx, query, contract)
	if err != nil {
		return fmt.Errorf("failed to create contract: %w", err)
	}

	return nil
}

// GetByID retrieves a contract by ID
func (r *ContractRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Contract, error) {
	query := `
		SELECT * FROM contracts
		WHERE id = $1
	`

	var contract models.Contract
	if err := r.db.GetContext(ctx, &contract, query, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("contract not found: %w", err)
		}
		return nil, fmt.Errorf("failed to get contract: %w", err)
	}

	return &contract, nil
}

// GetByAddress retrieves a contract by address
func (r *ContractRepository) GetByAddress(ctx context.Context, address, network string) (*models.Contract, error) {
	query := `
		SELECT * FROM contracts
		WHERE address = $1 AND network = $2
	`

	var contract models.Contract
	if err := r.db.GetContext(ctx, &contract, query, address, network); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("contract not found: %w", err)
		}
		return nil, fmt.Errorf("failed to get contract: %w", err)
	}

	return &contract, nil
}

// GetByUserID retrieves contracts by user ID
func (r *ContractRepository) GetByUserID(ctx context.Context, userID int) ([]*models.Contract, error) {
	query := `
		SELECT * FROM contracts
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	var contracts []*models.Contract
	if err := r.db.SelectContext(ctx, &contracts, query, userID); err != nil {
		return nil, fmt.Errorf("failed to get contracts: %w", err)
	}

	return contracts, nil
}

// Update updates a contract
func (r *ContractRepository) Update(ctx context.Context, contract *models.Contract) error {
	query := `
		UPDATE contracts
		SET
			name = :name,
			description = :description,
			bytecode = :bytecode,
			manifest = :manifest,
			address = :address,
			updated_at = :updated_at,
			status = :status,
			tx_hash = :tx_hash
		WHERE id = :id
	`

	contract.UpdatedAt = time.Now()
	_, err := r.db.NamedExecContext(ctx, query, contract)
	if err != nil {
		return fmt.Errorf("failed to update contract: %w", err)
	}

	return nil
}

// Delete deletes a contract
func (r *ContractRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `
		DELETE FROM contracts
		WHERE id = $1
	`

	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete contract: %w", err)
	}

	return nil
}

// CreateVerification creates a new contract verification
func (r *ContractRepository) CreateVerification(ctx context.Context, verification *models.ContractVerification) error {
	query := `
		INSERT INTO contract_verifications (
			id, contract_id, verified, message, details, created_at, user_id
		) VALUES (
			:id, :contract_id, :verified, :message, :details, :created_at, :user_id
		)
	`

	_, err := r.db.NamedExecContext(ctx, query, verification)
	if err != nil {
		return fmt.Errorf("failed to create contract verification: %w", err)
	}

	return nil
}

// GetVerificationsByContractID retrieves verifications by contract ID
func (r *ContractRepository) GetVerificationsByContractID(ctx context.Context, contractID uuid.UUID) ([]*models.ContractVerification, error) {
	query := `
		SELECT * FROM contract_verifications
		WHERE contract_id = $1
		ORDER BY created_at DESC
	`

	var verifications []*models.ContractVerification
	if err := r.db.SelectContext(ctx, &verifications, query, contractID); err != nil {
		return nil, fmt.Errorf("failed to get contract verifications: %w", err)
	}

	return verifications, nil
}

// GetLatestVerification retrieves the latest verification for a contract
func (r *ContractRepository) GetLatestVerification(ctx context.Context, contractID uuid.UUID) (*models.ContractVerification, error) {
	query := `
		SELECT * FROM contract_verifications
		WHERE contract_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`

	var verification models.ContractVerification
	if err := r.db.GetContext(ctx, &verification, query, contractID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("contract verification not found: %w", err)
		}
		return nil, fmt.Errorf("failed to get contract verification: %w", err)
	}

	return &verification, nil
}

// DetailsToJSON converts verification details to JSON
func DetailsToJSON(details map[string]interface{}) ([]byte, error) {
	return json.Marshal(details)
}

// JSONToDetails converts JSON to verification details
func JSONToDetails(data []byte) (map[string]interface{}, error) {
	var details map[string]interface{}
	if err := json.Unmarshal(data, &details); err != nil {
		return nil, err
	}
	return details, nil
} 
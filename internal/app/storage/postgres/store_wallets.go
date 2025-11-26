package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/R3E-Network/service_layer/internal/domain/account"
)

// WorkspaceWalletStore implementation

func (s *Store) CreateWorkspaceWallet(ctx context.Context, wallet account.WorkspaceWallet) (account.WorkspaceWallet, error) {
	if wallet.ID == "" {
		wallet.ID = uuid.NewString()
	}
	if err := account.ValidateWalletAddress(wallet.WalletAddress); err != nil {
		return account.WorkspaceWallet{}, err
	}
	wallet.WalletAddress = normalizeWallet(wallet.WalletAddress)
	now := time.Now().UTC()
	wallet.CreatedAt = now
	wallet.UpdatedAt = now

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO workspace_wallets (id, workspace_id, wallet_address, label, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, wallet.ID, wallet.WorkspaceID, wallet.WalletAddress, wallet.Label, wallet.Status, wallet.CreatedAt, wallet.UpdatedAt)
	if err != nil {
		return account.WorkspaceWallet{}, err
	}
	return wallet, nil
}

func (s *Store) GetWorkspaceWallet(ctx context.Context, id string) (account.WorkspaceWallet, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, workspace_id, wallet_address, label, status, created_at, updated_at
		FROM workspace_wallets
		WHERE id = $1
	`, id)

	return scanWorkspaceWallet(row)
}

func (s *Store) ListWorkspaceWallets(ctx context.Context, workspaceID string) ([]account.WorkspaceWallet, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, workspace_id, wallet_address, label, status, created_at, updated_at
		FROM workspace_wallets
		WHERE workspace_id = $1
		ORDER BY created_at DESC
	`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []account.WorkspaceWallet
	for rows.Next() {
		w, err := scanWorkspaceWallet(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, w)
	}
	return result, rows.Err()
}

func (s *Store) FindWorkspaceWalletByAddress(ctx context.Context, workspaceID, wallet string) (account.WorkspaceWallet, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, workspace_id, wallet_address, label, status, created_at, updated_at
		FROM workspace_wallets
		WHERE workspace_id = $1 AND lower(wallet_address) = lower($2)
	`, workspaceID, wallet)
	return scanWorkspaceWallet(row)
}

func scanWorkspaceWallet(scanner rowScanner) (account.WorkspaceWallet, error) {
	var (
		wallet    account.WorkspaceWallet
		createdAt time.Time
		updatedAt time.Time
	)
	if err := scanner.Scan(&wallet.ID, &wallet.WorkspaceID, &wallet.WalletAddress, &wallet.Label, &wallet.Status, &createdAt, &updatedAt); err != nil {
		return account.WorkspaceWallet{}, err
	}
	wallet.WalletAddress = normalizeWallet(wallet.WalletAddress)
	wallet.CreatedAt = createdAt.UTC()
	wallet.UpdatedAt = updatedAt.UTC()
	return wallet, nil
}

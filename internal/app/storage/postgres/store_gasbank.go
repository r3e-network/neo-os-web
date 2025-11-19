package postgres

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/R3E-Network/service_layer/internal/app/domain/gasbank"
)

// GasBankStore implementation

func (s *Store) CreateGasAccount(ctx context.Context, acct gasbank.Account) (gasbank.Account, error) {
	if acct.ID == "" {
		acct.ID = uuid.NewString()
	}
	acct.AccountID = strings.TrimSpace(acct.AccountID)
	acct.WalletAddress = normalizeWallet(acct.WalletAddress)
	now := time.Now().UTC()
	acct.CreatedAt = now
	acct.UpdatedAt = now

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO app_gas_accounts (id, account_id, wallet_address, balance, available, pending, daily_withdrawal, last_withdrawal, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, acct.ID, acct.AccountID, toNullString(acct.WalletAddress), acct.Balance, acct.Available, acct.Pending, acct.DailyWithdrawal, toNullTime(acct.LastWithdrawal), acct.CreatedAt, acct.UpdatedAt)
	if err != nil {
		return gasbank.Account{}, err
	}
	return acct, nil
}

func (s *Store) UpdateGasAccount(ctx context.Context, acct gasbank.Account) (gasbank.Account, error) {
	existing, err := s.GetGasAccount(ctx, acct.ID)
	if err != nil {
		return gasbank.Account{}, err
	}

	acct.AccountID = existing.AccountID
	if acct.WalletAddress == "" {
		acct.WalletAddress = existing.WalletAddress
	}
	acct.WalletAddress = normalizeWallet(acct.WalletAddress)
	acct.CreatedAt = existing.CreatedAt
	acct.UpdatedAt = time.Now().UTC()

	_, err = s.db.ExecContext(ctx, `
		UPDATE app_gas_accounts
		SET wallet_address = $2, balance = $3, available = $4, pending = $5, daily_withdrawal = $6, last_withdrawal = $7, updated_at = $8
		WHERE id = $1
	`, acct.ID, toNullString(acct.WalletAddress), acct.Balance, acct.Available, acct.Pending, acct.DailyWithdrawal, toNullTime(acct.LastWithdrawal), acct.UpdatedAt)
	if err != nil {
		return gasbank.Account{}, err
	}
	return acct, nil
}

func (s *Store) GetGasAccount(ctx context.Context, id string) (gasbank.Account, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, wallet_address, balance, available, pending, daily_withdrawal, last_withdrawal, created_at, updated_at
		FROM app_gas_accounts
		WHERE id = $1
	`, id)

	acct, err := scanGasAccount(row)
	if err != nil {
		return gasbank.Account{}, err
	}
	return acct, nil
}

func (s *Store) GetGasAccountByWallet(ctx context.Context, wallet string) (gasbank.Account, error) {
	wallet = normalizeWallet(wallet)
	if wallet == "" {
		return gasbank.Account{}, sql.ErrNoRows
	}
	row := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, wallet_address, balance, available, pending, daily_withdrawal, last_withdrawal, created_at, updated_at
		FROM app_gas_accounts
		WHERE wallet_address = $1
	`, wallet)

	acct, err := scanGasAccount(row)
	if err != nil {
		return gasbank.Account{}, err
	}
	return acct, nil
}

func (s *Store) ListGasAccounts(ctx context.Context, accountID string) ([]gasbank.Account, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, wallet_address, balance, available, pending, daily_withdrawal, last_withdrawal, created_at, updated_at
		FROM app_gas_accounts
		WHERE $1 = '' OR account_id = $1
		ORDER BY created_at
	`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []gasbank.Account
	for rows.Next() {
		acct, err := scanGasAccount(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, acct)
	}
	return result, rows.Err()
}

func (s *Store) CreateGasTransaction(ctx context.Context, tx gasbank.Transaction) (gasbank.Transaction, error) {
	if tx.ID == "" {
		tx.ID = uuid.NewString()
	}
	tx.AccountID = strings.TrimSpace(tx.AccountID)
	tx.UserAccountID = strings.TrimSpace(tx.UserAccountID)
	tx.Type = strings.TrimSpace(tx.Type)
	tx.BlockchainTxID = strings.TrimSpace(tx.BlockchainTxID)
	tx.FromAddress = strings.TrimSpace(tx.FromAddress)
	tx.ToAddress = strings.TrimSpace(tx.ToAddress)
	tx.Notes = strings.TrimSpace(tx.Notes)
	tx.Error = strings.TrimSpace(tx.Error)
	now := time.Now().UTC()
	tx.CreatedAt = now
	tx.UpdatedAt = now

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO app_gas_transactions (id, account_id, user_account_id, type, amount, net_amount, status, blockchain_tx_id, from_address, to_address, notes, error, completed_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`, tx.ID, tx.AccountID, toNullString(tx.UserAccountID), tx.Type, tx.Amount, tx.NetAmount, tx.Status, toNullString(tx.BlockchainTxID), toNullString(tx.FromAddress), toNullString(tx.ToAddress), toNullString(tx.Notes), toNullString(tx.Error), toNullTime(tx.CompletedAt), tx.CreatedAt, tx.UpdatedAt)
	if err != nil {
		return gasbank.Transaction{}, err
	}
	return tx, nil
}

func (s *Store) UpdateGasTransaction(ctx context.Context, tx gasbank.Transaction) (gasbank.Transaction, error) {
	existing, err := s.GetGasTransaction(ctx, tx.ID)
	if err != nil {
		return gasbank.Transaction{}, err
	}

	tx.AccountID = existing.AccountID
	if tx.UserAccountID == "" {
		tx.UserAccountID = existing.UserAccountID
	}
	tx.UserAccountID = strings.TrimSpace(tx.UserAccountID)
	tx.Type = strings.TrimSpace(tx.Type)
	tx.BlockchainTxID = strings.TrimSpace(tx.BlockchainTxID)
	tx.FromAddress = strings.TrimSpace(tx.FromAddress)
	tx.ToAddress = strings.TrimSpace(tx.ToAddress)
	tx.Notes = strings.TrimSpace(tx.Notes)
	tx.Error = strings.TrimSpace(tx.Error)
	tx.CreatedAt = existing.CreatedAt
	tx.UpdatedAt = time.Now().UTC()

	_, err = s.db.ExecContext(ctx, `
		UPDATE app_gas_transactions
		SET type = $2, amount = $3, net_amount = $4, status = $5, blockchain_tx_id = $6, from_address = $7, to_address = $8, notes = $9, error = $10, completed_at = $11, updated_at = $12
		WHERE id = $1
	`, tx.ID, tx.Type, tx.Amount, tx.NetAmount, tx.Status, toNullString(tx.BlockchainTxID), toNullString(tx.FromAddress), toNullString(tx.ToAddress), toNullString(tx.Notes), toNullString(tx.Error), toNullTime(tx.CompletedAt), tx.UpdatedAt)
	if err != nil {
		return gasbank.Transaction{}, err
	}
	return tx, nil
}

func (s *Store) GetGasTransaction(ctx context.Context, id string) (gasbank.Transaction, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, user_account_id, type, amount, net_amount, status, blockchain_tx_id, from_address, to_address, notes, error, completed_at, created_at, updated_at
		FROM app_gas_transactions
		WHERE id = $1
	`, id)

	tx, err := scanGasTransaction(row)
	if err != nil {
		return gasbank.Transaction{}, err
	}
	return tx, nil
}

func (s *Store) ListGasTransactions(ctx context.Context, gasAccountID string, limit int) ([]gasbank.Transaction, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, user_account_id, type, amount, net_amount, status, blockchain_tx_id, from_address, to_address, notes, error, completed_at, created_at, updated_at
		FROM app_gas_transactions
		WHERE account_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, gasAccountID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []gasbank.Transaction
	for rows.Next() {
		tx, err := scanGasTransaction(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, tx)
	}
	return result, rows.Err()
}

func (s *Store) ListPendingWithdrawals(ctx context.Context) ([]gasbank.Transaction, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, user_account_id, type, amount, net_amount, status, blockchain_tx_id, from_address, to_address, notes, error, completed_at, created_at, updated_at
		FROM app_gas_transactions
		WHERE type = $1 AND status = $2
		ORDER BY created_at
	`, gasbank.TransactionWithdrawal, gasbank.StatusPending)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []gasbank.Transaction
	for rows.Next() {
		tx, err := scanGasTransaction(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, tx)
	}
	return result, rows.Err()
}

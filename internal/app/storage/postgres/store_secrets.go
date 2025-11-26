package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/R3E-Network/service_layer/internal/domain/secret"
)

// SecretStore implementation

func (s *Store) CreateSecret(ctx context.Context, sec secret.Secret) (secret.Secret, error) {
	if sec.ID == "" {
		sec.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	sec.CreatedAt = now
	sec.UpdatedAt = now
	sec.Version = 1

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO app_secrets (id, account_id, name, value, version, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, sec.ID, sec.AccountID, sec.Name, sec.Value, sec.Version, sec.CreatedAt, sec.UpdatedAt)
	if err != nil {
		return secret.Secret{}, err
	}
	return sec, nil
}

func (s *Store) UpdateSecret(ctx context.Context, sec secret.Secret) (secret.Secret, error) {
	existing, err := s.GetSecret(ctx, sec.AccountID, sec.Name)
	if err != nil {
		return secret.Secret{}, err
	}

	sec.ID = existing.ID
	sec.AccountID = existing.AccountID
	sec.Name = existing.Name
	sec.CreatedAt = existing.CreatedAt
	sec.Version = existing.Version + 1
	sec.UpdatedAt = time.Now().UTC()

	_, err = s.db.ExecContext(ctx, `
		UPDATE app_secrets
		SET value = $1, version = $2, updated_at = $3
		WHERE id = $4
	`, sec.Value, sec.Version, sec.UpdatedAt, sec.ID)
	if err != nil {
		return secret.Secret{}, err
	}
	return sec, nil
}

func (s *Store) GetSecret(ctx context.Context, accountID, name string) (secret.Secret, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, name, value, version, created_at, updated_at
		FROM app_secrets
		WHERE account_id = $1 AND lower(name) = lower($2)
	`, accountID, name)

	sec, err := scanSecret(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return secret.Secret{}, fmt.Errorf("secret %s not found for account %s", name, accountID)
		}
		return secret.Secret{}, err
	}
	return sec, nil
}

func (s *Store) ListSecrets(ctx context.Context, accountID string) ([]secret.Secret, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, name, value, version, created_at, updated_at
		FROM app_secrets
		WHERE account_id = $1
		ORDER BY created_at
	`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []secret.Secret
	for rows.Next() {
		sec, err := scanSecret(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, sec)
	}
	return result, rows.Err()
}

func (s *Store) DeleteSecret(ctx context.Context, accountID, name string) error {
	result, err := s.db.ExecContext(ctx, `
		DELETE FROM app_secrets
		WHERE account_id = $1 AND lower(name) = lower($2)
	`, accountID, name)
	if err != nil {
		return err
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		return fmt.Errorf("secret %s not found for account %s", name, accountID)
	}
	return nil
}

// Package storage provides Supabase-based storage adapters.
// This replaces direct SQL queries with PostgREST API calls.
package storage

import (
	"context"
	"encoding/json"
	"time"

	"github.com/R3E-Network/service_layer/pkg/supabase"
)

// SupabaseStore provides CRUD operations via Supabase PostgREST.
type SupabaseStore struct {
	client *supabase.Client
}

// NewSupabaseStore creates a new Supabase-based store.
func NewSupabaseStore(client *supabase.Client) *SupabaseStore {
	return &SupabaseStore{client: client}
}

// ============================================================================
// Account Operations
// ============================================================================

// Account represents an app account.
type Account struct {
	ID        string          `json:"id"`
	Owner     string          `json:"owner"`
	Tenant    string          `json:"tenant"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// CreateAccount creates a new account.
func (s *SupabaseStore) CreateAccount(ctx context.Context, acct *Account) error {
	return s.client.From("app_accounts").Insert(ctx, acct)
}

// GetAccount retrieves an account by ID.
func (s *SupabaseStore) GetAccount(ctx context.Context, id string) (*Account, error) {
	var accounts []Account
	err := s.client.From("app_accounts").
		Select("*").
		Eq("id", id).
		Limit(1).
		Execute(ctx, &accounts)
	if err != nil {
		return nil, err
	}
	if len(accounts) == 0 {
		return nil, nil
	}
	return &accounts[0], nil
}

// ListAccounts lists accounts with pagination.
func (s *SupabaseStore) ListAccounts(ctx context.Context, tenant string, limit, offset int) ([]Account, error) {
	var accounts []Account
	q := s.client.From("app_accounts").
		Select("*").
		Order("created_at", false)

	if tenant != "" {
		q = q.Eq("tenant", tenant)
	}
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}

	err := q.Execute(ctx, &accounts)
	return accounts, err
}

// UpdateAccount updates an existing account.
func (s *SupabaseStore) UpdateAccount(ctx context.Context, acct *Account) error {
	acct.UpdatedAt = time.Now().UTC()
	return s.client.From("app_accounts").
		Eq("id", acct.ID).
		Update(ctx, acct)
}

// DeleteAccount deletes an account by ID.
func (s *SupabaseStore) DeleteAccount(ctx context.Context, id string) error {
	return s.client.From("app_accounts").
		Eq("id", id).
		Delete(ctx)
}

// ============================================================================
// Function Operations
// ============================================================================

// Function represents a serverless function.
type Function struct {
	ID        string          `json:"id"`
	AccountID string          `json:"account_id"`
	Name      string          `json:"name"`
	Runtime   string          `json:"runtime"`
	Source    string          `json:"source"`
	Tenant    string          `json:"tenant"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// CreateFunction creates a new function.
func (s *SupabaseStore) CreateFunction(ctx context.Context, fn *Function) error {
	return s.client.From("app_functions").Insert(ctx, fn)
}

// GetFunction retrieves a function by ID.
func (s *SupabaseStore) GetFunction(ctx context.Context, id string) (*Function, error) {
	var functions []Function
	err := s.client.From("app_functions").
		Select("*").
		Eq("id", id).
		Limit(1).
		Execute(ctx, &functions)
	if err != nil {
		return nil, err
	}
	if len(functions) == 0 {
		return nil, nil
	}
	return &functions[0], nil
}

// ListFunctions lists functions for an account.
func (s *SupabaseStore) ListFunctions(ctx context.Context, accountID string, limit, offset int) ([]Function, error) {
	var functions []Function
	q := s.client.From("app_functions").
		Select("*").
		Order("created_at", false)

	if accountID != "" {
		q = q.Eq("account_id", accountID)
	}
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}

	err := q.Execute(ctx, &functions)
	return functions, err
}

// UpdateFunction updates an existing function.
func (s *SupabaseStore) UpdateFunction(ctx context.Context, fn *Function) error {
	fn.UpdatedAt = time.Now().UTC()
	return s.client.From("app_functions").
		Eq("id", fn.ID).
		Update(ctx, fn)
}

// DeleteFunction deletes a function by ID.
func (s *SupabaseStore) DeleteFunction(ctx context.Context, id string) error {
	return s.client.From("app_functions").
		Eq("id", id).
		Delete(ctx)
}

// ============================================================================
// Trigger Operations
// ============================================================================

// Trigger represents a function trigger.
type Trigger struct {
	ID         string          `json:"id"`
	FunctionID string          `json:"function_id"`
	Type       string          `json:"type"`
	Config     json.RawMessage `json:"config,omitempty"`
	Enabled    bool            `json:"enabled"`
	Tenant     string          `json:"tenant"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

// CreateTrigger creates a new trigger.
func (s *SupabaseStore) CreateTrigger(ctx context.Context, tr *Trigger) error {
	return s.client.From("app_triggers").Insert(ctx, tr)
}

// GetTrigger retrieves a trigger by ID.
func (s *SupabaseStore) GetTrigger(ctx context.Context, id string) (*Trigger, error) {
	var triggers []Trigger
	err := s.client.From("app_triggers").
		Select("*").
		Eq("id", id).
		Limit(1).
		Execute(ctx, &triggers)
	if err != nil {
		return nil, err
	}
	if len(triggers) == 0 {
		return nil, nil
	}
	return &triggers[0], nil
}

// ListTriggers lists triggers for a function.
func (s *SupabaseStore) ListTriggers(ctx context.Context, functionID string) ([]Trigger, error) {
	var triggers []Trigger
	q := s.client.From("app_triggers").
		Select("*").
		Order("created_at", false)

	if functionID != "" {
		q = q.Eq("function_id", functionID)
	}

	err := q.Execute(ctx, &triggers)
	return triggers, err
}

// UpdateTrigger updates an existing trigger.
func (s *SupabaseStore) UpdateTrigger(ctx context.Context, tr *Trigger) error {
	tr.UpdatedAt = time.Now().UTC()
	return s.client.From("app_triggers").
		Eq("id", tr.ID).
		Update(ctx, tr)
}

// DeleteTrigger deletes a trigger by ID.
func (s *SupabaseStore) DeleteTrigger(ctx context.Context, id string) error {
	return s.client.From("app_triggers").
		Eq("id", id).
		Delete(ctx)
}

// ============================================================================
// Secret Operations
// ============================================================================

// Secret represents an encrypted secret.
type Secret struct {
	ID        string    `json:"id"`
	AccountID string    `json:"account_id"`
	Name      string    `json:"name"`
	Value     string    `json:"value"` // Encrypted
	Tenant    string    `json:"tenant"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateSecret creates a new secret.
func (s *SupabaseStore) CreateSecret(ctx context.Context, sec *Secret) error {
	return s.client.From("app_secrets").Insert(ctx, sec)
}

// GetSecret retrieves a secret by name.
func (s *SupabaseStore) GetSecret(ctx context.Context, accountID, name string) (*Secret, error) {
	var secrets []Secret
	err := s.client.From("app_secrets").
		Select("*").
		Eq("account_id", accountID).
		Eq("name", name).
		Limit(1).
		Execute(ctx, &secrets)
	if err != nil {
		return nil, err
	}
	if len(secrets) == 0 {
		return nil, nil
	}
	return &secrets[0], nil
}

// ListSecrets lists secrets for an account (names only, not values).
func (s *SupabaseStore) ListSecrets(ctx context.Context, accountID string) ([]Secret, error) {
	var secrets []Secret
	err := s.client.From("app_secrets").
		Select("id,account_id,name,tenant,created_at,updated_at").
		Eq("account_id", accountID).
		Order("name", true).
		Execute(ctx, &secrets)
	return secrets, err
}

// DeleteSecret deletes a secret by name.
func (s *SupabaseStore) DeleteSecret(ctx context.Context, accountID, name string) error {
	return s.client.From("app_secrets").
		Eq("account_id", accountID).
		Eq("name", name).
		Delete(ctx)
}

// ============================================================================
// Generic Query Builder Access
// ============================================================================

// From returns a query builder for the specified table.
// This allows direct access to Supabase PostgREST for custom queries.
func (s *SupabaseStore) From(table string) *supabase.QueryBuilder {
	return s.client.From(table)
}

// Client returns the underlying Supabase client.
func (s *SupabaseStore) Client() *supabase.Client {
	return s.client
}

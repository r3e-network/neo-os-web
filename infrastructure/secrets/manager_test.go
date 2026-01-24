package secrets

import (
	"context"
	"errors"
	"testing"

	secretssupabase "github.com/R3E-Network/service_layer/infrastructure/secrets/supabase"
)

type fakeRepo struct {
	secret          *secretssupabase.Secret
	allowedServices []string
	lastAudit       *secretssupabase.AuditLog
}

func (f *fakeRepo) GetSecretByName(_ context.Context, _, _ string) (*secretssupabase.Secret, error) {
	return f.secret, nil
}

func (f *fakeRepo) GetAllowedServices(_ context.Context, _, _ string) ([]string, error) {
	return f.allowedServices, nil
}

func (f *fakeRepo) CreateAuditLog(_ context.Context, log *secretssupabase.AuditLog) error {
	f.lastAudit = log
	return nil
}

func TestServiceProviderDecryptsAllowedSecret(t *testing.T) {
	repo := &fakeRepo{allowedServices: []string{"neooracle"}}
	manager, err := NewManager(repo, []byte("aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"))
	if err != nil {
		t.Fatalf("NewManager error: %v", err)
	}

	encrypted, err := manager.encryptSecretValue("super-secret")
	if err != nil {
		t.Fatalf("encryptSecretValue error: %v", err)
	}
	repo.secret = &secretssupabase.Secret{UserID: "user-1", Name: "api_key", EncryptedValue: encrypted}

	provider := ServiceProvider{Manager: manager, ServiceID: "neooracle"}
	value, err := provider.GetSecret(context.Background(), "user-1", "api_key")
	if err != nil {
		t.Fatalf("GetSecret error: %v", err)
	}
	if value != "super-secret" {
		t.Fatalf("unexpected secret value: %s", value)
	}
	if repo.lastAudit == nil || !repo.lastAudit.Success {
		t.Fatalf("expected audit log for success")
	}
}

func TestServiceProviderRejectsUnauthorizedSecret(t *testing.T) {
	repo := &fakeRepo{allowedServices: []string{"neocompute"}}
	manager, err := NewManager(repo, []byte("aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"))
	if err != nil {
		t.Fatalf("NewManager error: %v", err)
	}
	encrypted, err := manager.encryptSecretValue("super-secret")
	if err != nil {
		t.Fatalf("encryptSecretValue error: %v", err)
	}
	repo.secret = &secretssupabase.Secret{UserID: "user-1", Name: "api_key", EncryptedValue: encrypted}

	provider := ServiceProvider{Manager: manager, ServiceID: "neooracle"}
	_, err = provider.GetSecret(context.Background(), "user-1", "api_key")
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got: %v", err)
	}
	if repo.lastAudit == nil || repo.lastAudit.Success {
		t.Fatalf("expected audit log for denial")
	}
}

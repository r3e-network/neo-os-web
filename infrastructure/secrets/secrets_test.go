package secrets

import (
	"context"
	"encoding/base64"
	"errors"
	"testing"
)

// mockRepo implements Repository for testing.
type mockRepo struct {
	data map[string][]byte
	err  error
}

func (m *mockRepo) GetEncryptedSecret(_ context.Context, userID, serviceID, secretName string) ([]byte, error) {
	if m.err != nil {
		return nil, m.err
	}
	key := userID + "/" + serviceID + "/" + secretName
	v, ok := m.data[key]
	if !ok {
		return nil, errors.New("not found")
	}
	return v, nil
}

func TestNewManager(t *testing.T) {
	m, err := NewManager(&mockRepo{}, []byte("test-key"))
	if err != nil {
		t.Fatalf("NewManager returned error: %v", err)
	}
	if m == nil {
		t.Fatal("NewManager returned nil manager")
	}
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	m, err := NewManager(&mockRepo{}, []byte("round-trip-key"))
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	plaintext := "super-secret-value"
	encrypted, err := m.Encrypt([]byte(plaintext))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	decrypted, err := m.decrypt([]byte(encrypted))
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if string(decrypted) != plaintext {
		t.Fatalf("got %q, want %q", decrypted, plaintext)
	}
}

func TestDecryptBase64Encoded(t *testing.T) {
	m, err := NewManager(&mockRepo{}, []byte("b64-key"))
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	encrypted, err := m.Encrypt([]byte("hello"))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	// Encrypt returns base64; verify it is valid base64
	if _, decErr := base64.StdEncoding.DecodeString(encrypted); decErr != nil {
		t.Fatalf("Encrypt output is not valid base64: %v", decErr)
	}

	// decrypt should handle the base64-encoded input
	got, err := m.decrypt([]byte(encrypted))
	if err != nil {
		t.Fatalf("decrypt base64: %v", err)
	}
	if string(got) != "hello" {
		t.Fatalf("got %q, want %q", got, "hello")
	}
}

func TestDecryptRawBytes(t *testing.T) {
	m, err := NewManager(&mockRepo{}, []byte("raw-key"))
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	encrypted, err := m.Encrypt([]byte("raw-test"))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	// Decode the base64 to get raw nonce+ciphertext bytes
	raw, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		t.Fatalf("base64 decode: %v", err)
	}

	// Feed raw bytes (not valid base64) — decrypt should fall back to raw
	got, err := m.decrypt(raw)
	if err != nil {
		t.Fatalf("decrypt raw: %v", err)
	}
	if string(got) != "raw-test" {
		t.Fatalf("got %q, want %q", got, "raw-test")
	}
}

func TestDecryptCiphertextTooShort(t *testing.T) {
	m, err := NewManager(&mockRepo{}, []byte("short-key"))
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	_, err = m.decrypt([]byte("short"))
	if err == nil {
		t.Fatal("expected error for short ciphertext, got nil")
	}
}

func TestGetSecret(t *testing.T) {
	repo := &mockRepo{data: make(map[string][]byte)}
	m, err := NewManager(repo, []byte("get-secret-key"))
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	encrypted, err := m.Encrypt([]byte("my-api-key"))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	repo.data["user1/svc1/api_key"] = []byte(encrypted)

	got, err := m.GetSecret(context.Background(), "user1", "svc1", "api_key")
	if err != nil {
		t.Fatalf("GetSecret: %v", err)
	}
	if got != "my-api-key" {
		t.Fatalf("got %q, want %q", got, "my-api-key")
	}
}

func TestGetSecretRepoError(t *testing.T) {
	repoErr := errors.New("db connection failed")
	repo := &mockRepo{err: repoErr}
	m, err := NewManager(repo, []byte("err-key"))
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	_, err = m.GetSecret(context.Background(), "u", "s", "n")
	if !errors.Is(err, repoErr) {
		t.Fatalf("expected repo error, got: %v", err)
	}
}

func TestServiceProviderDelegates(t *testing.T) {
	repo := &mockRepo{data: make(map[string][]byte)}
	m, err := NewManager(repo, []byte("sp-key"))
	if err != nil {
		t.Fatalf("NewManager: %v", err)
	}

	encrypted, err := m.Encrypt([]byte("delegated-secret"))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	repo.data["userA/my-service/token"] = []byte(encrypted)

	sp := ServiceProvider{Manager: m, ServiceID: "my-service"}

	// Verify it implements Provider
	var _ Provider = sp

	got, err := sp.GetSecret(context.Background(), "userA", "token")
	if err != nil {
		t.Fatalf("ServiceProvider.GetSecret: %v", err)
	}
	if got != "delegated-secret" {
		t.Fatalf("got %q, want %q", got, "delegated-secret")
	}
}

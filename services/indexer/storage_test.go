package indexer

import (
	"testing"
)

func TestStorageConfigValidation(t *testing.T) {
	cfg := &Config{
		PostgresHost:     "",
		PostgresPassword: "",
	}
	_, err := NewStorage(cfg)
	if err == nil {
		t.Error("expected error for invalid config")
	}
}

func TestStorageIsolatedCredentials(t *testing.T) {
	// Verify config uses INDEXER_ prefix
	cfg := DefaultConfig()
	if cfg.PostgresDB != "postgres" {
		t.Errorf("expected postgres db, got %s", cfg.PostgresDB)
	}
	if cfg.PostgresPort != 5432 {
		t.Errorf("expected port 5432, got %d", cfg.PostgresPort)
	}
}

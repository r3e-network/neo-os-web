package runtime

import (
	"testing"

	"github.com/R3E-Network/service_layer/internal/config"
)

func TestValidateSupabaseConfigRequiresGoTrue(t *testing.T) {
	cfg := config.New()
	cfg.Auth.SupabaseJWTSecret = "secret"
	cfg.Auth.SupabaseGoTrueURL = ""

	if err := validateSupabaseConfig(cfg); err == nil {
		t.Fatalf("expected error when supabase jwt secret is set without gotrue url")
	}

	cfg.Auth.SupabaseGoTrueURL = "http://localhost:9999"
	if err := validateSupabaseConfig(cfg); err != nil {
		t.Fatalf("expected config to be valid when gotrue url is set: %v", err)
	}
}

func TestValidateSupabaseConfigNoSecret(t *testing.T) {
	cfg := config.New()
	cfg.Auth.SupabaseJWTSecret = ""
	if err := validateSupabaseConfig(cfg); err != nil {
		t.Fatalf("expected nil error when supabase jwt secret is empty, got %v", err)
	}
}

package indexer

import (
	"os"
	"testing"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.PostgresPort != 5432 {
		t.Errorf("expected port 5432, got %d", cfg.PostgresPort)
	}
	if cfg.BatchSize != 100 {
		t.Errorf("expected batch 100, got %d", cfg.BatchSize)
	}
	if len(cfg.Networks) != 1 || cfg.Networks[0] != NetworkTestnet {
		t.Errorf("expected [testnet], got %v", cfg.Networks)
	}
}

func TestLoadFromEnv(t *testing.T) {
	os.Setenv("INDEXER_SUPABASE_URL", "https://test.supabase.co")
	os.Setenv("INDEXER_POSTGRES_HOST", "db.test.supabase.co")
	os.Setenv("INDEXER_POSTGRES_PASSWORD", "testpass")
	os.Setenv("INDEXER_NETWORKS", "both")
	defer func() {
		os.Unsetenv("INDEXER_SUPABASE_URL")
		os.Unsetenv("INDEXER_POSTGRES_HOST")
		os.Unsetenv("INDEXER_POSTGRES_PASSWORD")
		os.Unsetenv("INDEXER_NETWORKS")
	}()

	cfg, err := LoadFromEnv()
	if err != nil {
		t.Fatalf("LoadFromEnv failed: %v", err)
	}
	if cfg.SupabaseURL != "https://test.supabase.co" {
		t.Errorf("wrong supabase url: %s", cfg.SupabaseURL)
	}
	if len(cfg.Networks) != 2 {
		t.Errorf("expected 2 networks, got %d", len(cfg.Networks))
	}
}

func TestConfigValidate(t *testing.T) {
	tests := []struct {
		name    string
		cfg     *Config
		wantErr bool
	}{
		{"valid", &Config{PostgresHost: "h", PostgresPassword: "p", Networks: []Network{NetworkTestnet}, BatchSize: 100, Workers: 4}, false},
		{"both networks", &Config{PostgresHost: "h", PostgresPassword: "p", Networks: []Network{NetworkMainnet, NetworkTestnet}, BatchSize: 100, Workers: 4}, false},
		{"no host", &Config{Networks: []Network{NetworkTestnet}, BatchSize: 100, Workers: 4}, true},
		{"no networks", &Config{PostgresHost: "h", PostgresPassword: "p", Networks: []Network{}, BatchSize: 100, Workers: 4}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cfg.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestGetRPCURL(t *testing.T) {
	cfg := DefaultConfig()
	cfg.MainnetRPCURL = "https://mainnet.neo.org"
	cfg.TestnetRPCURL = "https://testnet.neo.org"

	if cfg.GetRPCURL(NetworkMainnet) != "https://mainnet.neo.org" {
		t.Error("wrong mainnet URL")
	}
	if cfg.GetRPCURL(NetworkTestnet) != "https://testnet.neo.org" {
		t.Error("wrong testnet URL")
	}
}

func TestParseNetworks(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{"both", 2},
		{"all", 2},
		{"mainnet", 1},
		{"testnet", 1},
		{"mainnet,testnet", 2},
	}
	for _, tt := range tests {
		networks := parseNetworks(tt.input)
		if len(networks) != tt.expected {
			t.Errorf("parseNetworks(%s) = %d networks, want %d", tt.input, len(networks), tt.expected)
		}
	}
}

package chains_test

import (
	"testing"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chains"
)

func TestChainConfigRejectsNonNeoTypes(t *testing.T) {
	cfg := &chains.Config{Chains: []chains.ChainConfig{
		{
			ID:      "evm-test",
			Name:    "EVM Test",
			Type:    chains.ChainType("evm"),
			RPCUrls: []string{"https://example.com"},
		},
	}}

	if err := cfg.Validate(); err == nil {
		t.Fatalf("expected error for non-neo chain type")
	}
}

package indexer

import (
	"testing"
)

func TestSyncerNetworkMagic(t *testing.T) {
	if getNetworkMagic(NetworkMainnet) != 860833102 {
		t.Error("wrong mainnet magic")
	}
	if getNetworkMagic(NetworkTestnet) != 894710606 {
		t.Error("wrong testnet magic")
	}
}

func TestSyncerConfig(t *testing.T) {
	cfg := DefaultConfig()
	cfg.PostgresHost = "localhost"
	cfg.PostgresPassword = "test"
	cfg.TestnetRPCURL = "https://testnet.neo.org"

	if cfg.GetRPCURL(NetworkTestnet) == "" {
		t.Error("RPC URL should not be empty")
	}
}

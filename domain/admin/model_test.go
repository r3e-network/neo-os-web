package admin

import (
	"testing"
	"time"
)

func TestChainRPCFields(t *testing.T) {
	now := time.Now()
	rpc := ChainRPC{
		ID:          "rpc-1",
		ChainID:     "eth",
		Name:        "Ethereum Mainnet",
		RPCURL:      "https://eth.example.com",
		WSURL:       "wss://eth.example.com/ws",
		ChainType:   "evm",
		NetworkID:   1,
		Priority:    1,
		Weight:      100,
		MaxRPS:      1000,
		Timeout:     5000,
		Enabled:     true,
		Healthy:     true,
		Metadata:    map[string]string{"tier": "premium"},
		CreatedAt:   now,
		UpdatedAt:   now,
		LastCheckAt: now,
	}

	if rpc.ID != "rpc-1" {
		t.Errorf("ID = %q, want 'rpc-1'", rpc.ID)
	}
	if rpc.ChainID != "eth" {
		t.Errorf("ChainID = %q, want 'eth'", rpc.ChainID)
	}
	if rpc.NetworkID != 1 {
		t.Errorf("NetworkID = %d, want 1", rpc.NetworkID)
	}
	if !rpc.Enabled {
		t.Error("Enabled should be true")
	}
	if !rpc.Healthy {
		t.Error("Healthy should be true")
	}
}

func TestDataProviderFields(t *testing.T) {
	now := time.Now()
	provider := DataProvider{
		ID:          "prov-1",
		Name:        "coingecko",
		Type:        "price_feed",
		BaseURL:     "https://api.coingecko.com",
		APIKey:      "encrypted-key",
		RateLimit:   60,
		Timeout:     3000,
		Retries:     3,
		Enabled:     true,
		Healthy:     true,
		Features:    []string{"prices", "market_cap"},
		Metadata:    map[string]string{"version": "v3"},
		CreatedAt:   now,
		UpdatedAt:   now,
		LastCheckAt: now,
	}

	if provider.ID != "prov-1" {
		t.Errorf("ID = %q, want 'prov-1'", provider.ID)
	}
	if provider.Name != "coingecko" {
		t.Errorf("Name = %q, want 'coingecko'", provider.Name)
	}
	if provider.RateLimit != 60 {
		t.Errorf("RateLimit = %d, want 60", provider.RateLimit)
	}
	if len(provider.Features) != 2 {
		t.Errorf("Features len = %d, want 2", len(provider.Features))
	}
}

func TestSystemSettingFields(t *testing.T) {
	now := time.Now()
	setting := SystemSetting{
		Key:         "max_functions",
		Value:       "100",
		Type:        "int",
		Category:    "limits",
		Description: "Maximum functions per account",
		Editable:    true,
		UpdatedAt:   now,
		UpdatedBy:   "admin",
	}

	if setting.Key != "max_functions" {
		t.Errorf("Key = %q, want 'max_functions'", setting.Key)
	}
	if setting.Type != "int" {
		t.Errorf("Type = %q, want 'int'", setting.Type)
	}
	if !setting.Editable {
		t.Error("Editable should be true")
	}
}

func TestFeatureFlagFields(t *testing.T) {
	now := time.Now()
	flag := FeatureFlag{
		Key:         "new_dashboard",
		Enabled:     true,
		Description: "Enable new dashboard UI",
		Rollout:     50,
		UpdatedAt:   now,
		UpdatedBy:   "admin",
	}

	if flag.Key != "new_dashboard" {
		t.Errorf("Key = %q, want 'new_dashboard'", flag.Key)
	}
	if !flag.Enabled {
		t.Error("Enabled should be true")
	}
	if flag.Rollout != 50 {
		t.Errorf("Rollout = %d, want 50", flag.Rollout)
	}
}

func TestTenantQuotaFields(t *testing.T) {
	now := time.Now()
	quota := TenantQuota{
		TenantID:     "tenant-1",
		MaxAccounts:  10,
		MaxFunctions: 100,
		MaxRPCPerMin: 1000,
		MaxStorage:   1073741824, // 1GB
		MaxGasPerDay: 100000000,
		Features:     []string{"vrf", "automation"},
		UpdatedAt:    now,
		UpdatedBy:    "admin",
	}

	if quota.TenantID != "tenant-1" {
		t.Errorf("TenantID = %q, want 'tenant-1'", quota.TenantID)
	}
	if quota.MaxAccounts != 10 {
		t.Errorf("MaxAccounts = %d, want 10", quota.MaxAccounts)
	}
	if quota.MaxStorage != 1073741824 {
		t.Errorf("MaxStorage = %d, want 1073741824", quota.MaxStorage)
	}
	if len(quota.Features) != 2 {
		t.Errorf("Features len = %d, want 2", len(quota.Features))
	}
}

func TestAllowedMethodFields(t *testing.T) {
	method := AllowedMethod{
		ChainID: "eth",
		Methods: []string{"eth_call", "eth_getBalance", "eth_blockNumber"},
	}

	if method.ChainID != "eth" {
		t.Errorf("ChainID = %q, want 'eth'", method.ChainID)
	}
	if len(method.Methods) != 3 {
		t.Errorf("Methods len = %d, want 3", len(method.Methods))
	}
}

package main

import (
	"encoding/hex"
	"log"
	"os"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/nitro"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/secrets"
	secretssupabase "github.com/r3e-network/neo-miniapp-platform/infrastructure/secrets/supabase"

	neoaccounts "github.com/r3e-network/neo-miniapp-platform/infrastructure/accountpool/nitro"
	globalsigner "github.com/r3e-network/neo-miniapp-platform/infrastructure/globalsigner/nitro"
	neoflow "github.com/r3e-network/neo-miniapp-platform/services/automation/nitro"
	neocompute "github.com/r3e-network/neo-miniapp-platform/services/confcompute/nitro"
	neooracle "github.com/r3e-network/neo-miniapp-platform/services/conforacle/nitro"
	neofeeds "github.com/r3e-network/neo-miniapp-platform/services/datafeed/nitro"
	neogasbank "github.com/r3e-network/neo-miniapp-platform/services/gasbank/nitro"
	neorequests "github.com/r3e-network/neo-miniapp-platform/services/requests/nitro"
	neosimulation "github.com/r3e-network/neo-miniapp-platform/services/simulation/nitro"
	txproxy "github.com/r3e-network/neo-miniapp-platform/services/txproxy/nitro"
	neovrf "github.com/r3e-network/neo-miniapp-platform/services/vrf/nitro"
)

func loadTEEPrivateKey(m *nitro.Nitro) string {
	if key := strings.TrimSpace(os.Getenv("TEE_PRIVATE_KEY")); key != "" {
		return trimHexPrefix(key)
	}
	if key := strings.TrimSpace(os.Getenv("TEE_WALLET_PRIVATE_KEY")); key != "" {
		return trimHexPrefix(key)
	}
	if secret, ok := m.Secret("TEE_PRIVATE_KEY"); ok && len(secret) > 0 {
		return hex.EncodeToString(secret)
	}
	if secret, ok := m.Secret("TEE_WALLET_PRIVATE_KEY"); ok && len(secret) > 0 {
		return hex.EncodeToString(secret)
	}
	return ""
}

func newServiceSecretsProvider(m *nitro.Nitro, db *database.Repository, serviceID string) secrets.Provider {
	if db == nil {
		return nil
	}

	var rawKey []byte
	if m != nil {
		if secret, ok := m.Secret(secrets.MasterKeyEnv); ok && len(secret) > 0 {
			rawKey = secret
		}
	}
	if len(rawKey) == 0 {
		rawKey = []byte(strings.TrimSpace(os.Getenv(secrets.MasterKeyEnv)))
	}

	if len(rawKey) == 0 {
		strict := runtime.StrictIdentityMode() || (m != nil && m.IsEnclave())
		if strict {
			log.Fatalf("CRITICAL: %s is required for %s secret access in strict/TEE mode", secrets.MasterKeyEnv, serviceID)
		}
		return nil
	}

	repo := secretssupabase.NewRepository(db)
	manager, err := secrets.NewManager(repo, rawKey)
	if err != nil {
		log.Fatalf("CRITICAL: initialize secrets manager for %s: %v", serviceID, err)
	}
	return secrets.ServiceProvider{Manager: manager, ServiceID: serviceID}
}

func newGlobalSigner(s *serviceContext) (ServiceRunner, error) {
	return globalsigner.New(globalsigner.Config{
		Nitro:      s.m,
		DB:         s.db,
		Repository: s.globalSignerRepo,
	})
}

func newNeoAccounts(s *serviceContext) (ServiceRunner, error) {
	svc, err := neoaccounts.New(neoaccounts.Config{
		Nitro:           s.m,
		DB:              s.db,
		NeoAccountsRepo: s.neoaccountsRepo,
		ChainClient:     s.chainClient,
	})
	return svc, err
}

func newNeoCompute(s *serviceContext) (ServiceRunner, error) {
	return neocompute.New(neocompute.Config{
		Nitro:          s.m,
		DB:             s.db,
		SecretProvider: newServiceSecretsProvider(s.m, s.db, neocompute.ServiceID),
	})
}

func newNeoFeeds(s *serviceContext) (ServiceRunner, error) {
	svc, err := neofeeds.New(neofeeds.Config{
		Nitro:           s.m,
		DB:              s.db,
		ArbitrumRPC:     s.arbitrumRPC,
		ChainClient:     s.chainClient,
		PriceFeedHash:   s.priceFeedHash,
		TxProxy:         s.txProxyInvoker,
		EnableChainPush: s.enableChainPush,
		GasBank:         s.gasbankClient,
	})
	return svc, err
}

func newNeoFlow(s *serviceContext) (ServiceRunner, error) {
	svc, err := neoflow.New(neoflow.Config{
		Nitro:                s.m,
		DB:                   s.db,
		NeoFlowRepo:          s.neoflowRepo,
		ChainClient:          s.chainClient,
		PriceFeedHash:        s.priceFeedHash,
		AutomationAnchorHash: s.automationAnchorHash,
		TxProxy:              s.txProxyInvoker,
		EventListener:        s.eventListener,
		EnableChainExec:      s.enableChainExec,
		GasBank:              s.gasbankClient,
	})
	return svc, err
}

func newNeoOracle(s *serviceContext) (ServiceRunner, error) {
	oracleAllowlistRaw := strings.TrimSpace(os.Getenv("ORACLE_HTTP_ALLOWLIST"))
	oracleAllowlist := neooracle.URLAllowlist{Prefixes: splitAndTrimCSV(oracleAllowlistRaw)}
	if len(oracleAllowlist.Prefixes) == 0 {
		if runtime.StrictIdentityMode() || s.m.IsEnclave() {
			log.Fatalf("CRITICAL: ORACLE_HTTP_ALLOWLIST is required for NeoOracle in strict identity/TEE mode")
		}
		log.Printf("Warning: ORACLE_HTTP_ALLOWLIST not set; allowing all outbound URLs (development/testing only)")
	}

	oracleTimeout := time.Duration(0)
	if raw := strings.TrimSpace(os.Getenv("ORACLE_TIMEOUT")); raw != "" {
		if parsed, parseErr := time.ParseDuration(raw); parseErr != nil || parsed <= 0 {
			log.Printf("Warning: invalid ORACLE_TIMEOUT %q: %v", raw, parseErr)
		} else {
			oracleTimeout = parsed
		}
	}

	oracleMaxBodyBytes := int64(0)
	if raw := strings.TrimSpace(os.Getenv("ORACLE_MAX_SIZE")); raw != "" {
		if parsed, parseErr := parseByteSize(raw); parseErr != nil || parsed <= 0 {
			log.Printf("Warning: invalid ORACLE_MAX_SIZE %q: %v", raw, parseErr)
		} else {
			oracleMaxBodyBytes = parsed
		}
	}

	return neooracle.New(neooracle.Config{
		Nitro:          s.m,
		SecretProvider: newServiceSecretsProvider(s.m, s.db, neooracle.ServiceID),
		Timeout:        oracleTimeout,
		MaxBodyBytes:   oracleMaxBodyBytes,
		URLAllowlist:   oracleAllowlist,
	})
}

func newNeoRequests(s *serviceContext) (ServiceRunner, error) {
	return neorequests.New(neorequests.Config{
		Nitro:              s.m,
		DB:                 s.db,
		RequestsRepo:       s.neorequestsRepo,
		EventListener:      s.eventListener,
		TxProxy:            s.txProxyInvoker,
		ChainClient:        s.chainClient,
		ServiceGatewayHash: s.serviceGatewayHash,
		AppRegistryHash:    s.appRegistryHash,
		PaymentHubHash:     s.paymentHubHash,
		NeoVRFURL:          s.neovrfURL,
		NeoOracleURL:       s.neooracleURL,
		NeoComputeURL:      s.neocomputeURL,
		HTTPClient:         s.m.HTTPClient(),
		ChainID:            s.chainID,
	})
}

func newNeoVRF(s *serviceContext) (ServiceRunner, error) {
	return neovrf.New(neovrf.Config{
		Nitro: s.m,
		DB:    s.db,
	})
}

func newNeoGasBank(s *serviceContext) (ServiceRunner, error) {
	return neogasbank.New(neogasbank.Config{
		Nitro:       s.m,
		DB:          s.db,
		ChainClient: s.chainClient,
	})
}

func newNeoSimulation(s *serviceContext) (ServiceRunner, error) {
	accountPoolURL := strings.TrimSpace(os.Getenv("NEOACCOUNTS_SERVICE_URL"))
	if accountPoolURL == "" {
		accountPoolURL = "https://neoaccounts:8085"
	}
	return neosimulation.New(neosimulation.Config{
		Nitro:          s.m,
		DB:             s.db,
		ChainClient:    s.chainClient,
		AccountPoolURL: accountPoolURL,
		AutoStart:      strings.ToLower(os.Getenv("SIMULATION_ENABLED")) == "true",
	})
}

func newTxProxy(s *serviceContext) (ServiceRunner, error) {
	return txproxy.New(txproxy.Config{
		Nitro:       s.m,
		DB:          s.db,
		ChainClient: s.chainClient,
		Signer:      s.teeSigner,
	})
}

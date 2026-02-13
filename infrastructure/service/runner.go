package service

import (
	"context"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/config"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	gasbankclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/gasbank/client"
	gsclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/globalsigner/client"
	sllogging "github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/marble"
	slmetrics "github.com/R3E-Network/neo-miniapps-platform/infrastructure/metrics"
	slmiddleware "github.com/R3E-Network/neo-miniapps-platform/infrastructure/middleware"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/runtime"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/secrets"
	secretssupabase "github.com/R3E-Network/neo-miniapps-platform/infrastructure/secrets/supabase"
	txproxyclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/txproxy/client"
	txproxytypes "github.com/R3E-Network/neo-miniapps-platform/infrastructure/txproxy/types"
)

// Runner is the interface each marble service must implement.
// All services satisfy this via *commonservice.BaseService embedding.
type Runner interface {
	Start(ctx context.Context) error
	Stop() error
	Router() *mux.Router
}

// Factory creates a Runner from shared dependencies.
type Factory func(deps *SharedDeps) (Runner, error)

// EventStartBlockFn is an optional callback that returns a custom start block
// for the event listener. Used by services like neorequests that persist a
// cursor in the database. The runner passes the initialized DB so the callback
// can query persisted state. Return (block, true) to override, or (0, false)
// to fall back to the default (current chain height - 1).
type EventStartBlockFn func(ctx context.Context, db *database.Repository, chainID string) (uint64, bool)

// RunOption configures optional Run behavior.
type RunOption func(*runConfig)

type runConfig struct {
	eventStartBlockFn EventStartBlockFn
}

// WithEventStartBlock sets a callback to resolve the event listener start block.
func WithEventStartBlock(fn EventStartBlockFn) RunOption {
	return func(cfg *runConfig) { cfg.eventStartBlockFn = fn }
}

// Run is the unified marble entry point. It initializes all shared
// infrastructure (marble, DB, chain, TEE signer, event listener, txproxy,
// gasbank), selects the service factory by MARBLE_TYPE, applies standard
// middleware, starts the HTTP server, and handles graceful shutdown.
func Run(factories map[string]Factory, opts ...RunOption) {
	var rc runConfig
	for _, o := range opts {
		o(&rc)
	}
	ctx := context.Background()

	availableServices := make([]string, 0, len(factories))
	for name := range factories {
		availableServices = append(availableServices, name)
	}

	// --- Resolve service type ---
	serviceType := os.Getenv("MARBLE_TYPE")
	if serviceType == "" {
		serviceType = os.Getenv("SERVICE_TYPE")
	}
	if serviceType == "" {
		log.Fatalf("MARBLE_TYPE environment variable required. Available services: %v", availableServices)
	}

	log.Printf("Available services: %v", availableServices)
	log.Printf("Starting %s service...", serviceType)

	factory, ok := factories[serviceType]
	if !ok {
		log.Fatalf("Unknown service: %s. Available: %v", serviceType, availableServices)
	}

	// --- Services configuration ---
	servicesCfg := config.LoadServicesConfigOrDefault()
	if !servicesCfg.IsEnabled(serviceType) {
		log.Printf("Service %s is disabled in configuration, exiting gracefully", serviceType)
		os.Exit(0)
	}

	// --- Marble ---
	m, err := marble.New(marble.Config{MarbleType: serviceType})
	if err != nil {
		log.Fatalf("Failed to create marble: %v", err)
	}
	if initErr := m.Initialize(ctx); initErr != nil {
		log.Fatalf("Failed to initialize marble: %v", initErr)
	}
	if (runtime.StrictIdentityMode() || m.IsEnclave()) && m.TLSConfig() == nil {
		log.Fatalf("CRITICAL: MarbleRun TLS credentials are required in production/SGX mode (missing MARBLE_CERT/MARBLE_KEY/MARBLE_ROOT_CA)")
	}

	// --- Database ---
	supabaseURL := config.EnvOrSecret(m, "SUPABASE_URL", "")
	supabaseServiceKey := config.EnvOrSecret(m, "SUPABASE_SERVICE_KEY", "")
	dbClient, err := database.NewClient(database.Config{
		URL:        supabaseURL,
		ServiceKey: supabaseServiceKey,
	})
	if err != nil {
		log.Fatalf("Failed to create database client: %v", err)
	}
	db := database.NewRepository(dbClient)

	// --- Chain ---
	chainClient, chainID, chainMeta := initChain(m)
	contracts := resolveContracts(chainMeta)

	paymentHubAddress := resolveAddress(contracts.PaymentHub, m, "CONTRACT_PAYMENT_HUB_ADDRESS")
	priceFeedAddress := resolveAddress(contracts.PriceFeed, m, "CONTRACT_PRICE_FEED_ADDRESS")
	automationAnchorAddr := resolveAddress(contracts.AutomationAnchor, m, "CONTRACT_AUTOMATION_ANCHOR_ADDRESS")
	appRegistryAddress := resolveAddress(contracts.AppRegistry, m, "CONTRACT_APP_REGISTRY_ADDRESS")
	serviceGatewayAddr := resolveAddress(contracts.ServiceLayerGateway, m, "CONTRACT_SERVICE_GATEWAY_ADDRESS")

	// --- TEE Signer ---
	teeSigner := initTEESigner(ctx, m, serviceType, chainClient)

	// --- Event Listener ---
	eventListener := initEventListener(ctx, serviceType, chainClient, chainID, db,
		paymentHubAddress, priceFeedAddress, automationAnchorAddr, appRegistryAddress, serviceGatewayAddr,
		rc.eventStartBlockFn)

	// --- TxProxy ---
	txProxyInvoker := initTxProxy(m, serviceType)

	enableChainPush := chainClient != nil && priceFeedAddress != "" && txProxyInvoker != nil
	enableChainExec := chainClient != nil && automationAnchorAddr != "" && txProxyInvoker != nil

	// --- GasBank ---
	gasbankClient := initGasBank(m, serviceType)

	// --- Build SharedDeps ---
	deps := &SharedDeps{
		ServiceType:          serviceType,
		Marble:               m,
		DB:                   db,
		ChainClient:          chainClient,
		ChainID:              chainID,
		ChainMeta:            chainMeta,
		Contracts:            contracts,
		TEESigner:            teeSigner,
		EventListener:        eventListener,
		TxProxy:              txProxyInvoker,
		GasBank:              gasbankClient,
		ServicesCfg:          servicesCfg,
		Logger:               sllogging.NewFromEnv(serviceType),
		PaymentHubAddress:    paymentHubAddress,
		PriceFeedAddress:     priceFeedAddress,
		AutomationAnchorAddr: automationAnchorAddr,
		AppRegistryAddress:   appRegistryAddress,
		ServiceGatewayAddr:   serviceGatewayAddr,
		EnableChainPush:      enableChainPush,
		EnableChainExec:      enableChainExec,
		NeoVRFURL:            config.EnvOrSecret(m, "NEOVRF_URL", ""),
		NeoOracleURL:         config.EnvOrSecret(m, "NEOORACLE_URL", ""),
		NeoComputeURL:        config.EnvOrSecret(m, "NEOCOMPUTE_URL", ""),
		ArbitrumRPC:          strings.TrimSpace(os.Getenv("ARBITRUM_RPC")),
	}

	// --- Create service ---
	svc, err := factory(deps)
	if err != nil {
		log.Fatalf("Failed to create service: %v", err)
	}

	// --- Middleware ---
	applyMiddleware(svc, serviceType, deps.Logger)

	// --- Start ---
	if err := svc.Start(ctx); err != nil {
		log.Fatalf("Failed to start service: %v", err)
	}

	// --- HTTP server ---
	port := resolvePort(serviceType, servicesCfg)
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           svc.Router(),
		TLSConfig:         m.TLSConfig(),
		ReadTimeout:       30 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		log.Printf("%s service listening on port %s", serviceType, port)
		var listenErr error
		if m.TLSConfig() != nil {
			listenErr = server.ListenAndServeTLS("", "")
		} else {
			listenErr = server.ListenAndServe()
		}
		if listenErr != nil && listenErr != http.ErrServerClosed {
			log.Fatalf("Server error: %v", listenErr)
		}
	}()

	// --- Graceful shutdown ---
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("Shutting down...")
	shutdownCtx, shutdownCancel := context.WithTimeout(ctx, 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}
	if err := svc.Stop(); err != nil {
		log.Printf("Service stop error: %v", err)
	}
	log.Println("Service stopped")
}

// NewServiceSecretsProvider creates a secrets.Provider for a given service.
// Exported so service factories can use it.
func NewServiceSecretsProvider(m *marble.Marble, db *database.Repository, serviceID string) secrets.Provider {
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
			log.Fatalf("CRITICAL: %s is required for %s secret access in production/SGX mode", secrets.MasterKeyEnv, serviceID)
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

// =============================================================================
// Internal helpers
// =============================================================================

func initChain(m *marble.Marble) (*chain.Client, string, *chain.ChainConfig) {
	neoRPCURLs := chain.ParseEndpoints(config.EnvOrSecret(m, "NEO_RPC_URLS", ""))
	if len(neoRPCURLs) == 0 && os.Getenv("NEO_RPC_URLS") != "" {
		neoRPCURLs = chain.ParseEndpoints(os.Getenv("NEO_RPC_URLS"))
	}

	neoRPCURL := config.EnvOrSecret(m, "NEO_RPC_URL", "")
	if neoRPCURL == "" && len(neoRPCURLs) > 0 {
		neoRPCURL = neoRPCURLs[0]
	}

	var networkMagic uint32
	if magicStr := strings.TrimSpace(os.Getenv("NEO_NETWORK_MAGIC")); magicStr != "" {
		if magic, parseErr := strconv.ParseUint(magicStr, 10, 32); parseErr != nil {
			log.Printf("Warning: invalid NEO_NETWORK_MAGIC %q: %v", magicStr, parseErr)
		} else {
			networkMagic = uint32(magic)
		}
	}

	chainID := strings.TrimSpace(os.Getenv("CHAIN_ID"))
	var chainMeta *chain.ChainConfig
	if chainID == "" || networkMagic != 0 {
		if cfg, cfgErr := chain.LoadChainsConfig(); cfgErr == nil {
			if networkMagic != 0 {
				for i := range cfg.Chains {
					chainInfo := cfg.Chains[i]
					if chainInfo.Type == chain.ChainTypeNeoN3 && chainInfo.NetworkMagic == networkMagic {
						chainID = chainInfo.ID
						chainMeta = &cfg.Chains[i]
						break
					}
				}
			}
			if chainID == "" {
				for i := range cfg.Chains {
					chainInfo := cfg.Chains[i]
					if chainInfo.Type == chain.ChainTypeNeoN3 {
						chainID = chainInfo.ID
						chainMeta = &cfg.Chains[i]
						break
					}
				}
			}
			if chainMeta == nil && chainID != "" {
				if found, ok := cfg.GetChain(chainID); ok {
					chainMeta = found
				}
			}
		}
	}
	if chainID == "" {
		if networkMagic != 0 {
			chainID = fmt.Sprintf("neo-n3:%d", networkMagic)
		} else {
			chainID = "neo-n3-mainnet"
		}
	}
	if chainMeta != nil && chainMeta.Type == chain.ChainTypeNeoN3 {
		if networkMagic == 0 && chainMeta.NetworkMagic != 0 {
			networkMagic = chainMeta.NetworkMagic
		}
		if len(neoRPCURLs) == 0 && len(chainMeta.RPCUrls) > 0 {
			neoRPCURLs = chainMeta.RPCUrls
		}
		if neoRPCURL == "" && len(neoRPCURLs) > 0 {
			neoRPCURL = neoRPCURLs[0]
		}
	}

	var chainClient *chain.Client
	if neoRPCURL == "" {
		log.Printf("Warning: NEO_RPC_URL not set; chain integration disabled")
	} else if client, clientErr := chain.NewClient(chain.Config{
		RPCURL:     neoRPCURL,
		NetworkID:  networkMagic,
		HTTPClient: m.ExternalHTTPClient(),
	}); clientErr != nil {
		log.Printf("Warning: failed to initialize chain client: %v", clientErr)
	} else {
		chainClient = client
	}

	return chainClient, chainID, chainMeta
}

func resolveContracts(chainMeta *chain.ChainConfig) chain.ContractAddresses {
	contracts := chain.ContractAddressesFromEnv()
	if chainMeta != nil {
		if v := chainMeta.Contract("payment_hub"); v != "" {
			contracts.PaymentHub = v
		}
		if v := chainMeta.Contract("governance"); v != "" {
			contracts.Governance = v
		}
		if v := chainMeta.Contract("price_feed"); v != "" {
			contracts.PriceFeed = v
		}
		if v := chainMeta.Contract("randomness_log"); v != "" {
			contracts.RandomnessLog = v
		}
		if v := chainMeta.Contract("app_registry"); v != "" {
			contracts.AppRegistry = v
		}
		if v := chainMeta.Contract("automation_anchor"); v != "" {
			contracts.AutomationAnchor = v
		}
		if v := chainMeta.Contract("service_gateway"); v != "" {
			contracts.ServiceLayerGateway = v
		}
	}
	return contracts
}

func resolveAddress(contractValue string, m *marble.Marble, envKey string) string {
	addr := trimHexPrefix(contractValue)
	if addr == "" {
		addr = trimHexPrefix(config.EnvOrSecret(m, envKey, ""))
	}
	return addr
}

// trimHexPrefix removes optional "0x"/"0X" prefix and surrounding whitespace from a hex string.
func trimHexPrefix(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "0x")
	s = strings.TrimPrefix(s, "0X")
	return s
}

func initTEESigner(ctx context.Context, m *marble.Marble, serviceType string, chainClient *chain.Client) chain.TEESigner {
	var teeSigner chain.TEESigner

	globalSignerURL := strings.TrimSpace(os.Getenv("GLOBALSIGNER_SERVICE_URL"))
	if globalSignerURL != "" && serviceType != "globalsigner" {
		gsHTTPClient, gsErr := gsclient.New(gsclient.Config{
			BaseURL:    globalSignerURL,
			ServiceID:  serviceType,
			HTTPClient: m.HTTPClient(),
			Timeout:    15 * time.Second,
		})
		if gsErr != nil {
			log.Printf("Warning: failed to create GlobalSigner client: %v", gsErr)
		} else if gsSigner, signerErr := chain.NewGlobalSignerSigner(ctx, gsHTTPClient); signerErr != nil {
			log.Printf("Warning: failed to initialize GlobalSigner signer: %v", signerErr)
		} else {
			teeSigner = gsSigner
			log.Printf("Using GlobalSigner for TEE signing (%s)", globalSignerURL)
		}
	}

	if teeSigner == nil {
		teePrivateKey := loadTEEPrivateKey(m)
		if chainClient != nil && teePrivateKey == "" {
			log.Printf("Warning: TEE signer not configured (missing GLOBALSIGNER_SERVICE_URL and TEE_PRIVATE_KEY); chain fulfillments disabled")
		}
		if teePrivateKey != "" {
			if localSigner, signerErr := chain.NewLocalTEESignerFromPrivateKeyHex(teePrivateKey); signerErr != nil {
				log.Printf("Warning: failed to create local TEE signer: %v", signerErr)
			} else {
				teeSigner = localSigner
			}
		}
	}

	return teeSigner
}

func loadTEEPrivateKey(m *marble.Marble) string {
	if m != nil {
		if secret, ok := m.Secret("TEE_PRIVATE_KEY"); ok && len(secret) > 0 {
			secretStr := strings.TrimSpace(string(secret))
			if secretStr != "" && (secretStr[0] == 'K' || secretStr[0] == 'L' || secretStr[0] == '5') {
				return secretStr
			}
			if len(secretStr) == 64 || len(secretStr) == 66 {
				return trimHexPrefix(secretStr)
			}
			return hex.EncodeToString(secret)
		}
		if secret, ok := m.Secret("TEE_WALLET_PRIVATE_KEY"); ok && len(secret) > 0 {
			secretStr := strings.TrimSpace(string(secret))
			if secretStr != "" && (secretStr[0] == 'K' || secretStr[0] == 'L' || secretStr[0] == '5') {
				return secretStr
			}
			if len(secretStr) == 64 || len(secretStr) == 66 {
				return trimHexPrefix(secretStr)
			}
			return hex.EncodeToString(secret)
		}
	}
	if key := strings.TrimSpace(os.Getenv("TEE_PRIVATE_KEY")); key != "" {
		return trimHexPrefix(key)
	}
	if key := strings.TrimSpace(os.Getenv("TEE_WALLET_PRIVATE_KEY")); key != "" {
		return trimHexPrefix(key)
	}
	return ""
}

func initEventListener(ctx context.Context, serviceType string, chainClient *chain.Client, chainID string, db *database.Repository,
	paymentHub, priceFeed, automationAnchor, appRegistry, serviceGateway string,
	startBlockFn EventStartBlockFn) *chain.EventListener {
	if chainClient == nil {
		return nil
	}

	startBlock := uint64(0)
	startBlockSet := false
	if raw := strings.TrimSpace(os.Getenv("NEO_EVENT_START_BLOCK")); raw != "" {
		if parsed, parseErr := strconv.ParseUint(raw, 10, 64); parseErr == nil {
			startBlock = parsed
			startBlockSet = true
		} else {
			log.Printf("Warning: invalid NEO_EVENT_START_BLOCK %q: %v", raw, parseErr)
		}
	}
	// Allow callers (e.g. neorequests) to supply a persisted cursor.
	if !startBlockSet && startBlockFn != nil {
		if block, ok := startBlockFn(ctx, db, chainID); ok {
			startBlock = block
			startBlockSet = true
		}
	}
	if !startBlockSet {
		if height, heightErr := chainClient.GetBlockCount(ctx); heightErr == nil && height > 0 {
			startBlock = height - 1
		}
	}

	backfill := uint64(0)
	if raw := strings.TrimSpace(os.Getenv("NEO_EVENT_BACKFILL_BLOCKS")); raw != "" {
		if parsed, parseErr := strconv.ParseUint(raw, 10, 64); parseErr == nil {
			backfill = parsed
		} else {
			log.Printf("Warning: invalid NEO_EVENT_BACKFILL_BLOCKS %q: %v", raw, parseErr)
		}
	}
	if backfill > 0 {
		if startBlock > backfill {
			startBlock -= backfill
		} else {
			startBlock = 0
		}
	}

	confirmations := uint64(0)
	if raw := strings.TrimSpace(os.Getenv("NEO_EVENT_CONFIRMATIONS")); raw != "" {
		if parsed, parseErr := strconv.ParseUint(raw, 10, 64); parseErr == nil {
			confirmations = parsed
		} else {
			log.Printf("Warning: invalid NEO_EVENT_CONFIRMATIONS %q: %v", raw, parseErr)
		}
	}

	listenAll := false
	if raw := strings.TrimSpace(os.Getenv("NEO_EVENT_LISTEN_ALL")); raw != "" {
		switch strings.ToLower(raw) {
		case "1", "true", "yes", "y", "on":
			listenAll = true
		}
	} else if serviceType == "neorequests" {
		listenAll = true
	}
	if serviceType == "neorequests" && !listenAll {
		log.Printf("Warning: NEO_EVENT_LISTEN_ALL is false; MiniApp notifications/metrics may not be indexed")
	}

	listenerContracts := chain.ContractAddresses{
		PaymentHub:          paymentHub,
		PriceFeed:           priceFeed,
		AutomationAnchor:    automationAnchor,
		AppRegistry:         appRegistry,
		ServiceLayerGateway: serviceGateway,
	}
	if listenAll {
		listenerContracts = chain.ContractAddresses{}
	}

	return chain.NewEventListener(&chain.ListenerConfig{
		Client:        chainClient,
		Contracts:     listenerContracts,
		StartBlock:    startBlock,
		PollInterval:  5 * time.Second,
		Confirmations: confirmations,
	})
}

func initTxProxy(m *marble.Marble, serviceType string) txproxytypes.Invoker {
	txproxyURL := config.EnvOrSecret(m, "TXPROXY_URL", "")

	txproxyTimeout := 30 * time.Second
	txproxyTimeoutSet := false
	if raw := strings.TrimSpace(os.Getenv("TXPROXY_TIMEOUT")); raw != "" {
		if parsed, parseErr := time.ParseDuration(raw); parseErr != nil || parsed <= 0 {
			log.Printf("Warning: invalid TXPROXY_TIMEOUT %q: %v", raw, parseErr)
		} else {
			txproxyTimeout = parsed
			txproxyTimeoutSet = true
		}
	}
	if !txproxyTimeoutSet && serviceType == "neorequests" {
		if raw := strings.TrimSpace(os.Getenv("NEOREQUESTS_TX_WAIT")); raw != "" && strings.EqualFold(raw, "true") {
			txproxyTimeout = 90 * time.Second
		}
	}

	if txproxyURL == "" || serviceType == "txproxy" {
		return nil
	}

	txClient, txErr := txproxyclient.New(txproxyclient.Config{
		BaseURL:    txproxyURL,
		ServiceID:  serviceType,
		HTTPClient: m.HTTPClient(),
		Timeout:    txproxyTimeout,
	})
	if txErr != nil {
		log.Printf("Warning: failed to create TxProxy client: %v", txErr)
		return nil
	}
	log.Printf("Using TxProxy for chain writes (%s)", txproxyURL)
	return txClient
}

func initGasBank(m *marble.Marble, serviceType string) *gasbankclient.Client {
	gasbankURL := config.EnvOrSecret(m, "GASBANK_URL", "")
	if gasbankURL == "" || serviceType == "neogasbank" {
		return nil
	}

	gbClient, gbErr := gasbankclient.New(gasbankclient.Config{
		BaseURL:    gasbankURL,
		HTTPClient: m.HTTPClient(),
	})
	if gbErr != nil {
		log.Printf("Warning: failed to create GasBank client: %v", gbErr)
		return nil
	}
	log.Printf("Using GasBank for service fee deduction (%s)", gasbankURL)
	return gbClient
}

func applyMiddleware(svc Runner, serviceType string, logger *sllogging.Logger) {
	svc.Router().Use(slmiddleware.LoggingMiddleware(logger))
	svc.Router().Use(slmiddleware.NewRecoveryMiddleware(logger).Handler)
	if slmetrics.Enabled() {
		metricsCollector := slmetrics.Init(serviceType)
		svc.Router().Use(slmiddleware.MetricsMiddleware(serviceType, metricsCollector))
		svc.Router().Handle("/metrics", promhttp.Handler()).Methods(http.MethodGet)
	}
	svc.Router().Use(slmiddleware.NewBodyLimitMiddleware(0).Handler)
}

func resolvePort(serviceType string, servicesCfg *config.ServicesConfig) string {
	port := os.Getenv("PORT")
	if port == "" {
		if settings := servicesCfg.GetSettings(serviceType); settings != nil && settings.Port > 0 {
			port = fmt.Sprintf("%d", settings.Port)
		} else {
			port = "8080"
		}
	}
	return port
}

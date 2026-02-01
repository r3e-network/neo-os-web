// Package main provides the generic Marble entry point for all Neo services.
// The service type is determined by the MARBLE_TYPE environment variable.
// Each service is a separate Marble in MarbleRun, running in its own TEE enclave.
package main

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
	chaincfg "github.com/R3E-Network/neo-miniapps-platform/infrastructure/chains"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/config"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	gasbankclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/gasbank/client"
	slhex "github.com/R3E-Network/neo-miniapps-platform/infrastructure/hex"
	sllogging "github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/marble"
	slmetrics "github.com/R3E-Network/neo-miniapps-platform/infrastructure/metrics"
	slmiddleware "github.com/R3E-Network/neo-miniapps-platform/infrastructure/middleware"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/runtime"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/secrets"
	secretssupabase "github.com/R3E-Network/neo-miniapps-platform/infrastructure/secrets/supabase"
	txproxyclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/txproxy/client"
	txproxytypes "github.com/R3E-Network/neo-miniapps-platform/infrastructure/txproxy/types"

	// Neo service imports
	neoaccounts "github.com/R3E-Network/neo-miniapps-platform/infrastructure/accountpool/marble"
	neoaccountssupabase "github.com/R3E-Network/neo-miniapps-platform/infrastructure/accountpool/supabase"
	gsclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/globalsigner/client"
	globalsigner "github.com/R3E-Network/neo-miniapps-platform/infrastructure/globalsigner/marble"
	globalsignersupabase "github.com/R3E-Network/neo-miniapps-platform/infrastructure/globalsigner/supabase"
	neoflow "github.com/R3E-Network/neo-miniapps-platform/services/automation/marble"
	neoflowsupabase "github.com/R3E-Network/neo-miniapps-platform/services/automation/supabase"
	neocompute "github.com/R3E-Network/neo-miniapps-platform/services/confcompute/marble"
	neooracle "github.com/R3E-Network/neo-miniapps-platform/services/conforacle/marble"
	neofeeds "github.com/R3E-Network/neo-miniapps-platform/services/datafeed/marble"
	neogasbank "github.com/R3E-Network/neo-miniapps-platform/services/gasbank/marble"
	neorequests "github.com/R3E-Network/neo-miniapps-platform/services/requests/marble"
	neorequestsupabase "github.com/R3E-Network/neo-miniapps-platform/services/requests/supabase"
	neosimulation "github.com/R3E-Network/neo-miniapps-platform/services/simulation/marble"
	txproxy "github.com/R3E-Network/neo-miniapps-platform/services/txproxy/marble"
	neovrf "github.com/R3E-Network/neo-miniapps-platform/services/vrf/marble"
)

// ServiceRunner interface for all Neo services
type ServiceRunner interface {
	Start(ctx context.Context) error
	Stop() error
	Router() *mux.Router
}

// Available Neo services
var availableServices = []string{
	"globalsigner",
	"neoaccounts",
	"neocompute",
	"neofeeds",
	"neoflow",
	"neogasbank",
	"neooracle",
	"neorequests",
	"neosimulation",
	"neovrf",
	"txproxy",
}

func main() {
	ctx := context.Background()

	// Get service type from environment (injected by MarbleRun manifest)
	serviceType := os.Getenv("MARBLE_TYPE")
	if serviceType == "" {
		serviceType = os.Getenv("SERVICE_TYPE") // Fallback for local testing
	}
	if serviceType == "" {
		log.Fatalf("MARBLE_TYPE environment variable required. Available services: %v", availableServices)
	}

	log.Printf("Available services: %v", availableServices)
	log.Printf("Starting %s service...", serviceType)

	// Load services configuration
	servicesCfg := config.LoadServicesConfigOrDefault()

	// Check if service is enabled in config
	if !servicesCfg.IsEnabled(serviceType) {
		log.Printf("Service %s is disabled in configuration, exiting gracefully", serviceType)
		os.Exit(0) // Graceful exit for disabled services
	}

	// Initialize Marble
	m, err := marble.New(marble.Config{
		MarbleType: serviceType,
	})
	if err != nil {
		log.Fatalf("Failed to create marble: %v", err)
	}

	// Initialize Marble with Coordinator
	if initErr := m.Initialize(ctx); initErr != nil {
		log.Fatalf("Failed to initialize marble: %v", initErr)
	}

	// In production/SGX mode, require MarbleRun-injected mTLS credentials.
	// This ensures service-to-service identity headers can be trusted and prevents
	// accidentally deploying plaintext HTTP within the mesh.
	if (runtime.StrictIdentityMode() || m.IsEnclave()) && m.TLSConfig() == nil {
		log.Fatalf("CRITICAL: MarbleRun TLS credentials are required in production/SGX mode (missing MARBLE_CERT/MARBLE_KEY/MARBLE_ROOT_CA)")
	}

	// Initialize database
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

	// Initialize repositories
	globalSignerRepo := globalsignersupabase.NewRepository(db)
	neoaccountsRepo := neoaccountssupabase.NewRepository(db)
	neoflowRepo := neoflowsupabase.NewRepository(db)
	neorequestsRepo := neorequestsupabase.NewRepository(db)

	// Chain configuration
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
	var chainMeta *chaincfg.ChainConfig
	if chainID == "" || networkMagic != 0 {
		if cfg, cfgErr := chaincfg.LoadConfig(); cfgErr == nil {
			if networkMagic != 0 {
				for i := range cfg.Chains {
					chainInfo := cfg.Chains[i]
					if chainInfo.Type == chaincfg.ChainTypeNeoN3 && chainInfo.NetworkMagic == networkMagic {
						chainID = chainInfo.ID
						chainMeta = &cfg.Chains[i]
						break
					}
				}
			}
			if chainID == "" {
				for i := range cfg.Chains {
					chainInfo := cfg.Chains[i]
					if chainInfo.Type == chaincfg.ChainTypeNeoN3 {
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
	if chainMeta != nil && chainMeta.Type == chaincfg.ChainTypeNeoN3 {
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
	} else if client, clientErr := chain.NewClient(chain.Config{RPCURL: neoRPCURL, NetworkID: networkMagic, HTTPClient: m.ExternalHTTPClient()}); clientErr != nil {
		log.Printf("Warning: failed to initialize chain client: %v", clientErr)
	} else {
		chainClient = client
	}

	contracts := chain.ContractAddressesFromEnv()
	if chainMeta != nil {
		if value := chainMeta.Contract("payment_hub"); value != "" {
			contracts.PaymentHub = value
		}
		if value := chainMeta.Contract("governance"); value != "" {
			contracts.Governance = value
		}
		if value := chainMeta.Contract("price_feed"); value != "" {
			contracts.PriceFeed = value
		}
		if value := chainMeta.Contract("randomness_log"); value != "" {
			contracts.RandomnessLog = value
		}
		if value := chainMeta.Contract("app_registry"); value != "" {
			contracts.AppRegistry = value
		}
		if value := chainMeta.Contract("automation_anchor"); value != "" {
			contracts.AutomationAnchor = value
		}
		if value := chainMeta.Contract("service_gateway"); value != "" {
			contracts.ServiceLayerGateway = value
		}
	}

	paymentHubAddress := slhex.TrimPrefix(contracts.PaymentHub)
	if paymentHubAddress == "" {
		paymentHubAddress = slhex.TrimPrefix(config.EnvOrSecret(m, "CONTRACT_PAYMENT_HUB_ADDRESS", ""))
	}

	priceFeedAddress := slhex.TrimPrefix(contracts.PriceFeed)
	if priceFeedAddress == "" {
		priceFeedAddress = slhex.TrimPrefix(config.EnvOrSecret(m, "CONTRACT_PRICE_FEED_ADDRESS", ""))
	}

	automationAnchorAddress := slhex.TrimPrefix(contracts.AutomationAnchor)
	if automationAnchorAddress == "" {
		automationAnchorAddress = slhex.TrimPrefix(config.EnvOrSecret(m, "CONTRACT_AUTOMATION_ANCHOR_ADDRESS", ""))
	}

	appRegistryAddress := slhex.TrimPrefix(contracts.AppRegistry)
	if appRegistryAddress == "" {
		appRegistryAddress = slhex.TrimPrefix(config.EnvOrSecret(m, "CONTRACT_APP_REGISTRY_ADDRESS", ""))
	}

	serviceGatewayAddress := slhex.TrimPrefix(contracts.ServiceLayerGateway)
	if serviceGatewayAddress == "" {
		serviceGatewayAddress = slhex.TrimPrefix(config.EnvOrSecret(m, "CONTRACT_SERVICE_GATEWAY_ADDRESS", ""))
	}

	var teeSigner chain.TEESigner

	// Prefer GlobalSigner for TEE signing to avoid distributing long-lived private keys
	// to every enclave service. This keeps the active TEE signing key in one place.
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

	// Fallback to a locally injected private key (development/testing or transitional).
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

	var eventListener *chain.EventListener
	if chainClient != nil {
		startBlock := uint64(0)
		startBlockSet := false
		if raw := strings.TrimSpace(os.Getenv("NEO_EVENT_START_BLOCK")); raw != "" {
			if parsed, parseErr := strconv.ParseUint(raw, 10, 64); parseErr == nil {
				startBlock = parsed
				startBlockSet = true
			} else {
				log.Printf("Warning: invalid NEO_EVENT_START_BLOCK %q: %v", raw, parseErr)
			}
		} else if serviceType == "neorequests" && neorequestsRepo != nil && chainID != "" {
			latest, ok, blockErr := neorequestsRepo.LatestProcessedBlock(ctx, chainID)
			if blockErr != nil {
				log.Printf("Warning: failed to read processed event cursor: %v", blockErr)
			} else if ok {
				startBlock = latest
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
			// NeoRequests needs to ingest MiniApp events for notifications/metrics.
			listenAll = true
		}
		if serviceType == "neorequests" && !listenAll {
			log.Printf("Warning: NEO_EVENT_LISTEN_ALL is false; MiniApp notifications/metrics may not be indexed")
		}

		contracts := chain.ContractAddresses{
			PaymentHub:          paymentHubAddress,
			PriceFeed:           priceFeedAddress,
			AutomationAnchor:    automationAnchorAddress,
			AppRegistry:         appRegistryAddress,
			ServiceLayerGateway: serviceGatewayAddress,
		}
		if listenAll {
			contracts = chain.ContractAddresses{}
		}

		eventListener = chain.NewEventListener(&chain.ListenerConfig{
			Client:        chainClient,
			Contracts:     contracts,
			StartBlock:    startBlock,
			PollInterval:  5 * time.Second,
			Confirmations: confirmations,
		})
	}

	arbitrumRPC := strings.TrimSpace(os.Getenv("ARBITRUM_RPC"))

	neovrfURL := config.EnvOrSecret(m, "NEOVRF_URL", "")
	neooracleURL := config.EnvOrSecret(m, "NEOORACLE_URL", "")
	neocomputeURL := config.EnvOrSecret(m, "NEOCOMPUTE_URL", "")

	// TxProxy is the centralized "sign + broadcast" gatekeeper. NeoFeeds/NeoFlow
	// delegate all on-chain writes to it (single allowlist + audit surface).
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

	var txProxyInvoker txproxytypes.Invoker
	if txproxyURL != "" && serviceType != "txproxy" {
		txClient, txErr := txproxyclient.New(txproxyclient.Config{
			BaseURL:    txproxyURL,
			ServiceID:  serviceType,
			HTTPClient: m.HTTPClient(),
			Timeout:    txproxyTimeout,
		})
		if txErr != nil {
			log.Printf("Warning: failed to create TxProxy client: %v", txErr)
		} else {
			txProxyInvoker = txClient
			log.Printf("Using TxProxy for chain writes (%s)", txproxyURL)
		}
	}

	enablePriceFeedPush := chainClient != nil && priceFeedAddress != "" && txProxyInvoker != nil
	enableChainPush := enablePriceFeedPush
	enableChainExec := chainClient != nil && automationAnchorAddress != "" && txProxyInvoker != nil

	// GasBank client for service fee deduction
	gasbankURL := config.EnvOrSecret(m, "GASBANK_URL", "")

	var gasbankClient *gasbankclient.Client
	if gasbankURL != "" && serviceType != "neogasbank" {
		gbClient, gbErr := gasbankclient.New(gasbankclient.Config{
			BaseURL:    gasbankURL,
			HTTPClient: m.HTTPClient(),
		})
		if gbErr != nil {
			log.Printf("Warning: failed to create GasBank client: %v", gbErr)
		} else {
			gasbankClient = gbClient
			log.Printf("Using GasBank for service fee deduction (%s)", gasbankURL)
		}
	}

	var svc ServiceRunner
	switch serviceType {
	case "globalsigner":
		svc, err = globalsigner.New(globalsigner.Config{
			Marble:     m,
			DB:         db,
			Repository: globalSignerRepo,
		})
	case "neoaccounts":
		var accountsSvc *neoaccounts.Service
		accountsSvc, err = neoaccounts.New(neoaccounts.Config{
			Marble:          m,
			DB:              db,
			NeoAccountsRepo: neoaccountsRepo,
			ChainClient:     chainClient,
		})
		svc = accountsSvc
	case "neocompute":
		svc, err = neocompute.New(neocompute.Config{
			Marble:         m,
			DB:             db,
			SecretProvider: newServiceSecretsProvider(m, db, neocompute.ServiceID),
		})
	case "neofeeds":
		var feedsSvc *neofeeds.Service
		feedsSvc, err = neofeeds.New(neofeeds.Config{
			Marble:           m,
			DB:               db,
			ArbitrumRPC:      arbitrumRPC,
			ChainClient:      chainClient,
			PriceFeedAddress: priceFeedAddress,
			TxProxy:          txProxyInvoker,
			EnableChainPush:  enableChainPush,
			GasBank:          gasbankClient,
		})
		svc = feedsSvc
	case "neoflow":
		var flowSvc *neoflow.Service
		flowSvc, err = neoflow.New(neoflow.Config{
			Marble:                  m,
			DB:                      db,
			NeoFlowRepo:             neoflowRepo,
			ChainClient:             chainClient,
			PriceFeedAddress:        priceFeedAddress,
			AutomationAnchorAddress: automationAnchorAddress,
			TxProxy:                 txProxyInvoker,
			EventListener:           eventListener,
			EnableChainExec:         enableChainExec,
			GasBank:                 gasbankClient,
		})
		svc = flowSvc
	case "neooracle":
		oracleAllowlistRaw := strings.TrimSpace(os.Getenv("ORACLE_HTTP_ALLOWLIST"))
		oracleAllowlist := neooracle.URLAllowlist{Prefixes: config.SplitAndTrimCSV(oracleAllowlistRaw)}
		if len(oracleAllowlist.Prefixes) == 0 {
			if runtime.StrictIdentityMode() || m.IsEnclave() {
				log.Fatalf("CRITICAL: ORACLE_HTTP_ALLOWLIST is required for NeoOracle in strict identity/SGX mode")
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
			if parsed, parseErr := config.ParseByteSize(raw); parseErr != nil || parsed <= 0 {
				log.Printf("Warning: invalid ORACLE_MAX_SIZE %q: %v", raw, parseErr)
			} else {
				oracleMaxBodyBytes = parsed
			}
		}

		svc, err = neooracle.New(neooracle.Config{
			Marble:         m,
			SecretProvider: newServiceSecretsProvider(m, db, neooracle.ServiceID),
			Timeout:        oracleTimeout,
			MaxBodyBytes:   oracleMaxBodyBytes,
			URLAllowlist:   oracleAllowlist,
		})
	case "neorequests":
		svc, err = neorequests.New(neorequests.Config{
			Marble:                m,
			DB:                    db,
			RequestsRepo:          neorequestsRepo,
			EventListener:         eventListener,
			TxProxy:               txProxyInvoker,
			ChainClient:           chainClient,
			ServiceGatewayAddress: serviceGatewayAddress,
			AppRegistryAddress:    appRegistryAddress,
			PaymentHubAddress:     paymentHubAddress,
			NeoVRFURL:             neovrfURL,
			NeoOracleURL:          neooracleURL,
			NeoComputeURL:         neocomputeURL,
			HTTPClient:            m.HTTPClient(),
			ChainID:               chainID,
		})
	case "neovrf":
		svc, err = neovrf.New(neovrf.Config{
			Marble: m,
			DB:     db,
		})
	case "neogasbank":
		svc, err = neogasbank.New(neogasbank.Config{
			Marble:      m,
			DB:          db,
			ChainClient: chainClient,
		})
	case "neosimulation":
		// Get account pool URL for simulation
		accountPoolURL := strings.TrimSpace(os.Getenv("NEOACCOUNTS_SERVICE_URL"))
		if accountPoolURL == "" {
			accountPoolURL = "https://neoaccounts:8085"
		}
		svc, err = neosimulation.New(neosimulation.Config{
			Marble:         m,
			DB:             db,
			ChainClient:    chainClient,
			AccountPoolURL: accountPoolURL,
			AutoStart:      strings.ToLower(os.Getenv("SIMULATION_ENABLED")) == "true",
		})
	case "txproxy":
		svc, err = txproxy.New(txproxy.Config{
			Marble:      m,
			DB:          db,
			ChainClient: chainClient,
			Signer:      teeSigner,
		})
	default:
		log.Fatalf("Unknown service: %s. Available: %v", serviceType, availableServices)
	}
	if err != nil {
		log.Fatalf("Failed to create service: %v", err)
	}

	// Standard middleware applied to all services.
	// - Logging: ensures X-Trace-ID is present and logs structured request entries.
	// - Recovery: prevents panics from crashing the process.
	logger := sllogging.NewFromEnv(serviceType)
	svc.Router().Use(slmiddleware.LoggingMiddleware(logger))
	svc.Router().Use(slmiddleware.NewRecoveryMiddleware(logger).Handler)
	if slmetrics.Enabled() {
		metricsCollector := slmetrics.Init(serviceType)
		svc.Router().Use(slmiddleware.MetricsMiddleware(serviceType, metricsCollector))
		svc.Router().Handle("/metrics", promhttp.Handler()).Methods(http.MethodGet)
	}
	// Cap request bodies to reduce memory/CPU DoS risk. Services are typically
	// accessed via the gateway, but this also protects internal mesh calls.
	svc.Router().Use(slmiddleware.NewBodyLimitMiddleware(0).Handler)

	// Start service
	if err := svc.Start(ctx); err != nil {
		log.Fatalf("Failed to start service: %v", err)
	}

	// Get port from config or environment
	port := os.Getenv("PORT")
	if port == "" {
		if settings := servicesCfg.GetSettings(serviceType); settings != nil && settings.Port > 0 {
			port = fmt.Sprintf("%d", settings.Port)
		} else {
			port = "8080"
		}
	}

	// Create HTTP server
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           svc.Router(),
		TLSConfig:         m.TLSConfig(),
		ReadTimeout:       30 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
	}

	// Start server
	go func() {
		log.Printf("%s service listening on port %s", serviceType, port)
		var err error
		if m.TLSConfig() != nil {
			err = server.ListenAndServeTLS("", "")
		} else {
			err = server.ListenAndServe()
		}
		if err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for shutdown signal
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

func loadTEEPrivateKey(m *marble.Marble) string {
	// SECURITY: Prefer Marble secrets over environment variables
	// Marble secrets are injected securely by MarbleRun Coordinator
	if m != nil {
		if secret, ok := m.Secret("TEE_PRIVATE_KEY"); ok && len(secret) > 0 {
			// Check if it's already hex-encoded string or raw bytes
			secretStr := strings.TrimSpace(string(secret))
			if secretStr != "" && (secretStr[0] == 'K' || secretStr[0] == 'L' || secretStr[0] == '5') {
				// WIF format - return as-is
				return secretStr
			}
			// Check if it looks like hex string
			if len(secretStr) == 64 || len(secretStr) == 66 {
				return slhex.TrimPrefix(secretStr)
			}
			// Raw bytes - encode to hex
			return hex.EncodeToString(secret)
		}
		if secret, ok := m.Secret("TEE_WALLET_PRIVATE_KEY"); ok && len(secret) > 0 {
			secretStr := strings.TrimSpace(string(secret))
			if secretStr != "" && (secretStr[0] == 'K' || secretStr[0] == 'L' || secretStr[0] == '5') {
				return secretStr
			}
			if len(secretStr) == 64 || len(secretStr) == 66 {
				return slhex.TrimPrefix(secretStr)
			}
			return hex.EncodeToString(secret)
		}
	}
	// Fallback to environment variables for development/simulation mode only
	// WARNING: This should only be used in non-production environments
	if key := strings.TrimSpace(os.Getenv("TEE_PRIVATE_KEY")); key != "" {
		return slhex.TrimPrefix(key)
	}
	if key := strings.TrimSpace(os.Getenv("TEE_WALLET_PRIVATE_KEY")); key != "" {
		return slhex.TrimPrefix(key)
	}
	return ""
}

func newServiceSecretsProvider(m *marble.Marble, db *database.Repository, serviceID string) secrets.Provider {
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

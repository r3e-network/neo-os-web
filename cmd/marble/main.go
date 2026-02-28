// Package main provides the generic Marble entry point for all Neo services.
// The service type is determined by the MARBLE_TYPE environment variable.
// Each service is a separate Marble in MarbleRun, running in its own TEE enclave.
package main

import (
	"context"
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

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/config"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	gasbankclient "github.com/r3e-network/neo-miniapp-platform/infrastructure/gasbank/client"
	sllogging "github.com/r3e-network/neo-miniapp-platform/infrastructure/logging"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/marble"
	slmetrics "github.com/r3e-network/neo-miniapp-platform/infrastructure/metrics"
	slmiddleware "github.com/r3e-network/neo-miniapp-platform/infrastructure/middleware"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
	txproxyclient "github.com/r3e-network/neo-miniapp-platform/infrastructure/txproxy/client"
	txproxytypes "github.com/r3e-network/neo-miniapp-platform/infrastructure/txproxy/types"

	neoaccountssupabase "github.com/r3e-network/neo-miniapp-platform/infrastructure/accountpool/supabase"
	gsclient "github.com/r3e-network/neo-miniapp-platform/infrastructure/globalsigner/client"
	globalsignersupabase "github.com/r3e-network/neo-miniapp-platform/infrastructure/globalsigner/supabase"
	neoflowsupabase "github.com/r3e-network/neo-miniapp-platform/services/automation/supabase"
	neorequestsupabase "github.com/r3e-network/neo-miniapp-platform/services/requests/supabase"
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
	"neoprivacy",
	"neorequests",
	"neosimulation",
	"neovrf",
	"txproxy",
}

func main() {
	ctx := context.Background()

	// Get service type from environment (injected by MarbleRun manifest)
	serviceType := strings.TrimSpace(os.Getenv("MARBLE_TYPE"))
	if serviceType == "" {
		serviceType = strings.TrimSpace(os.Getenv("SERVICE_TYPE")) // Fallback for local testing
	}
	if serviceType == "" {
		log.Fatalf("MARBLE_TYPE environment variable required. Available services: %v", availableServices)
	}
	if !isAvailableService(serviceType) {
		log.Fatalf("Unknown MARBLE_TYPE %q. Available services: %v", serviceType, availableServices)
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
	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	if secret, ok := m.Secret("SUPABASE_URL"); ok && len(secret) > 0 {
		supabaseURL = strings.TrimSpace(string(secret))
	}
	supabaseServiceKey := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_KEY"))
	if secret, ok := m.Secret("SUPABASE_SERVICE_KEY"); ok && len(secret) > 0 {
		supabaseServiceKey = strings.TrimSpace(string(secret))
	}

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
	neoRPCURLs := chain.ParseEndpoints(strings.TrimSpace(os.Getenv("NEO_RPC_URLS")))
	if len(neoRPCURLs) == 0 {
		if secret, ok := m.Secret("NEO_RPC_URLS"); ok && len(secret) > 0 {
			neoRPCURLs = chain.ParseEndpoints(strings.TrimSpace(string(secret)))
		}
	}

	neoRPCURL := strings.TrimSpace(os.Getenv("NEO_RPC_URL"))
	if neoRPCURL == "" {
		if secret, ok := m.Secret("NEO_RPC_URL"); ok && len(secret) > 0 {
			neoRPCURL = strings.TrimSpace(string(secret))
		}
	}
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

	chainID := ""
	if networkMagic != 0 {
		chainID = fmt.Sprintf("neo-n3:%d", networkMagic)
	}
	if chainID == "" {
		chainID = "neo-n3"
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

	paymentHubHash := trimHexPrefix(contracts.PaymentHub)
	if paymentHubHash == "" {
		if secret, ok := m.Secret("CONTRACT_PAYMENTHUB_HASH"); ok && len(secret) > 0 {
			paymentHubHash = trimHexPrefix(string(secret))
		} else if secret, ok := m.Secret("CONTRACT_PAYMENT_HUB_HASH"); ok && len(secret) > 0 {
			paymentHubHash = trimHexPrefix(string(secret))
		}
	}

	priceFeedHash := trimHexPrefix(contracts.PriceFeed)
	if priceFeedHash == "" {
		if secret, ok := m.Secret("CONTRACT_PRICEFEED_HASH"); ok && len(secret) > 0 {
			priceFeedHash = trimHexPrefix(string(secret))
		} else if secret, ok := m.Secret("CONTRACT_PRICE_FEED_HASH"); ok && len(secret) > 0 {
			priceFeedHash = trimHexPrefix(string(secret))
		}
	}

	automationAnchorHash := trimHexPrefix(contracts.AutomationAnchor)
	if automationAnchorHash == "" {
		if secret, ok := m.Secret("CONTRACT_AUTOMATIONANCHOR_HASH"); ok && len(secret) > 0 {
			automationAnchorHash = trimHexPrefix(string(secret))
		} else if secret, ok := m.Secret("CONTRACT_AUTOMATION_ANCHOR_HASH"); ok && len(secret) > 0 {
			automationAnchorHash = trimHexPrefix(string(secret))
		}
	}

	appRegistryHash := trimHexPrefix(contracts.AppRegistry)
	if appRegistryHash == "" {
		if secret, ok := m.Secret("CONTRACT_APPREGISTRY_HASH"); ok && len(secret) > 0 {
			appRegistryHash = trimHexPrefix(string(secret))
		} else if secret, ok := m.Secret("CONTRACT_APP_REGISTRY_HASH"); ok && len(secret) > 0 {
			appRegistryHash = trimHexPrefix(string(secret))
		}
	}

	serviceGatewayHash := trimHexPrefix(contracts.ServiceLayerGateway)
	if serviceGatewayHash == "" {
		if secret, ok := m.Secret("CONTRACT_SERVICEGATEWAY_HASH"); ok && len(secret) > 0 {
			serviceGatewayHash = trimHexPrefix(string(secret))
		} else if secret, ok := m.Secret("CONTRACT_SERVICE_GATEWAY_HASH"); ok && len(secret) > 0 {
			serviceGatewayHash = trimHexPrefix(string(secret))
		}
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
			latest, ok, latestErr := neorequestsRepo.LatestProcessedBlock(ctx, chainID)
			if latestErr != nil {
				log.Printf("Warning: failed to read processed event cursor: %v", latestErr)
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
			PaymentHub:          paymentHubHash,
			PriceFeed:           priceFeedHash,
			AutomationAnchor:    automationAnchorHash,
			AppRegistry:         appRegistryHash,
			ServiceLayerGateway: serviceGatewayHash,
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

	neovrfURL := strings.TrimSpace(os.Getenv("NEOVRF_URL"))
	if neovrfURL == "" {
		if secret, ok := m.Secret("NEOVRF_URL"); ok && len(secret) > 0 {
			neovrfURL = strings.TrimSpace(string(secret))
		}
	}

	neooracleURL := strings.TrimSpace(os.Getenv("NEOORACLE_URL"))
	if neooracleURL == "" {
		if secret, ok := m.Secret("NEOORACLE_URL"); ok && len(secret) > 0 {
			neooracleURL = strings.TrimSpace(string(secret))
		}
	}

	neocomputeURL := strings.TrimSpace(os.Getenv("NEOCOMPUTE_URL"))
	if neocomputeURL == "" {
		if secret, ok := m.Secret("NEOCOMPUTE_URL"); ok && len(secret) > 0 {
			neocomputeURL = strings.TrimSpace(string(secret))
		}
	}

	// TxProxy is the centralized "sign + broadcast" gatekeeper. NeoFeeds/NeoFlow
	// delegate all on-chain writes to it (single allowlist + audit surface).
	txproxyURL := strings.TrimSpace(os.Getenv("TXPROXY_URL"))
	if txproxyURL == "" {
		if secret, ok := m.Secret("TXPROXY_URL"); ok && len(secret) > 0 {
			txproxyURL = strings.TrimSpace(string(secret))
		}
	}

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

	enablePriceFeedPush := chainClient != nil && priceFeedHash != "" && txProxyInvoker != nil
	enableChainPush := enablePriceFeedPush
	enableChainExec := chainClient != nil && automationAnchorHash != "" && txProxyInvoker != nil

	// GasBank client for service fee deduction
	gasbankURL := strings.TrimSpace(os.Getenv("GASBANK_URL"))
	if gasbankURL == "" {
		if secret, ok := m.Secret("GASBANK_URL"); ok && len(secret) > 0 {
			gasbankURL = strings.TrimSpace(string(secret))
		}
	}

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
	sctx := &serviceContext{
		m:                    m,
		db:                   db,
		globalSignerRepo:     globalSignerRepo,
		neoaccountsRepo:      neoaccountsRepo,
		neoflowRepo:          neoflowRepo,
		neorequestsRepo:      neorequestsRepo,
		chainClient:          chainClient,
		teeSigner:            teeSigner,
		eventListener:        eventListener,
		txProxyInvoker:       txProxyInvoker,
		gasbankClient:        gasbankClient,
		arbitrumRPC:          arbitrumRPC,
		priceFeedHash:        priceFeedHash,
		automationAnchorHash: automationAnchorHash,
		appRegistryHash:      appRegistryHash,
		serviceGatewayHash:   serviceGatewayHash,
		paymentHubHash:       paymentHubHash,
		enableChainPush:      enableChainPush,
		enableChainExec:      enableChainExec,
		neovrfURL:            neovrfURL,
		neooracleURL:         neooracleURL,
		neocomputeURL:        neocomputeURL,
		chainID:              chainID,
	}

	switch serviceType {
	case "globalsigner":
		svc, err = newGlobalSigner(sctx)
	case "neoaccounts":
		svc, err = newNeoAccounts(sctx)
	case "neocompute":
		svc, err = newNeoCompute(sctx)
	case "neofeeds":
		svc, err = newNeoFeeds(sctx)
	case "neoflow":
		svc, err = newNeoFlow(sctx)
	case "neooracle":
		svc, err = newNeoOracle(sctx)
	case "neorequests":
		svc, err = newNeoRequests(sctx)
	case "neovrf":
		svc, err = newNeoVRF(sctx)
	case "neogasbank":
		svc, err = newNeoGasBank(sctx)
	case "neosimulation":
		svc, err = newNeoSimulation(sctx)
	case "neoprivacy":
		svc, err = newNeoPrivacy(sctx)
	case "txproxy":
		svc, err = newTxProxy(sctx)
	default:
		log.Fatalf("Unknown service: %s. Available: %v", serviceType, availableServices)
	}
	if err != nil {
		log.Fatalf("Failed to create service: %v", err)
	}

	// Standard middleware applied to all services (outermost first).
	// - Recovery: outermost to catch panics from any middleware or handler.
	// - Logging: ensures X-Trace-ID is present and logs structured request entries.
	logger := sllogging.NewFromEnv(serviceType)
	svc.Router().Use(slmiddleware.NewRecoveryMiddleware(logger).Handler)
	svc.Router().Use(slmiddleware.LoggingMiddleware(logger))
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

	stopDone := make(chan error, 1)
	go func() { stopDone <- svc.Stop() }()
	select {
	case err := <-stopDone:
		if err != nil {
			log.Printf("Service stop error: %v", err)
		}
	case <-shutdownCtx.Done():
		log.Println("Service stop timed out")
	}

	log.Println("Service stopped")
}

// serviceContext aggregates shared dependencies for service factory functions.
type serviceContext struct {
	m                    *marble.Marble
	db                   *database.Repository
	globalSignerRepo     globalsignersupabase.Repository
	neoaccountsRepo      *neoaccountssupabase.Repository
	neoflowRepo          *neoflowsupabase.Repository
	neorequestsRepo      *neorequestsupabase.Repository
	chainClient          *chain.Client
	teeSigner            chain.TEESigner
	eventListener        *chain.EventListener
	txProxyInvoker       txproxytypes.Invoker
	gasbankClient        *gasbankclient.Client
	arbitrumRPC          string
	priceFeedHash        string
	automationAnchorHash string
	appRegistryHash      string
	serviceGatewayHash   string
	paymentHubHash       string
	enableChainPush      bool
	enableChainExec      bool
	neovrfURL            string
	neooracleURL         string
	neocomputeURL        string
	chainID              string
}

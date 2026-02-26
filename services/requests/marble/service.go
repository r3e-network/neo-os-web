// Package neorequests provides on-chain service request dispatch.
package neorequests

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/marble"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
	commonservice "github.com/r3e-network/neo-miniapp-platform/infrastructure/service"
	txproxytypes "github.com/r3e-network/neo-miniapp-platform/infrastructure/txproxy/types"
	neorequestsupabase "github.com/r3e-network/neo-miniapp-platform/services/requests/supabase"
)

const (
	ServiceID   = "neorequests"
	ServiceName = "NeoRequests Service"
	Version     = "1.0.0"

	// Neo notifications are capped at 1024 bytes. Keep a safe default
	// to avoid callback failures when ServiceLayerGateway emits events.
	defaultMaxResultBytes       = 800
	defaultMaxErrorLen          = 256
	defaultRequestIndexTTL      = time.Hour
	defaultServiceTimeout       = 20 * time.Second
	defaultPreValidationTimeout = 8 * time.Second
)

// Config holds NeoRequests service configuration.
type Config struct {
	Marble *marble.Marble
	DB     database.RepositoryInterface

	RequestsRepo  neorequestsupabase.RepositoryInterface
	EventListener *chain.EventListener
	TxProxy       txproxytypes.Invoker
	ChainClient   *chain.Client

	ServiceGatewayHash string
	AppRegistryHash    string
	PaymentHubHash     string
	NeoVRFURL          string
	NeoOracleURL       string
	NeoComputeURL      string
	ScriptsBaseURL     string // Base URL for loading TEE scripts (e.g., https://cdn.miniapps.r3e.network)

	HTTPClient     *http.Client
	ChainID        string
	MaxResultBytes int
	MaxErrorLen    int
	RNGResultMode  string
	TxWait         bool

	EnforceAppRegistry      bool
	RequireManifestContract bool
	AppRegistryCacheSeconds int
	StatsRollupInterval     time.Duration
	OnchainUsage            bool
	OnchainTxUsage          bool
	RequestIndexTTL         time.Duration
	ServiceTimeout          time.Duration
	PreValidationTimeout    time.Duration
}

// Service implements the NeoRequests service.
type Service struct {
	*commonservice.BaseService

	repo                    neorequestsupabase.RepositoryInterface
	eventListener           *chain.EventListener
	txProxy                 txproxytypes.Invoker
	serviceGatewayHash      string
	appRegistryHash         string
	appRegistry             *chain.AppRegistryContract
	chainClient             *chain.Client
	enforceAppRegistry      bool
	paymentHubHash          string
	appRegistryCache        map[string]appRegistryCacheEntry
	appRegistryMu           sync.RWMutex
	appRegistryTTL          time.Duration
	miniAppCache            map[string]miniAppCacheEntry
	miniAppCacheMu          sync.RWMutex
	miniAppCacheTTL         time.Duration
	requireManifestContract bool

	httpClient  *http.Client
	vrfURL      string
	oracleURL   string
	computeURL  string
	scriptsURL  string // Base URL for loading TEE scripts from app manifests
	chainID     string
	txWait      bool
	maxResult   int
	maxErrorLen int
	rngMode     string

	statsRollupInterval time.Duration
	statsRollupDisabled bool
	onchainUsage        bool
	onchainTxUsage      bool

	requestIndex         sync.Map
	requestIndexTTL      time.Duration
	serviceTimeout       time.Duration
	preValidationTimeout time.Duration

	listenerMu     sync.Mutex
	listenerCtx    context.Context
	listenerCancel context.CancelFunc
}

// resolveContractHash resolves a contract hash from the config value, then
// falls back to environment variables and marble secrets in order.
func resolveContractHash(cfgValue string, m *marble.Marble, envKeys ...string) string {
	if h := normalizeContractHash(cfgValue); h != "" {
		return h
	}
	for _, key := range envKeys {
		if h := normalizeContractHash(os.Getenv(key)); h != "" {
			return h
		}
	}
	for _, key := range envKeys {
		if secret, ok := m.Secret(key); ok && len(secret) > 0 {
			if h := normalizeContractHash(string(secret)); h != "" {
				return h
			}
		}
	}
	return ""
}

// resolveHTTPClient returns an HTTP client from the config, falling back to
// the marble client or a default. It disables redirects when no explicit
// client was provided to prevent SSRF via redirect chains.
func resolveHTTPClient(cfg *Config) *http.Client {
	if cfg.HTTPClient != nil {
		return cfg.HTTPClient
	}
	c := cfg.Marble.HTTPClient()
	if c == nil {
		c = &http.Client{Timeout: 30 * time.Second}
	}
	c.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	return c
}

// resolvedConfig holds all values resolved from Config + env vars + secrets.
type resolvedConfig struct {
	serviceGatewayHash      string
	appRegistryHash         string
	paymentHubHash          string
	maxResult               int
	maxErrorLen             int
	rngMode                 string
	chainID                 string
	txWait                  bool
	statsRollupInterval     time.Duration
	onchainUsage            bool
	onchainTxUsage          bool
	enforceAppRegistry      bool
	requireManifestContract bool
	requestIndexTTL         time.Duration
	serviceTimeout          time.Duration
	preValidationTimeout    time.Duration
	cacheSeconds            int
}

// resolveConfig resolves all configuration values from the Config struct,
// environment variables, and marble secrets.
func resolveConfig(cfg *Config) resolvedConfig {
	m := cfg.Marble

	rc := resolvedConfig{
		serviceGatewayHash: resolveContractHash(cfg.ServiceGatewayHash, m,
			"CONTRACT_SERVICEGATEWAY_HASH", "CONTRACT_SERVICE_GATEWAY_HASH"),
		appRegistryHash: resolveContractHash(cfg.AppRegistryHash, m,
			"CONTRACT_APPREGISTRY_HASH", "CONTRACT_APP_REGISTRY_HASH"),
		paymentHubHash: resolveContractHash(cfg.PaymentHubHash, m,
			"CONTRACT_PAYMENTHUB_HASH", "CONTRACT_PAYMENT_HUB_HASH", "CONTRACT_GATEWAY_HASH"),
	}

	// maxResult
	rc.maxResult = runtime.LoadEnvInt("NEOREQUESTS_MAX_RESULT_BYTES", cfg.MaxResultBytes, defaultMaxResultBytes)

	// maxErrorLen
	rc.maxErrorLen = runtime.LoadEnvInt("NEOREQUESTS_MAX_ERROR_LEN", cfg.MaxErrorLen, defaultMaxErrorLen)

	// rngMode
	rc.rngMode = strings.ToLower(strings.TrimSpace(cfg.RNGResultMode))
	if rc.rngMode == "" {
		rc.rngMode = strings.ToLower(strings.TrimSpace(os.Getenv("NEOREQUESTS_RNG_RESULT_MODE")))
	}
	if rc.rngMode != "raw" && rc.rngMode != "json" {
		rc.rngMode = "raw"
	}

	// chainID
	rc.chainID = strings.TrimSpace(cfg.ChainID)
	if rc.chainID == "" {
		rc.chainID = resolveChainID()
	}

	// txWait
	rc.txWait = cfg.TxWait
	if raw := strings.TrimSpace(os.Getenv("NEOREQUESTS_TX_WAIT")); raw != "" {
		rc.txWait = strings.EqualFold(raw, "true") || raw == "1"
	}

	// statsRollupInterval
	rc.statsRollupInterval = cfg.StatsRollupInterval
	if rc.statsRollupInterval <= 0 {
		if parsed, ok := runtime.ParseEnvDuration("NEOREQUESTS_STATS_ROLLUP_INTERVAL"); ok {
			rc.statsRollupInterval = parsed
		} else {
			rc.statsRollupInterval = 30 * time.Minute
		}
	}

	// onchainUsage
	rc.onchainUsage = cfg.OnchainUsage
	if raw := strings.TrimSpace(os.Getenv("NEOREQUESTS_ONCHAIN_USAGE")); raw != "" {
		rc.onchainUsage = runtime.ParseEnvBool(raw)
	}
	rc.onchainTxUsage = cfg.OnchainTxUsage
	if raw := strings.TrimSpace(os.Getenv("NEOREQUESTS_TX_USAGE")); raw != "" {
		rc.onchainTxUsage = runtime.ParseEnvBool(raw)
	} else if !rc.onchainTxUsage {
		rc.onchainTxUsage = true
	}

	// enforceAppRegistry
	switch raw := strings.TrimSpace(os.Getenv("NEOREQUESTS_ENFORCE_APPREGISTRY")); {
	case raw != "":
		// Explicit env override must always win, including explicit "false".
		rc.enforceAppRegistry = runtime.ParseEnvBool(raw)
	case cfg.EnforceAppRegistry:
		rc.enforceAppRegistry = true
	default:
		// Auto-enable only when not explicitly configured.
		rc.enforceAppRegistry = rc.appRegistryHash != "" && cfg.ChainClient != nil
	}

	// requireManifestContract
	rc.requireManifestContract = cfg.RequireManifestContract
	if raw := strings.TrimSpace(os.Getenv("NEOREQUESTS_REQUIRE_MANIFEST_CONTRACT")); raw != "" {
		rc.requireManifestContract = runtime.ParseEnvBool(raw)
	} else if !rc.requireManifestContract {
		rc.requireManifestContract = true
	}

	// requestIndexTTL
	rc.requestIndexTTL = cfg.RequestIndexTTL
	if rc.requestIndexTTL <= 0 {
		if parsed, ok := runtime.ParseEnvDuration("NEOREQUESTS_REQUEST_INDEX_TTL"); ok {
			rc.requestIndexTTL = parsed
		}
	}
	if rc.requestIndexTTL <= 0 {
		rc.requestIndexTTL = defaultRequestIndexTTL
	}

	// serviceTimeout
	rc.serviceTimeout = cfg.ServiceTimeout
	if rc.serviceTimeout <= 0 {
		if parsed, ok := runtime.ParseEnvDuration("NEOREQUESTS_SERVICE_TIMEOUT"); ok && parsed > 0 {
			rc.serviceTimeout = parsed
		}
	}
	if rc.serviceTimeout <= 0 {
		rc.serviceTimeout = defaultServiceTimeout
	}

	// preValidationTimeout
	rc.preValidationTimeout = cfg.PreValidationTimeout
	if rc.preValidationTimeout <= 0 {
		if parsed, ok := runtime.ParseEnvDuration("NEOREQUESTS_PREVALIDATION_TIMEOUT"); ok && parsed > 0 {
			rc.preValidationTimeout = parsed
		}
	}
	if rc.preValidationTimeout <= 0 {
		rc.preValidationTimeout = defaultPreValidationTimeout
	}
	if rc.serviceTimeout > 0 && rc.preValidationTimeout > rc.serviceTimeout {
		rc.preValidationTimeout = rc.serviceTimeout
	}

	// cacheSeconds
	rc.cacheSeconds = cfg.AppRegistryCacheSeconds
	if rc.cacheSeconds <= 0 {
		if parsed, ok := runtime.ParseEnvInt("NEOREQUESTS_APPREGISTRY_CACHE_SECONDS"); ok && parsed >= 0 {
			rc.cacheSeconds = parsed
		}
	}
	if rc.cacheSeconds <= 0 {
		rc.cacheSeconds = 60
	}

	return rc
}

// initAppRegistry validates and initializes the AppRegistry contract on the
// service. It may disable enforcement in non-strict mode if prerequisites are
// missing.
func (s *Service) initAppRegistry(strict bool) error {
	if s.enforceAppRegistry {
		if s.appRegistryHash == "" {
			if strict {
				return fmt.Errorf("neorequests: AppRegistry hash required when enforcement enabled")
			}
			s.Logger().WithContext(context.Background()).Warn("AppRegistry enforcement enabled but hash missing; disabling enforcement")
			s.enforceAppRegistry = false
		}
		if s.chainClient == nil {
			if strict {
				return fmt.Errorf("neorequests: chain client required when AppRegistry enforcement enabled")
			}
			s.Logger().WithContext(context.Background()).Warn("AppRegistry enforcement enabled but chain client missing; disabling enforcement")
			s.enforceAppRegistry = false
		}
	}
	if s.enforceAppRegistry && s.chainClient != nil && s.appRegistryHash != "" {
		s.appRegistry = chain.NewAppRegistryContract(s.chainClient, s.appRegistryHash)
	}
	return nil
}

// resolveServiceURLs fills in service URLs from environment variables when
// not already set from the config.
func (s *Service) resolveServiceURLs() {
	if s.vrfURL == "" {
		s.vrfURL = strings.TrimSpace(os.Getenv("NEOVRF_URL"))
	}
	if s.oracleURL == "" {
		s.oracleURL = strings.TrimSpace(os.Getenv("NEOORACLE_URL"))
	}
	if s.computeURL == "" {
		s.computeURL = strings.TrimSpace(os.Getenv("NEOCOMPUTE_URL"))
	}
}

// New creates a new NeoRequests service.
func New(cfg Config) (*Service, error) { //nolint:gocritic // cfg is read once at startup.
	if cfg.Marble == nil {
		return nil, fmt.Errorf("neorequests: marble is required")
	}

	strict := runtime.StrictIdentityMode() || cfg.Marble.IsEnclave()

	if strict {
		if cfg.EventListener == nil {
			return nil, fmt.Errorf("neorequests: event listener is required in strict/enclave mode")
		}
		if cfg.TxProxy == nil {
			return nil, fmt.Errorf("neorequests: txproxy is required in strict/enclave mode")
		}
	}

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
		DB:      cfg.DB,
	})

	repo := cfg.RequestsRepo
	if repo == nil {
		if r, ok := cfg.DB.(*database.Repository); ok {
			repo = neorequestsupabase.NewRepository(r)
		}
	}

	rc := resolveConfig(&cfg)

	if strict && rc.serviceGatewayHash == "" {
		return nil, fmt.Errorf("neorequests: ServiceLayerGateway hash required in strict/enclave mode")
	}

	cacheTTL := time.Duration(rc.cacheSeconds) * time.Second

	s := &Service{
		BaseService:             base,
		repo:                    repo,
		eventListener:           cfg.EventListener,
		txProxy:                 cfg.TxProxy,
		serviceGatewayHash:      rc.serviceGatewayHash,
		appRegistryHash:         rc.appRegistryHash,
		chainClient:             cfg.ChainClient,
		enforceAppRegistry:      rc.enforceAppRegistry,
		appRegistryCache:        map[string]appRegistryCacheEntry{},
		appRegistryTTL:          cacheTTL,
		miniAppCache:            map[string]miniAppCacheEntry{},
		miniAppCacheTTL:         cacheTTL,
		requireManifestContract: rc.requireManifestContract,
		paymentHubHash:          rc.paymentHubHash,
		httpClient:              resolveHTTPClient(&cfg),
		vrfURL:                  strings.TrimSpace(cfg.NeoVRFURL),
		oracleURL:               strings.TrimSpace(cfg.NeoOracleURL),
		computeURL:              strings.TrimSpace(cfg.NeoComputeURL),
		scriptsURL:              strings.TrimSpace(cfg.ScriptsBaseURL),
		chainID:                 rc.chainID,
		txWait:                  rc.txWait,
		maxResult:               rc.maxResult,
		maxErrorLen:             rc.maxErrorLen,
		rngMode:                 rc.rngMode,
		statsRollupInterval:     rc.statsRollupInterval,
		onchainUsage:            rc.onchainUsage,
		onchainTxUsage:          rc.onchainTxUsage,
		requestIndexTTL:         rc.requestIndexTTL,
		serviceTimeout:          rc.serviceTimeout,
		preValidationTimeout:    rc.preValidationTimeout,
	}

	if err := s.initAppRegistry(strict); err != nil {
		return nil, err
	}
	s.resolveServiceURLs()

	base.RegisterStandardRoutes()
	s.registerHandlers()
	s.registerStatsRollup()
	s.registerRequestIndexCleanup()
	s.registerMiniAppCacheCleanup()

	return s, nil
}

// listenerContext returns the context bound to the event listener lifecycle.
// Falls back to context.Background() if the listener has not started yet.
func (s *Service) listenerContext() context.Context {
	s.listenerMu.Lock()
	ctx := s.listenerCtx
	s.listenerMu.Unlock()
	if ctx != nil {
		return ctx
	}
	return context.Background()
}

func (s *Service) registerHandlers() {
	if s.eventListener == nil || s.serviceGatewayHash == "" {
		return
	}

	s.eventListener.On("ServiceRequested", func(event *chain.ContractEvent) error {
		return s.handleServiceRequested(s.listenerContext(), event)
	})
	s.eventListener.On("ServiceFulfilled", func(event *chain.ContractEvent) error {
		return s.handleServiceFulfilled(s.listenerContext(), event)
	})
	s.eventListener.On("Platform_Notification", func(event *chain.ContractEvent) error {
		return s.handleNotificationEvent(s.listenerContext(), event)
	})
	s.eventListener.On("Notification", func(event *chain.ContractEvent) error {
		return s.handleNotificationEvent(s.listenerContext(), event)
	})
	s.eventListener.On("Platform_Metric", func(event *chain.ContractEvent) error {
		return s.handleMetricEvent(s.listenerContext(), event)
	})
	s.eventListener.On("Metric", func(event *chain.ContractEvent) error {
		return s.handleMetricEvent(s.listenerContext(), event)
	})
	s.eventListener.On("AppRegistered", func(event *chain.ContractEvent) error {
		return s.handleAppRegistryEvent(s.listenerContext(), event)
	})
	s.eventListener.On("AppUpdated", func(event *chain.ContractEvent) error {
		return s.handleAppRegistryEvent(s.listenerContext(), event)
	})
	s.eventListener.On("StatusChanged", func(event *chain.ContractEvent) error {
		return s.handleAppRegistryEvent(s.listenerContext(), event)
	})
	s.eventListener.On("PaymentReceived", func(event *chain.ContractEvent) error {
		return s.handlePaymentReceivedEvent(s.listenerContext(), event)
	})
	if s.onchainTxUsage {
		s.eventListener.OnTransaction(func(event *chain.TransactionEvent) error {
			return s.handleMiniAppTxEvent(s.listenerContext(), event)
		})
	}

	s.BaseService.AddWorker(s.runEventListener)
}

func (s *Service) registerStatsRollup() {
	if s.repo == nil || s.BaseService == nil {
		return
	}
	if s.statsRollupInterval <= 0 {
		return
	}
	s.BaseService.AddTickerWorker(
		s.statsRollupInterval,
		s.rollupMiniAppStats,
		commonservice.WithTickerWorkerName("miniapp_stats_rollup"),
		commonservice.WithTickerWorkerImmediate(),
	)
}

func (s *Service) runEventListener(ctx context.Context) {
	if s.eventListener == nil {
		return
	}

	lCtx, lCancel := context.WithCancel(ctx)
	s.listenerMu.Lock()
	s.listenerCtx, s.listenerCancel = lCtx, lCancel
	s.listenerMu.Unlock()
	defer lCancel()

	if err := s.eventListener.Start(s.listenerCtx); err != nil {
		s.Logger().WithContext(s.listenerCtx).WithError(err).Warn("failed to start event listener")
		return
	}
	// Block until parent context is canceled (service shutdown)
	<-ctx.Done()
	s.eventListener.Stop()
}

func resolveChainID() string {
	raw := strings.TrimSpace(os.Getenv("NEO_NETWORK_MAGIC"))
	if raw == "" {
		return "neo-n3"
	}
	if _, err := strconv.ParseUint(raw, 10, 32); err != nil {
		return "neo-n3"
	}
	return fmt.Sprintf("neo-n3:%s", raw)
}

func normalizeContractHash(value string) string {
	return chain.NormalizeContractHash(value)
}

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

	chaincfg "github.com/R3E-Network/service_layer/infrastructure/chains"
	"github.com/R3E-Network/service_layer/infrastructure/chain"
	"github.com/R3E-Network/service_layer/infrastructure/database"
	"github.com/R3E-Network/service_layer/infrastructure/marble"
	"github.com/R3E-Network/service_layer/infrastructure/runtime"
	commonservice "github.com/R3E-Network/service_layer/infrastructure/service"
	txproxytypes "github.com/R3E-Network/service_layer/infrastructure/txproxy/types"
	neorequestsupabase "github.com/R3E-Network/service_layer/services/requests/supabase"
)

const (
	ServiceID   = "neorequests"
	ServiceName = "NeoRequests Service"
	Version     = "1.0.0"

	// Neo notifications are capped at 1024 bytes. Keep a safe default
	// to avoid callback failures when ServiceLayerGateway emits events.
	defaultMaxResultBytes  = 800
	defaultMaxErrorLen     = 256
	defaultRequestIndexTTL = time.Hour
)

// Config holds NeoRequests service configuration.
type Config struct {
	Marble *marble.Marble
	DB     database.RepositoryInterface

	RequestsRepo  neorequestsupabase.RepositoryInterface
	EventListener *chain.EventListener
	TxProxy       txproxytypes.Invoker
	ChainClient   *chain.Client

	ServiceGatewayAddress string
	AppRegistryAddress    string
	PaymentHubAddress     string
	NeoVRFURL          string
	NeoOracleURL       string
	NeoComputeURL      string
	ScriptsBaseURL     string // Base URL for loading TEE scripts (e.g., https://cdn.miniapps.neo.org)

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
}

// Service implements the NeoRequests service.
type Service struct {
	*commonservice.BaseService

	repo                    neorequestsupabase.RepositoryInterface
	eventListener           *chain.EventListener
	txProxy                 txproxytypes.Invoker
	serviceGatewayAddress   string
	appRegistryAddress      string
	appRegistry             *chain.AppRegistryContract
	chainClient             *chain.Client
	enforceAppRegistry      bool
	paymentHubAddress       string
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
	onchainUsage        bool
	onchainTxUsage      bool

	requestIndex    sync.Map
	requestIndexTTL time.Duration
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

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = cfg.Marble.HTTPClient()
		if httpClient == nil {
			httpClient = &http.Client{Timeout: 30 * time.Second}
		}
	}

	serviceGatewayAddress := normalizeContractAddress(cfg.ServiceGatewayAddress)
	if serviceGatewayAddress == "" {
		serviceGatewayAddress = normalizeContractAddress(os.Getenv("CONTRACT_SERVICE_GATEWAY_ADDRESS"))
	}
	if serviceGatewayAddress == "" {
		if secret, ok := cfg.Marble.Secret("CONTRACT_SERVICE_GATEWAY_ADDRESS"); ok && len(secret) > 0 {
			serviceGatewayAddress = normalizeContractAddress(string(secret))
		}
	}
	if strict && serviceGatewayAddress == "" {
		return nil, fmt.Errorf("neorequests: ServiceLayerGateway address required in strict/enclave mode")
	}

	appRegistryAddress := normalizeContractAddress(cfg.AppRegistryAddress)
	if appRegistryAddress == "" {
		appRegistryAddress = normalizeContractAddress(os.Getenv("CONTRACT_APP_REGISTRY_ADDRESS"))
	}
	if appRegistryAddress == "" {
		if secret, ok := cfg.Marble.Secret("CONTRACT_APP_REGISTRY_ADDRESS"); ok && len(secret) > 0 {
			appRegistryAddress = normalizeContractAddress(string(secret))
		}
	}

	paymentHubAddress := normalizeContractAddress(cfg.PaymentHubAddress)
	if paymentHubAddress == "" {
		paymentHubAddress = normalizeContractAddress(os.Getenv("CONTRACT_PAYMENT_HUB_ADDRESS"))
	}
	if paymentHubAddress == "" {
		if secret, ok := cfg.Marble.Secret("CONTRACT_PAYMENT_HUB_ADDRESS"); ok && len(secret) > 0 {
			paymentHubAddress = normalizeContractAddress(string(secret))
		}
	}

	maxResult := cfg.MaxResultBytes
	if maxResult <= 0 {
		if parsed, ok := parseEnvInt("NEOREQUESTS_MAX_RESULT_BYTES"); ok && parsed > 0 {
			maxResult = parsed
		} else {
			maxResult = defaultMaxResultBytes
		}
	}

	maxErrorLen := cfg.MaxErrorLen
	if maxErrorLen <= 0 {
		if parsed, ok := parseEnvInt("NEOREQUESTS_MAX_ERROR_LEN"); ok && parsed > 0 {
			maxErrorLen = parsed
		} else {
			maxErrorLen = defaultMaxErrorLen
		}
	}

	rngMode := strings.ToLower(strings.TrimSpace(cfg.RNGResultMode))
	if rngMode == "" {
		rngMode = strings.ToLower(strings.TrimSpace(os.Getenv("NEOREQUESTS_RNG_RESULT_MODE")))
	}
	if rngMode == "" {
		rngMode = "raw"
	}
	if rngMode != "raw" && rngMode != "json" {
		rngMode = "raw"
	}

	chainID := strings.TrimSpace(cfg.ChainID)
	if chainID == "" {
		chainID = resolveChainID()
	}

	var chainMeta *chaincfg.ChainConfig
	if chainID != "" {
		if cfg, err := chaincfg.LoadConfig(); err == nil {
			if found, ok := cfg.GetChain(chainID); ok {
				chainMeta = found
			}
		}
	}
	if chainMeta != nil {
		if value := normalizeContractAddress(chainMeta.Contract("service_gateway")); value != "" {
			serviceGatewayAddress = value
		}
		if value := normalizeContractAddress(chainMeta.Contract("app_registry")); value != "" {
			appRegistryAddress = value
		}
		if value := normalizeContractAddress(chainMeta.Contract("payment_hub")); value != "" {
			paymentHubAddress = value
		}
	}

	txWait := cfg.TxWait
	if raw := strings.TrimSpace(os.Getenv("NEOREQUESTS_TX_WAIT")); raw != "" {
		txWait = strings.EqualFold(raw, "true") || raw == "1"
	}

	statsRollupInterval := cfg.StatsRollupInterval
	if statsRollupInterval <= 0 {
		if parsed, ok := parseEnvDuration("NEOREQUESTS_STATS_ROLLUP_INTERVAL"); ok {
			statsRollupInterval = parsed
		} else {
			statsRollupInterval = 30 * time.Minute
		}
	}

	onchainUsage := cfg.OnchainUsage
	if raw := strings.TrimSpace(os.Getenv("NEOREQUESTS_ONCHAIN_USAGE")); raw != "" {
		onchainUsage = parseEnvBool(raw)
	}
	onchainTxUsage := cfg.OnchainTxUsage
	if raw := strings.TrimSpace(os.Getenv("NEOREQUESTS_TX_USAGE")); raw != "" {
		onchainTxUsage = parseEnvBool(raw)
	} else if !onchainTxUsage {
		onchainTxUsage = true
	}

	enforceAppRegistry := cfg.EnforceAppRegistry
	if raw := strings.TrimSpace(os.Getenv("NEOREQUESTS_ENFORCE_APPREGISTRY")); raw != "" {
		enforceAppRegistry = parseEnvBool(raw)
	}
	if !enforceAppRegistry && appRegistryAddress != "" && cfg.ChainClient != nil {
		enforceAppRegistry = true
	}

	requireManifestContract := cfg.RequireManifestContract
	if raw := strings.TrimSpace(os.Getenv("NEOREQUESTS_REQUIRE_MANIFEST_CONTRACT")); raw != "" {
		requireManifestContract = parseEnvBool(raw)
	} else if !requireManifestContract {
		requireManifestContract = true
	}

	requestIndexTTL := cfg.RequestIndexTTL
	if requestIndexTTL <= 0 {
		if parsed, ok := parseEnvDuration("NEOREQUESTS_REQUEST_INDEX_TTL"); ok {
			requestIndexTTL = parsed
		}
	}
	if requestIndexTTL <= 0 {
		requestIndexTTL = defaultRequestIndexTTL
	}

	cacheSeconds := cfg.AppRegistryCacheSeconds
	if cacheSeconds <= 0 {
		if parsed, ok := parseEnvInt("NEOREQUESTS_APPREGISTRY_CACHE_SECONDS"); ok && parsed >= 0 {
			cacheSeconds = parsed
		}
	}
	if cacheSeconds <= 0 {
		cacheSeconds = 60
	}

	s := &Service{
		BaseService:             base,
		repo:                    repo,
		eventListener:           cfg.EventListener,
		txProxy:                 cfg.TxProxy,
		serviceGatewayAddress:   serviceGatewayAddress,
		appRegistryAddress:      appRegistryAddress,
		chainClient:             cfg.ChainClient,
		enforceAppRegistry:      enforceAppRegistry,
		appRegistryCache:        map[string]appRegistryCacheEntry{},
		appRegistryTTL:          time.Duration(cacheSeconds) * time.Second,
		miniAppCache:            map[string]miniAppCacheEntry{},
		miniAppCacheTTL:         time.Duration(cacheSeconds) * time.Second,
		requireManifestContract: requireManifestContract,
		paymentHubAddress:       paymentHubAddress,
		httpClient:              httpClient,
		vrfURL:                  strings.TrimSpace(cfg.NeoVRFURL),
		oracleURL:               strings.TrimSpace(cfg.NeoOracleURL),
		computeURL:              strings.TrimSpace(cfg.NeoComputeURL),
		scriptsURL:              strings.TrimSpace(cfg.ScriptsBaseURL),
		chainID:                 chainID,
		txWait:                  txWait,
		maxResult:               maxResult,
		maxErrorLen:             maxErrorLen,
		rngMode:                 rngMode,
		statsRollupInterval:     statsRollupInterval,
		onchainUsage:            onchainUsage,
		onchainTxUsage:          onchainTxUsage,
		requestIndexTTL:         requestIndexTTL,
	}

	if s.enforceAppRegistry {
		if s.appRegistryAddress == "" {
			if strict {
				return nil, fmt.Errorf("neorequests: AppRegistry address required when enforcement enabled")
			}
			s.Logger().WithContext(context.Background()).Warn("AppRegistry enforcement enabled but address missing; disabling enforcement")
			s.enforceAppRegistry = false
		}
		if s.chainClient == nil {
			if strict {
				return nil, fmt.Errorf("neorequests: chain client required when AppRegistry enforcement enabled")
			}
			s.Logger().WithContext(context.Background()).Warn("AppRegistry enforcement enabled but chain client missing; disabling enforcement")
			s.enforceAppRegistry = false
		}
	}
	if s.enforceAppRegistry && s.chainClient != nil && s.appRegistryAddress != "" {
		s.appRegistry = chain.NewAppRegistryContract(s.chainClient, s.appRegistryAddress)
	}

	if s.vrfURL == "" {
		s.vrfURL = strings.TrimSpace(os.Getenv("NEOVRF_URL"))
	}
	if s.oracleURL == "" {
		s.oracleURL = strings.TrimSpace(os.Getenv("NEOORACLE_URL"))
	}
	if s.computeURL == "" {
		s.computeURL = strings.TrimSpace(os.Getenv("NEOCOMPUTE_URL"))
	}

	base.RegisterStandardRoutes()
	s.registerHandlers()
	s.registerStatsRollup()
	s.registerRequestIndexCleanup()

	return s, nil
}

func (s *Service) registerHandlers() {
	if s.eventListener == nil || s.serviceGatewayAddress == "" {
		return
	}

	s.eventListener.On("ServiceRequested", func(event *chain.ContractEvent) error {
		return s.handleServiceRequested(context.Background(), event)
	})
	s.eventListener.On("ServiceFulfilled", func(event *chain.ContractEvent) error {
		return s.handleServiceFulfilled(context.Background(), event)
	})
	s.eventListener.On("Platform_Notification", func(event *chain.ContractEvent) error {
		return s.handleNotificationEvent(context.Background(), event)
	})
	s.eventListener.On("Notification", func(event *chain.ContractEvent) error {
		return s.handleNotificationEvent(context.Background(), event)
	})
	s.eventListener.On("Platform_Metric", func(event *chain.ContractEvent) error {
		return s.handleMetricEvent(context.Background(), event)
	})
	s.eventListener.On("Metric", func(event *chain.ContractEvent) error {
		return s.handleMetricEvent(context.Background(), event)
	})
	s.eventListener.On("AppRegistered", func(event *chain.ContractEvent) error {
		return s.handleAppRegistryEvent(context.Background(), event)
	})
	s.eventListener.On("AppUpdated", func(event *chain.ContractEvent) error {
		return s.handleAppRegistryEvent(context.Background(), event)
	})
	s.eventListener.On("StatusChanged", func(event *chain.ContractEvent) error {
		return s.handleAppRegistryEvent(context.Background(), event)
	})
	s.eventListener.On("PaymentReceived", func(event *chain.ContractEvent) error {
		return s.handlePaymentReceivedEvent(context.Background(), event)
	})
	s.eventListener.OnAny(func(event *chain.ContractEvent) error {
		return s.handleMiniAppContractEvent(context.Background(), event)
	})
	if s.onchainTxUsage {
		s.eventListener.OnTransaction(func(event *chain.TransactionEvent) error {
			return s.handleMiniAppTxEvent(context.Background(), event)
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

	if err := s.eventListener.Start(ctx); err != nil {
		s.Logger().WithContext(ctx).WithError(err).Warn("failed to start event listener")
	}
}

func parseEnvInt(key string) (int, bool) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return 0, false
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, false
	}
	return value, true
}

func parseEnvDuration(key string) (time.Duration, bool) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return 0, false
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil {
		return 0, false
	}
	return parsed, true
}

func parseEnvBool(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return false
	}
	switch strings.ToLower(raw) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}

func resolveChainID() string {
	if raw := strings.TrimSpace(os.Getenv("CHAIN_ID")); raw != "" {
		return raw
	}

	var magic uint64
	if raw := strings.TrimSpace(os.Getenv("NEO_NETWORK_MAGIC")); raw != "" {
		if parsed, err := strconv.ParseUint(raw, 10, 32); err == nil {
			magic = parsed
		}
	}

	cfg, err := chaincfg.LoadConfig()
	if err == nil {
		for _, chain := range cfg.Chains {
			if chain.Type != chaincfg.ChainTypeNeoN3 {
				continue
			}
			if magic > 0 && uint64(chain.NetworkMagic) == magic {
				return chain.ID
			}
		}
		for _, chain := range cfg.Chains {
			if chain.Type == chaincfg.ChainTypeNeoN3 {
				return chain.ID
			}
		}
	}

	if magic > 0 {
		return fmt.Sprintf("neo-n3:%d", magic)
	}
	return "neo-n3-mainnet"
}

func normalizeContractAddress(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "0x")
	value = strings.TrimPrefix(value, "0X")
	value = strings.ToLower(value)
	if len(value) != 40 {
		return ""
	}
	for _, ch := range value {
		if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') {
			return ""
		}
	}
	return value
}

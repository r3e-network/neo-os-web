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

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/marble"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/resilience"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/runtime"
	commonservice "github.com/R3E-Network/neo-miniapps-platform/infrastructure/service"
	txproxytypes "github.com/R3E-Network/neo-miniapps-platform/infrastructure/txproxy/types"
	neorequestsupabase "github.com/R3E-Network/neo-miniapps-platform/services/requests/supabase"
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

	RequestsRepo neorequestsupabase.RepositoryInterface

	// Chains configuration for multi-chain support
	Chains []ChainServiceConfig

	// Global settings
	NeoVRFURL      string
	NeoOracleURL   string
	NeoComputeURL  string
	ScriptsBaseURL string

	HTTPClient     *http.Client
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

// ChainServiceConfig holds configuration for a specific chain.
type ChainServiceConfig struct {
	ChainID               string
	EventListener         *chain.EventListener
	TxProxy               txproxytypes.Invoker
	ChainClient           *chain.Client
	ServiceGatewayAddress string
	AppRegistryAddress    string
	PaymentHubAddress     string
}

// ChainContext holds runtime resources for a specific chain.
type ChainContext struct {
	ChainID               string
	EventListener         *chain.EventListener
	TxProxy               txproxytypes.Invoker
	ChainClient           *chain.Client
	ServiceGatewayAddress string
	AppRegistryAddress    string
	PaymentHubAddress     string
	AppRegistry           *chain.AppRegistryContract
}

// Service implements the NeoRequests service.
type Service struct {
	*commonservice.BaseService

	repo               neorequestsupabase.RepositoryInterface
	chains             map[string]*ChainContext
	chainsMu           sync.RWMutex
	defaultChainID     string
	enforceAppRegistry bool

	appRegistryCache map[string]appRegistryCacheEntry
	appRegistryMu    sync.RWMutex
	appRegistryTTL   time.Duration

	miniAppCache            map[string]miniAppCacheEntry
	miniAppCacheMu          sync.RWMutex
	miniAppCacheTTL         time.Duration
	requireManifestContract bool

	httpClient         *http.Client
	httpCircuitBreaker *resilience.CircuitBreaker
	vrfURL             string
	oracleURL          string
	computeURL         string
	scriptsURL         string

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
// New creates a new NeoRequests service.
func New(cfg Config) (*Service, error) {
	if err := commonservice.ValidateMarble(cfg.Marble, ServiceID); err != nil {
		return nil, err
	}

	chainContexts := make(map[string]*ChainContext)
	strict := commonservice.IsStrict(cfg.Marble)

	// Initialize chains from config if provided
	for _, chainCfg := range cfg.Chains {
		if chainCfg.ChainID == "" {
			continue
		}
		if strict {
			if chainCfg.EventListener == nil {
				return nil, fmt.Errorf("neorequests: event listener required for chain %s in strict mode", chainCfg.ChainID)
			}
			if chainCfg.TxProxy == nil {
				return nil, fmt.Errorf("neorequests: txproxy required for chain %s in strict mode", chainCfg.ChainID)
			}
		}

		ctx := &ChainContext{
			ChainID:               chainCfg.ChainID,
			EventListener:         chainCfg.EventListener,
			TxProxy:               chainCfg.TxProxy,
			ChainClient:           chainCfg.ChainClient,
			ServiceGatewayAddress: normalizeContractAddress(chainCfg.ServiceGatewayAddress),
			AppRegistryAddress:    normalizeContractAddress(chainCfg.AppRegistryAddress),
			PaymentHubAddress:     normalizeContractAddress(chainCfg.PaymentHubAddress),
		}

		// Initialize Registry contract helper if available
		if ctx.ChainClient != nil && ctx.AppRegistryAddress != "" {
			ctx.AppRegistry = chain.NewAppRegistryContract(ctx.ChainClient, ctx.AppRegistryAddress)
		}

		chainContexts[chainCfg.ChainID] = ctx
	}

	// Fallback: If no chains configured, try to auto-discover using legacy env vars
	// This maintains backward compatibility
	if len(chainContexts) == 0 {
		defaultID := resolveChainID()

		// Try to load configured chains from infrastructure config
		//nolint:errcheck // Error is ignored - fallback to env vars is acceptable
		chainInfraCfg, _ := chain.LoadChainsConfig()

		// Create context for the default chain ID found
		ctx := &ChainContext{ChainID: defaultID}

		// Load addresses from env/secrets
		if addr := os.Getenv("CONTRACT_SERVICE_GATEWAY_ADDRESS"); addr != "" {
			ctx.ServiceGatewayAddress = normalizeContractAddress(addr)
		} else if secret, ok := cfg.Marble.Secret("CONTRACT_SERVICE_GATEWAY_ADDRESS"); ok {
			ctx.ServiceGatewayAddress = normalizeContractAddress(string(secret))
		}

		if addr := os.Getenv("CONTRACT_APP_REGISTRY_ADDRESS"); addr != "" {
			ctx.AppRegistryAddress = normalizeContractAddress(addr)
		} else if secret, ok := cfg.Marble.Secret("CONTRACT_APP_REGISTRY_ADDRESS"); ok {
			ctx.AppRegistryAddress = normalizeContractAddress(string(secret))
		}

		if addr := os.Getenv("CONTRACT_PAYMENT_HUB_ADDRESS"); addr != "" {
			ctx.PaymentHubAddress = normalizeContractAddress(addr)
		} else if secret, ok := cfg.Marble.Secret("CONTRACT_PAYMENT_HUB_ADDRESS"); ok {
			ctx.PaymentHubAddress = normalizeContractAddress(string(secret))
		}

		// If we have chain infra config, try to resolve addresses from it
		if chainInfraCfg != nil {
			if c, ok := chainInfraCfg.GetChain(defaultID); ok {
				if val := c.Contract("service_gateway"); val != "" {
					ctx.ServiceGatewayAddress = normalizeContractAddress(val)
				}
				if val := c.Contract("app_registry"); val != "" {
					ctx.AppRegistryAddress = normalizeContractAddress(val)
				}
				if val := c.Contract("payment_hub"); val != "" {
					ctx.PaymentHubAddress = normalizeContractAddress(val)
				}
			}
		}

		// We cannot easily conjure Client/EventListener/TxProxy from thin air here
		// without the caller providing them. The caller MUST provide them in cfg.Chains
		// for proper operation.
		// However, if the caller is legacy, they might expect us to accept nil...
		// But since we removed fields from Config, the caller MUST update usage.

		// For now, if we are in this block, it means the caller didn't provide chains.
		// We will register this limited context. Functional components might be missing.
		chainContexts[defaultID] = ctx
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

	maxResult := runtime.ResolveInt(cfg.MaxResultBytes, "NEOREQUESTS_MAX_RESULT_BYTES", defaultMaxResultBytes)

	maxErrorLen := runtime.ResolveInt(cfg.MaxErrorLen, "NEOREQUESTS_MAX_ERROR_LEN", defaultMaxErrorLen)

	rngMode := strings.ToLower(strings.TrimSpace(cfg.RNGResultMode))
	if rngMode == "" {
		rngMode = strings.ToLower(strings.TrimSpace(os.Getenv("NEOREQUESTS_RNG_RESULT_MODE")))
	}
	if rngMode != "raw" && rngMode != "json" {
		rngMode = "raw"
	}

	// Default Chain ID is the first one found or resolved
	defaultChainID := resolveChainID()
	if len(chainContexts) > 0 {
		// Pick one as default if not matching
		if _, ok := chainContexts[defaultChainID]; !ok {
			for id := range chainContexts {
				defaultChainID = id
				break
			}
		}
	}

	txWait := runtime.ResolveBool(cfg.TxWait, "NEOREQUESTS_TX_WAIT")

	statsRollupInterval := runtime.ResolveDuration(cfg.StatsRollupInterval, "NEOREQUESTS_STATS_ROLLUP_INTERVAL", 30*time.Minute)

	onchainUsage := runtime.ResolveBool(cfg.OnchainUsage, "NEOREQUESTS_ONCHAIN_USAGE")
	onchainTxUsage := runtime.ResolveBool(cfg.OnchainTxUsage, "NEOREQUESTS_TX_USAGE")
	if !onchainTxUsage && strings.TrimSpace(os.Getenv("NEOREQUESTS_TX_USAGE")) == "" {
		onchainTxUsage = true
	}

	enforceAppRegistry := runtime.ResolveBool(cfg.EnforceAppRegistry, "NEOREQUESTS_ENFORCE_APPREGISTRY")

	requestIndexTTL := runtime.ResolveDuration(cfg.RequestIndexTTL, "NEOREQUESTS_REQUEST_INDEX_TTL", defaultRequestIndexTTL)

	cacheSeconds := cfg.AppRegistryCacheSeconds
	if cacheSeconds <= 0 {
		if parsed, ok := runtime.ParseEnvInt("NEOREQUESTS_APPREGISTRY_CACHE_SECONDS"); ok && parsed >= 0 {
			cacheSeconds = parsed
		}
	}
	if cacheSeconds <= 0 {
		cacheSeconds = 60
	}

	s := &Service{
		BaseService:             base,
		repo:                    repo,
		chains:                  chainContexts,
		defaultChainID:          defaultChainID,
		enforceAppRegistry:      enforceAppRegistry,
		appRegistryCache:        map[string]appRegistryCacheEntry{},
		appRegistryTTL:          time.Duration(cacheSeconds) * time.Second,
		miniAppCache:            map[string]miniAppCacheEntry{},
		miniAppCacheTTL:         time.Duration(cacheSeconds) * time.Second,
		requireManifestContract: cfg.RequireManifestContract,
		httpClient:              httpClient,
		httpCircuitBreaker:      resilience.New(resilience.DefaultServiceCBConfig(base.Logger())),
		vrfURL:                  strings.TrimSpace(cfg.NeoVRFURL),
		oracleURL:               strings.TrimSpace(cfg.NeoOracleURL),
		computeURL:              strings.TrimSpace(cfg.NeoComputeURL),
		scriptsURL:              strings.TrimSpace(cfg.ScriptsBaseURL),
		txWait:                  txWait,
		maxResult:               maxResult,
		maxErrorLen:             maxErrorLen,
		rngMode:                 rngMode,
		statsRollupInterval:     statsRollupInterval,
		onchainUsage:            onchainUsage,
		onchainTxUsage:          onchainTxUsage,
		requestIndexTTL:         requestIndexTTL,
	}

	// Verify enforcement requirements
	if s.enforceAppRegistry {
		for id, ctx := range s.chains {
			if ctx.AppRegistryAddress == "" {
				if strict {
					return nil, fmt.Errorf("neorequests: AppRegistry address required for chain %s when enforcement enabled", id)
				}
				s.Logger().WithContext(context.Background()).Warnf("AppRegistry enforcement enabled but address missing for chain %s; disabling for this chain? (global enforcement still on)", id)
				// In multichain, global enforcement might be tricky if some chains miss registry
				// For now, we just warn. Functional check is done in validation logic.
			}
		}
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
	for _, chainCtx := range s.chains {
		if chainCtx.EventListener == nil || chainCtx.ServiceGatewayAddress == "" {
			continue
		}

		l := chainCtx.EventListener

		l.On("ServiceRequested", func(event *chain.ContractEvent) error {
			return s.handleServiceRequested(context.Background(), event)
		})
		l.On("ServiceFulfilled", func(event *chain.ContractEvent) error {
			return s.handleServiceFulfilled(context.Background(), event)
		})
		l.On("Platform_Notification", func(event *chain.ContractEvent) error {
			return s.handleNotificationEvent(context.Background(), event)
		})
		l.On("Notification", func(event *chain.ContractEvent) error {
			return s.handleNotificationEvent(context.Background(), event)
		})
		l.On("Platform_Metric", func(event *chain.ContractEvent) error {
			return s.handleMetricEvent(context.Background(), event)
		})
		l.On("Metric", func(event *chain.ContractEvent) error {
			return s.handleMetricEvent(context.Background(), event)
		})
		l.On("AppRegistered", func(event *chain.ContractEvent) error {
			return s.handleAppRegistryEvent(context.Background(), event)
		})
		l.On("AppUpdated", func(event *chain.ContractEvent) error {
			return s.handleAppRegistryEvent(context.Background(), event)
		})
		l.On("StatusChanged", func(event *chain.ContractEvent) error {
			return s.handleAppRegistryEvent(context.Background(), event)
		})
		l.On("PaymentReceived", func(event *chain.ContractEvent) error {
			return s.handlePaymentReceivedEvent(context.Background(), event)
		})
		l.OnAny(func(event *chain.ContractEvent) error {
			return s.handleMiniAppContractEvent(context.Background(), event)
		})
		if s.onchainTxUsage {
			l.OnTransaction(func(event *chain.TransactionEvent) error {
				return s.handleMiniAppTxEvent(context.Background(), event)
			})
		}

		listener := l // capture loop variable
		s.BaseService.AddWorker(func(ctx context.Context) {
			s.runEventListener(ctx, listener)
		})
	}
}

func (s *Service) runEventListener(ctx context.Context, l *chain.EventListener) {
	if l == nil {
		return
	}

	if err := l.Start(ctx); err != nil {
		s.Logger().WithContext(ctx).WithError(err).Warn("failed to start event listener")
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

	cfg, err := chain.LoadChainsConfig()
	if err == nil {
		for _, ch := range cfg.Chains {
			if ch.Type != chain.ChainTypeNeoN3 {
				continue
			}
			if magic > 0 && uint64(ch.NetworkMagic) == magic {
				return ch.ID
			}
		}
		for _, ch := range cfg.Chains {
			if ch.Type == chain.ChainTypeNeoN3 {
				return ch.ID
			}
		}
	}

	if magic > 0 {
		return fmt.Sprintf("neo-n3:%d", magic)
	}
	return "neo-n3-mainnet"
}

func (s *Service) getChainContext(chainID string) *ChainContext {
	s.chainsMu.RLock()
	defer s.chainsMu.RUnlock()
	if chainID == "" {
		return s.chains[s.defaultChainID]
	}
	return s.chains[chainID]
}

func normalizeContractAddress(value string) string {
	return chain.NormalizeContractAddress(value)
}

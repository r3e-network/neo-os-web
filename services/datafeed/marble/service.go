// Package neofeeds provides price feed aggregation service.
// This service implements a Push/Auto-Update pattern:
// - TEE periodically fetches prices from multiple sources
// - TEE aggregates and signs the price data
// - TEE anchors updates to the platform PriceFeed contract on-chain (optional)
// - User contracts (or the platform) read prices directly (no callback needed)
//
// Configuration can be loaded from YAML/JSON file for easy customization
// of data sources and feeds without code changes.
package neofeeds

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/crypto"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	gasbankclient "github.com/r3e-network/neo-miniapp-platform/infrastructure/gasbank/client"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/marble"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
	commonservice "github.com/r3e-network/neo-miniapp-platform/infrastructure/service"
	txproxytypes "github.com/r3e-network/neo-miniapp-platform/infrastructure/txproxy/types"
)

const (
	ServiceID   = "neofeeds"
	ServiceName = "NeoFeeds Service"
	Version     = "3.0.0"

	// Service fee per price update request (in GAS smallest unit)
	ServiceFeePerUpdate = 10000 // 0.0001 GAS
)

// Service implements the NeoFeeds service.
type Service struct {
	*commonservice.BaseService
	httpClient      *http.Client
	signingKey      []byte
	signingPrivKey  *ecdsa.PrivateKey
	signingPubKey   []byte
	chainlinkClient *ChainlinkClient
	strictMode      bool

	// Configuration
	config    *NeoFeedsConfig
	sources   map[string]*SourceConfig
	sourceSem chan struct{}

	// Chain interaction for push pattern
	chainClient     *chain.Client
	priceFeedHash   string
	priceFeed       *chain.PriceFeedContract
	txProxy         txproxytypes.Invoker
	attestationHash []byte
	publishPolicy   PublishPolicyConfig
	publishMu       sync.Mutex
	publishState    map[string]*pricePublishState
	updateInterval  time.Duration
	enableChainPush bool

	// Service fee deduction
	gasbank *gasbankclient.Client

	// Price response cache
	priceCache    map[string]*priceCacheEntry
	priceCacheMu  sync.RWMutex
	priceCacheTTL time.Duration

	// Singleflight deduplicates concurrent upstream fetches for the same pair.
	priceFlight singleflight.Group
}

// Config holds NeoFeeds service configuration.
type Config struct {
	Marble      *marble.Marble
	DB          database.RepositoryInterface
	ConfigFile  string          // Path to YAML/JSON config file (optional)
	FeedsConfig *NeoFeedsConfig // Direct config (optional, takes precedence over file)
	ArbitrumRPC string          // Arbitrum RPC URL for Chainlink feeds

	// Chain configuration for push pattern
	ChainClient     *chain.Client
	PriceFeedHash   string // Contract hash for platform PriceFeed (preferred)
	TxProxy         txproxytypes.Invoker
	UpdateInterval  time.Duration // How often to push prices on-chain (default: from config)
	EnableChainPush bool          // Enable automatic on-chain price updates

	// GasBank client for service fee deduction (optional)
	GasBank *gasbankclient.Client

	SourceConcurrency int
}

// New creates a new NeoFeeds service.
func New(cfg Config) (*Service, error) {
	if cfg.Marble == nil {
		return nil, fmt.Errorf("marble is required")
	}

	strict := runtime.StrictIdentityMode() || cfg.Marble.IsEnclave()

	requiredSecrets := []string(nil)
	if strict {
		requiredSecrets = []string{"NEOFEEDS_SIGNING_KEY"}
	}

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
		DB:      cfg.DB,
		// Signing key must be stable in production/enclave mode for verification.
		RequiredSecrets: requiredSecrets,
	})

	// Load configuration
	var feedsConfig *NeoFeedsConfig
	var err error

	switch {
	case cfg.FeedsConfig != nil:
		feedsConfig = cfg.FeedsConfig
	case cfg.ConfigFile != "":
		feedsConfig, err = LoadConfigFromFile(cfg.ConfigFile)
		if err != nil {
			return nil, fmt.Errorf("load config: %w", err)
		}
	default:
		feedsConfig = DefaultConfig()
	}

	// Ensure defaults are applied consistently regardless of whether the config
	// came from a file or was provided programmatically (tests, embedding, etc.).
	if err := feedsConfig.Validate(); err != nil {
		return nil, fmt.Errorf("validate config: %w", err)
	}

	// In production/SGX mode, enforce TLS for all outbound price sources.
	if strict {
		for i := range feedsConfig.Sources {
			src := &feedsConfig.Sources[i]
			raw := strings.TrimSpace(src.URL)
			if !strings.HasPrefix(strings.ToLower(raw), "https://") {
				return nil, fmt.Errorf("neofeeds: source %q url must use https in strict identity mode", src.ID)
			}
		}
		if rpc := strings.TrimSpace(cfg.ArbitrumRPC); rpc != "" && !strings.HasPrefix(strings.ToLower(rpc), "https://") {
			return nil, fmt.Errorf("neofeeds: ArbitrumRPC must use https in strict identity mode")
		}
	}

	// Use the Marble-provided external client (system roots, no mTLS). Apply
	// per-source timeouts via request contexts to avoid creating clients per call.
	httpClient := httputil.CopyHTTPClientWithTimeout(cfg.Marble.ExternalHTTPClient(), 0, true)
	httpClient.Transport = httputil.NewSafeTransport()

	// Use config-specified interval, then service config, then default
	updateInterval := feedsConfig.UpdateInterval
	if cfg.UpdateInterval > 0 {
		updateInterval = cfg.UpdateInterval
	}

	s := &Service{
		BaseService:     base,
		httpClient:      httpClient,
		strictMode:      strict,
		config:          feedsConfig,
		sources:         make(map[string]*SourceConfig),
		chainClient:     cfg.ChainClient,
		priceFeedHash:   cfg.PriceFeedHash,
		txProxy:         cfg.TxProxy,
		publishPolicy:   feedsConfig.PublishPolicy,
		publishState:    make(map[string]*pricePublishState),
		updateInterval:  updateInterval,
		enableChainPush: cfg.EnableChainPush,
		gasbank:         cfg.GasBank,
		priceCache:      make(map[string]*priceCacheEntry),
		priceCacheTTL:   15 * time.Second,
	}

	// Allow TTL override via environment variable.
	if ttlSec, ok := runtime.ParseEnvInt("PRICE_CACHE_TTL_SECONDS"); ok && ttlSec > 0 {
		s.priceCacheTTL = time.Duration(ttlSec) * time.Second
	}

	s.attestationHash = computeAttestationHash(cfg.Marble)

	if s.chainClient != nil && s.priceFeedHash != "" {
		s.priceFeed = chain.NewPriceFeedContract(s.chainClient, s.priceFeedHash)
	}

	// Load signing key and derive cached ECDSA keypair.
	if key, ok := cfg.Marble.Secret("NEOFEEDS_SIGNING_KEY"); ok && len(key) >= 32 {
		s.signingKey = key

		seed, err := crypto.DeriveKey(s.signingKey, nil, "price-signing", 32)
		if err != nil {
			return nil, fmt.Errorf("derive signing key: %w", err)
		}
		defer crypto.ZeroBytes(seed)

		curve := elliptic.P256()
		d := new(big.Int).SetBytes(seed)
		n := new(big.Int).Sub(curve.Params().N, big.NewInt(1))
		d.Mod(d, n)
		d.Add(d, big.NewInt(1))
		priv := &ecdsa.PrivateKey{PublicKey: ecdsa.PublicKey{Curve: curve}, D: d}
		priv.PublicKey.X, priv.PublicKey.Y = curve.ScalarBaseMult(d.Bytes())
		s.signingPrivKey = priv
		s.signingPubKey = crypto.PublicKeyToBytes(&priv.PublicKey)
	} else if strict {
		return nil, fmt.Errorf("neofeeds: NEOFEEDS_SIGNING_KEY is required and must be at least 32 bytes")
	} else {
		s.Logger().WithFields(nil).Warn("NEOFEEDS_SIGNING_KEY not configured; price responses will be unsigned (development/testing only)")
	}

	// Initialize optional Chainlink client (disabled unless ArbitrumRPC is set).
	// This keeps default behavior aligned with the platform blueprint: use 3
	// HTTP sources and median aggregation.
	if strings.TrimSpace(cfg.ArbitrumRPC) != "" {
		chainlinkClient, err := NewChainlinkClient(cfg.ArbitrumRPC)
		if err != nil {
			// Log warning but don't fail - will fall back to HTTP sources.
			s.Logger().WithError(err).Warn("chainlink client init failed")
		} else {
			s.chainlinkClient = chainlinkClient
		}
	}

	// Index sources by ID
	for i := range feedsConfig.Sources {
		src := &feedsConfig.Sources[i]
		s.sources[src.ID] = src
	}

	sourceConcurrency := cfg.SourceConcurrency
	if sourceConcurrency <= 0 {
		if parsed, ok := runtime.ParseEnvInt("NEOFEEDS_SOURCE_CONCURRENCY"); ok && parsed > 0 {
			sourceConcurrency = parsed
		} else {
			sourceConcurrency = 8
		}
	}
	s.sourceSem = make(chan struct{}, sourceConcurrency)

	// Register chain push worker if enabled.
	// The MiniApp platform uses PriceFeed as the on-chain anchor; legacy on-chain
	// service contracts are intentionally not supported here.
	if s.enableChainPush && strings.TrimSpace(s.priceFeedHash) == "" {
		if strict {
			return nil, fmt.Errorf("neofeeds: EnableChainPush requires PriceFeedHash configured")
		}
		s.Logger().WithFields(nil).Warn("EnableChainPush enabled but PriceFeedHash not configured; disabling on-chain anchoring")
		s.enableChainPush = false
	}

	if s.enableChainPush && s.priceFeedHash != "" && s.priceFeed == nil {
		if strict {
			return nil, fmt.Errorf("neofeeds: EnableChainPush requires chain client configured")
		}
		s.Logger().WithFields(nil).Warn("EnableChainPush enabled but chain client not configured; disabling on-chain anchoring")
		s.enableChainPush = false
	}

	if s.enableChainPush && s.priceFeedHash != "" && s.txProxy == nil {
		if strict {
			return nil, fmt.Errorf("neofeeds: EnableChainPush requires TxProxy configured")
		}
		s.Logger().WithFields(nil).Warn("EnableChainPush enabled but TxProxy not configured; disabling on-chain anchoring")
		s.enableChainPush = false
	}

	if s.enableChainPush && s.priceFeedHash != "" {
		if s.priceFeedHash != "" {
			base.WithHydrate(s.hydratePriceFeedState)
		}

		base.AddTickerWorker(s.updateInterval, func(ctx context.Context) error {
			s.pushPricesToChain(ctx)
			return nil
		}, commonservice.WithTickerWorkerName("chain-push"), commonservice.WithTickerWorkerImmediate())
	}

	// Register statistics provider for /info endpoint
	base.WithStats(s.statistics)

	// Register standard routes (/health, /info) plus service-specific routes
	base.RegisterStandardRoutes()
	s.registerRoutes()

	return s, nil
}

// statistics returns runtime statistics for the /info endpoint.
func (s *Service) statistics() map[string]any {
	enabledFeeds := s.GetEnabledFeeds()
	feedIDs := make([]string, len(enabledFeeds))
	for i := range enabledFeeds {
		feedIDs[i] = enabledFeeds[i].ID
	}

	stats := map[string]any{
		"sources":         len(s.sources),
		"feeds":           feedIDs,
		"update_interval": s.updateInterval.String(),
		"chain_push":      s.enableChainPush,
		"service_fee":     ServiceFeePerUpdate,
	}

	if s.priceFeedHash != "" {
		stats["pricefeed_hash"] = s.priceFeedHash
		stats["publish_policy"] = s.publishPolicySummary()
	}

	return stats
}

// GetConfig returns the current configuration.
func (s *Service) GetConfig() *NeoFeedsConfig {
	return s.config
}

// GetEnabledFeeds returns all enabled feeds.
func (s *Service) GetEnabledFeeds() []FeedConfig {
	return s.config.GetEnabledFeeds()
}

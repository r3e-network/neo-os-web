package txproxy

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/marble"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/middleware"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/runtime"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/security"
	commonservice "github.com/R3E-Network/neo-miniapps-platform/infrastructure/service"
)

const (
	ServiceID   = "txproxy"
	ServiceName = "Tx Proxy"
	Version     = "1.0.0"
)

type Service struct {
	*commonservice.BaseService

	allowlist *Allowlist
	// Optional platform contract addresses used for intent-based policy gating.
	gasAddress        string
	paymentHubAddress string
	governanceAddress string

	chainClient *chain.Client
	signer      chain.TEESigner

	replayProtection *security.ReplayProtection
	// Rate limiter for /invoke endpoint to prevent DoS attacks
	rateLimiter *middleware.RateLimiter
}

type Config struct {
	Marble *marble.Marble
	DB     database.RepositoryInterface

	ChainClient *chain.Client
	Signer      chain.TEESigner

	// Optional platform contract addresses. If not provided, txproxy attempts to
	// read them from environment variables via chain.ContractAddressesFromEnv().
	GasAddress        string
	PaymentHubAddress string
	GovernanceAddress string

	AllowlistRaw string
	Allowlist    *Allowlist

	ReplayWindow time.Duration
}

const defaultGASContractAddress = "0xd2a4cff31913016155e38e474a2c06d08be276cf"

func New(cfg Config) (*Service, error) {
	if cfg.Marble == nil {
		return nil, fmt.Errorf("txproxy: marble is required")
	}

	strict := runtime.StrictIdentityMode() || cfg.Marble.IsEnclave()

	allowlist := cfg.Allowlist
	if allowlist == nil {
		raw := strings.TrimSpace(cfg.AllowlistRaw)
		if raw == "" {
			if secret, ok := cfg.Marble.Secret("TXPROXY_ALLOWLIST"); ok && len(secret) > 0 {
				raw = strings.TrimSpace(string(secret))
			}
		}
		if raw == "" {
			raw = strings.TrimSpace(os.Getenv("TXPROXY_ALLOWLIST"))
		}

		parsed, err := ParseAllowlist(raw)
		if err != nil {
			return nil, err
		}
		allowlist = parsed
	}

	contracts := chain.ContractAddressesFromEnv()
	gasAddress := runtime.ResolveString(cfg.GasAddress, "CONTRACT_GAS_ADDRESS", defaultGASContractAddress)
	paymentHubAddress := runtime.ResolveString(cfg.PaymentHubAddress, "", strings.TrimSpace(contracts.PaymentHub))
	governanceAddress := runtime.ResolveString(cfg.GovernanceAddress, "", strings.TrimSpace(contracts.Governance))

	if strict {
		if cfg.ChainClient == nil {
			return nil, fmt.Errorf("txproxy: chain client is required in strict/enclave mode")
		}
		if cfg.Signer == nil {
			return nil, fmt.Errorf("txproxy: signer is required in strict/enclave mode")
		}
	}

	replayWindow := runtime.ResolveDuration(cfg.ReplayWindow, "", 1*time.Hour)

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
		DB:      cfg.DB,
	})

	// SECURITY FIX [M-02]: Limit replay cache size to prevent memory exhaustion
	const maxReplayEntries = 100000
	s := &Service{
		BaseService:       base,
		allowlist:         allowlist,
		gasAddress:        normalizeContractAddress(gasAddress),
		paymentHubAddress: normalizeContractAddress(paymentHubAddress),
		governanceAddress: normalizeContractAddress(governanceAddress),
		chainClient:       cfg.ChainClient,
		signer:            cfg.Signer,
		replayProtection:  security.NewReplayProtectionWithMaxSize(replayWindow, maxReplayEntries, base.Logger()),
		// SECURITY FIX [R-01]: Add rate limiting to prevent DoS attacks
		// Allow 100 requests per minute with burst of 200
		rateLimiter: middleware.NewRateLimiterWithWindow(100, time.Minute, 200, base.Logger()),
	}

	base.RegisterStandardRoutes()
	s.registerRoutes()

	// Start periodic cleanup of stale rate limiter entries to prevent memory leaks.
	s.rateLimiter.StartCleanup(5 * time.Minute)

	return s, nil
}

func (s *Service) registerRoutes() {
	// SECURITY FIX [R-01]: Apply rate limiting to /invoke endpoint to prevent DoS
	s.Router().Handle("/invoke",
		middleware.RequireServiceAuth(
			s.rateLimiter.Handler(
				http.HandlerFunc(s.handleInvoke),
			),
		),
	).Methods(http.MethodPost)
}

// markSeen checks if a request ID has been seen (replay protection).
// Returns true if the request is new and valid, false if it's a replay or empty.
func (s *Service) markSeen(requestID string) bool {
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		return false
	}
	return s.replayProtection.ValidateAndMark(requestID)
}

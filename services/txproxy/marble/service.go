package txproxy

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/marble"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/middleware"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/replay"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
	commonservice "github.com/r3e-network/neo-miniapp-platform/infrastructure/service"
)

const (
	ServiceID   = "txproxy"
	ServiceName = "Tx Proxy"
	Version     = "1.0.0"
)

type Service struct {
	*commonservice.BaseService

	allowlist *Allowlist
	// Optional platform contract hashes used for intent-based policy gating.
	gasHash        string
	paymentHubHash string
	governanceHash string

	chainClient *chain.Client
	signer      chain.TEESigner

	replayGuard *replay.Guard
}

type Config struct {
	Marble *marble.Marble
	DB     database.RepositoryInterface

	ChainClient *chain.Client
	Signer      chain.TEESigner

	// Optional platform contract hashes. If not provided, txproxy attempts to
	// read them from environment variables via chain.ContractAddressesFromEnv().
	GasHash        string
	PaymentHubHash string
	GovernanceHash string

	AllowlistRaw string
	Allowlist    *Allowlist

	ReplayWindow time.Duration
}

const defaultGASContractHash = "0xd2a4cff31913016155e38e474a2c06d08be276cf"

//nolint:gocritic // Config is passed by value intentionally for ergonomic call sites and immutable setup.
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
	gasHash := strings.TrimSpace(cfg.GasHash)
	if gasHash == "" {
		gasHash = strings.TrimSpace(os.Getenv("CONTRACT_GAS_HASH"))
	}
	if gasHash == "" {
		gasHash = defaultGASContractHash
	}
	paymentHubHash := strings.TrimSpace(cfg.PaymentHubHash)
	if paymentHubHash == "" {
		paymentHubHash = strings.TrimSpace(contracts.PaymentHub)
	}
	governanceHash := strings.TrimSpace(cfg.GovernanceHash)
	if governanceHash == "" {
		governanceHash = strings.TrimSpace(contracts.Governance)
	}

	if strict {
		if cfg.ChainClient == nil {
			return nil, fmt.Errorf("txproxy: chain client is required in strict/enclave mode")
		}
		if cfg.Signer == nil {
			return nil, fmt.Errorf("txproxy: signer is required in strict/enclave mode")
		}
	}

	replayWindow := cfg.ReplayWindow
	if replayWindow <= 0 {
		replayWindow = 10 * time.Minute
	}

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
		DB:      cfg.DB,
	})

	if allowlist != nil && len(allowlist.Contracts) == 0 {
		base.Logger().WithFields(nil).Warn("txproxy allowlist is empty; all invoke requests will be rejected")
	}

	s := &Service{
		BaseService:    base,
		allowlist:      allowlist,
		gasHash:        normalizeContractHash(gasHash),
		paymentHubHash: normalizeContractHash(paymentHubHash),
		governanceHash: normalizeContractHash(governanceHash),
		chainClient:    cfg.ChainClient,
		signer:         cfg.Signer,
	}

	var replayOpts []replay.Option
	if cfg.DB != nil {
		replayOpts = append(replayOpts, replay.WithDB(cfg.DB))
	}
	replayOpts = append(replayOpts, replay.WithLogger(func(msg string, err error) {
		s.Logger().WithError(err).Warn(msg)
	}))
	s.replayGuard = replay.New(ServiceID, replayWindow, replayOpts...)

	base.RegisterStandardRoutes()
	s.registerRoutes()

	// Best-effort cleanup of the replay cache.
	base.AddTickerWorker(1*time.Minute, func(ctx context.Context) error {
		s.replayGuard.Cleanup(ctx)
		return nil
	}, commonservice.WithTickerWorkerName("replay-cleanup"))

	return s, nil
}

func (s *Service) registerRoutes() {
	s.Router().Handle("/invoke", middleware.RequireServiceAuth(http.HandlerFunc(s.handleInvoke))).Methods(http.MethodPost)
}

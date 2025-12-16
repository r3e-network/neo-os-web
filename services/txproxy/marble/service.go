package txproxy

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
	"github.com/R3E-Network/service_layer/infrastructure/database"
	"github.com/R3E-Network/service_layer/infrastructure/marble"
	"github.com/R3E-Network/service_layer/infrastructure/middleware"
	"github.com/R3E-Network/service_layer/infrastructure/runtime"
	commonservice "github.com/R3E-Network/service_layer/infrastructure/service"
)

const (
	ServiceID   = "txproxy"
	ServiceName = "Tx Proxy"
	Version     = "1.0.0"
)

type Service struct {
	*commonservice.BaseService

	allowlist *Allowlist

	chainClient *chain.Client
	signer      chain.TEESigner

	replayWindow time.Duration
	replayMu     sync.Mutex
	seenRequests map[string]time.Time
}

type Config struct {
	Marble *marble.Marble
	DB     database.RepositoryInterface

	ChainClient *chain.Client
	Signer      chain.TEESigner

	AllowlistRaw string
	Allowlist    *Allowlist

	ReplayWindow time.Duration
}

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

	s := &Service{
		BaseService:   base,
		allowlist:     allowlist,
		chainClient:   cfg.ChainClient,
		signer:        cfg.Signer,
		replayWindow:  replayWindow,
		seenRequests:  make(map[string]time.Time),
	}

	base.RegisterStandardRoutes()
	s.registerRoutes()

	// Best-effort cleanup of the replay cache.
	base.AddTickerWorker(1*time.Minute, func(ctx context.Context) error {
		s.cleanupReplay()
		return nil
	}, commonservice.WithTickerWorkerName("replay-cleanup"))

	return s, nil
}

func (s *Service) registerRoutes() {
	s.Router().Handle("/invoke", middleware.RequireServiceAuth(http.HandlerFunc(s.handleInvoke))).Methods(http.MethodPost)
}

func (s *Service) markSeen(requestID string) bool {
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		return false
	}

	now := time.Now()
	s.replayMu.Lock()
	defer s.replayMu.Unlock()

	if until, ok := s.seenRequests[requestID]; ok && now.Before(until) {
		return false
	}

	s.seenRequests[requestID] = now.Add(s.replayWindow)
	return true
}

func (s *Service) cleanupReplay() {
	now := time.Now()
	s.replayMu.Lock()
	defer s.replayMu.Unlock()

	for key, until := range s.seenRequests {
		if now.After(until) {
			delete(s.seenRequests, key)
		}
	}
}


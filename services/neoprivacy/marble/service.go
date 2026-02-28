package neoprivacy

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
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
	commonservice "github.com/r3e-network/neo-miniapp-platform/infrastructure/service"
	txproxytypes "github.com/r3e-network/neo-miniapp-platform/infrastructure/txproxy/types"
)

const (
	ServiceID   = "neoprivacy"
	ServiceName = "Neo Privacy Relayer"
	Version     = "1.0.0"
)

type Service struct {
	*commonservice.BaseService
	chainClient    *chain.Client
	txProxyInvoker txproxytypes.Invoker
	contractHash   string
}

type Config struct {
	Marble         *marble.Marble
	DB             database.RepositoryInterface
	ChainClient    *chain.Client
	TxProxyInvoker txproxytypes.Invoker
	ContractHash   string
}

func New(cfg Config) (*Service, error) {
	if cfg.Marble == nil {
		return nil, fmt.Errorf("neoprivacy: marble is required")
	}

	strict := runtime.StrictIdentityMode() || cfg.Marble.IsEnclave()
	if strict && cfg.ChainClient == nil {
		return nil, fmt.Errorf("neoprivacy: chain client is required in strict/enclave mode")
	}

	contractHash := strings.TrimSpace(cfg.ContractHash)
	if contractHash == "" {
		if secret, ok := cfg.Marble.Secret("CONTRACT_ZNEP17_HASH"); ok && len(secret) > 0 {
			contractHash = strings.TrimSpace(string(secret))
		}
	}
	if contractHash == "" {
		contractHash = strings.TrimSpace(os.Getenv("CONTRACT_ZNEP17_HASH"))
	}

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
		DB:      cfg.DB,
	})

	s := &Service{
		BaseService:    base,
		chainClient:    cfg.ChainClient,
		txProxyInvoker: cfg.TxProxyInvoker,
		contractHash:   contractHash,
	}

	if contractHash == "" {
		base.Logger().Warn(context.Background(), "CONTRACT_ZNEP17_HASH not set, on-chain indexing will be disabled", nil)
	}

	// Register basic health and privacy routes
	base.RegisterStandardRoutes()
	s.registerRoutes()

	// Add background worker for polling ZNEP17 deposit events
	if s.chainClient != nil && s.contractHash != "" {
		base.AddTickerWorker(15*time.Second, s.pollDepositEvents, commonservice.WithTickerWorkerName("znep17-indexer"))
	}

	return s, nil
}

func (s *Service) registerRoutes() {
	router := s.Router()
	router.Handle("/api/v1/privacy/merkle-path/{commitment}", http.HandlerFunc(s.handleMerklePath)).Methods(http.MethodGet)
	router.Handle("/api/v1/privacy/relay", middleware.RequireServiceAuth(http.HandlerFunc(s.handleRelay))).Methods(http.MethodPost)
}

func (s *Service) pollDepositEvents(ctx context.Context) error {
	if s.chainClient == nil || s.contractHash == "" {
		return nil
	}

	// In a full production scenario, we would use s.db to query the latest processed block height
	// from the zNEP17_deposits table and only query logs from that point forward.
	// For now, we structure the polling to handle recent blocks securely.

	// Example structured logging and resilient block indexing pattern:
	height, err := s.chainClient.GetBlockCount(ctx)
	if err != nil {
		s.Logger().WithError(err).Error(ctx, "failed to get current block height for zNEP17 indexer", nil)
		return err
	}

	// This is where we would call s.chainClient.GetApplicationLogs(startBlock, height)
	// parse out DepositEvent, insert into Supabase, and calculate the new Poseidon Merkle Root.

	s.Logger().WithFields(map[string]interface{}{
		"contract": s.contractHash,
		"height":   height,
	}).Debug(ctx, "Polled latest blocks for ZNEP17 zero-knowledge commitments", nil)

	return nil
}

// Package neosimulation provides simulation service for automated transaction testing.
// This service simulates real user transactions by:
// - Requesting accounts from the pool
// - Simulating transactions (payGAS with random amounts)
// - Recording transactions to Supabase
// - Releasing accounts back to the pool
package neosimulation

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strings"
	"sync"
	"time"

	neoaccountsclient "github.com/r3e-network/neo-miniapp-platform/infrastructure/accountpool/client"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/nitro"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/runtime"
	commonservice "github.com/r3e-network/neo-miniapp-platform/infrastructure/service"
)

// Service implements the simulation service.
type Service struct {
	*commonservice.BaseService
	mu sync.RWMutex

	chainClient    *chain.Client
	db             database.RepositoryInterface
	accountPoolURL string
	poolClient     *neoaccountsclient.Client

	// Contract invoker for smart contract calls
	contractInvoker *ContractInvoker

	// MiniApp simulator for workflow simulation
	miniAppSimulator *MiniAppSimulator

	// Simulation configuration
	miniApps      []string
	minInterval   time.Duration
	maxInterval   time.Duration
	minAmount     int64
	maxAmount     int64
	workersPerApp int

	// Simulation state
	running     bool
	stopCh      chan struct{}
	wg          sync.WaitGroup
	startedAt   *time.Time
	txCounts    map[string]int64
	lastTxTimes map[string]time.Time
	rng         *rand.Rand
	rngMu       sync.Mutex
}

// New creates a new simulation service.
//
//nolint:gocritic // Config is passed by value intentionally for ergonomic call sites and immutable setup.
func New(cfg Config) (*Service, error) {
	if cfg.Nitro == nil {
		return nil, fmt.Errorf("neosimulation: nitro is required")
	}

	nitro, ok := cfg.Nitro.(*nitro.Nitro)
	if !ok {
		return nil, fmt.Errorf("neosimulation: invalid nitro type")
	}

	strict := runtime.StrictIdentityMode() || nitro.IsEnclave()

	if strict && cfg.ChainClient == nil {
		return nil, fmt.Errorf("neosimulation: chain client is required in strict/enclave mode")
	}

	// Type assert DB if provided
	var db database.RepositoryInterface
	if cfg.DB != nil {
		var ok bool
		db, ok = cfg.DB.(database.RepositoryInterface)
		if !ok {
			return nil, fmt.Errorf("neosimulation: DB must implement database.RepositoryInterface")
		}
	}

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Nitro:   nitro,
		DB:      db,
	})

	// Get account pool URL
	accountPoolURL := strings.TrimSpace(cfg.AccountPoolURL)
	if accountPoolURL == "" {
		accountPoolURL = strings.TrimSpace(os.Getenv("NEOACCOUNTS_SERVICE_URL"))
	}
	if accountPoolURL == "" {
		accountPoolURL = "https://neoaccounts:8085" // Default service mesh URL
	}

	// Get MiniApps list
	miniApps := normalizeMiniAppIDs(cfg.MiniApps)
	if len(miniApps) == 0 {
		miniAppsEnv := strings.TrimSpace(os.Getenv("SIMULATION_MINIAPPS"))
		if miniAppsEnv != "" {
			miniApps = normalizeMiniAppIDs(strings.Split(miniAppsEnv, ","))
		}
	}
	if len(miniApps) == 0 {
		allApps := AllMiniApps()
		miniApps = make([]string, 0, len(allApps))
		for _, app := range allApps {
			miniApps = append(miniApps, app.AppID)
		}
	}

	// Get interval configuration
	minIntervalMS := cfg.MinIntervalMS
	if minIntervalMS == 0 {
		if envVal := os.Getenv("SIMULATION_TX_INTERVAL_MIN_MS"); envVal != "" {
			if _, err := fmt.Sscanf(envVal, "%d", &minIntervalMS); err != nil {
				base.Logger().Warn(context.Background(), "invalid SIMULATION_TX_INTERVAL_MIN_MS: "+err.Error(), nil)
			}
		}
	}
	if minIntervalMS == 0 {
		minIntervalMS = DefaultMinIntervalMS
	}

	maxIntervalMS := cfg.MaxIntervalMS
	if maxIntervalMS == 0 {
		if envVal := os.Getenv("SIMULATION_TX_INTERVAL_MAX_MS"); envVal != "" {
			if _, err := fmt.Sscanf(envVal, "%d", &maxIntervalMS); err != nil {
				base.Logger().Warn(context.Background(), "invalid SIMULATION_TX_INTERVAL_MAX_MS: "+err.Error(), nil)
			}
		}
	}
	if maxIntervalMS == 0 {
		maxIntervalMS = DefaultMaxIntervalMS
	}

	// Get amount configuration
	minAmount := cfg.MinAmount
	if minAmount == 0 {
		minAmount = DefaultMinAmount
	}
	maxAmount := cfg.MaxAmount
	if maxAmount == 0 {
		maxAmount = DefaultMaxAmount
	}

	// Get workers per app configuration
	workersPerApp := cfg.WorkersPerApp
	if workersPerApp == 0 {
		if envVal := os.Getenv("SIMULATION_WORKERS_PER_APP"); envVal != "" {
			if _, err := fmt.Sscanf(envVal, "%d", &workersPerApp); err != nil {
				base.Logger().Warn(context.Background(), "invalid SIMULATION_WORKERS_PER_APP: "+err.Error(), nil)
			}
		}
	}
	if workersPerApp <= 0 {
		workersPerApp = DefaultWorkersPerApp
	}

	// Initialize account pool client with NitroRun mTLS client for secure mesh communication
	// NOTE: Don't send ServiceID when using NitroRun mTLS - let the neoaccounts service
	// use the NitroRun authenticated identity instead. This avoids service_id mismatch errors.
	poolClient, err := neoaccountsclient.New(neoaccountsclient.Config{
		BaseURL:    accountPoolURL,
		ServiceID:  "", // Empty to use NitroRun authenticated identity
		HTTPClient: nitro.HTTPClient(),
	})
	if err != nil {
		return nil, fmt.Errorf("neosimulation: failed to create account pool client: %w", err)
	}

	var chainClient *chain.Client
	if cfg.ChainClient != nil {
		var ok bool
		chainClient, ok = cfg.ChainClient.(*chain.Client)
		if !ok {
			return nil, fmt.Errorf("neosimulation: chain client must be *chain.Client")
		}
	}

	// Initialize contract invoker for smart contract calls using pool accounts
	// All signing happens inside the TEE via the account pool service
	var contractInvoker *ContractInvoker
	invoker, err := NewContractInvokerFromEnv(poolClient)
	if err != nil {
		// Log warning but don't fail - contract invocation is optional
		log.Printf("neosimulation: contract invoker disabled: %v", err)
	} else {
		contractInvoker = invoker
		log.Println("neosimulation: contract invoker initialized (using pool accounts)")
	}

	// Initialize MiniApp simulator if contract invoker is available
	var miniAppSimulator *MiniAppSimulator
	if contractInvoker != nil {
		// Use empty user addresses - will be populated from pool accounts
		miniAppSimulator = NewMiniAppSimulator(contractInvoker, []string{})
		log.Println("neosimulation: MiniApp simulator initialized for all 35 apps")
	}

	s := &Service{
		BaseService:      base,
		chainClient:      chainClient,
		db:               db,
		accountPoolURL:   accountPoolURL,
		poolClient:       poolClient,
		contractInvoker:  contractInvoker,
		miniAppSimulator: miniAppSimulator,
		miniApps:         miniApps,
		minInterval:      time.Duration(minIntervalMS) * time.Millisecond,
		maxInterval:      time.Duration(maxIntervalMS) * time.Millisecond,
		minAmount:        minAmount,
		maxAmount:        maxAmount,
		workersPerApp:    workersPerApp,
		running:          false,
		txCounts:         make(map[string]int64),
		lastTxTimes:      make(map[string]time.Time),
		// #nosec G404 -- simulation jitter/amount randomness is non-cryptographic by design.
		rng: rand.New(rand.NewSource(time.Now().UnixNano())),
	}

	// Register statistics provider for /info endpoint
	base.WithStats(s.statistics)

	// Register standard routes (/health, /info) plus service-specific routes
	base.RegisterStandardRoutes()
	s.registerRoutes()

	// Auto-start if configured
	if cfg.AutoStart || strings.ToLower(os.Getenv("SIMULATION_ENABLED")) == "true" {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					s.Logger().Error(context.Background(), "panic in simulation auto-start", fmt.Errorf("%v", r), nil)
				}
			}()
			time.Sleep(2 * time.Second) // Wait for service to fully initialize
			if err := s.Start(context.Background()); err != nil {
				s.Logger().WithError(err).Warn("failed to auto-start simulation")
			}
		}()
	}

	return s, nil
}

// statistics returns runtime statistics for the /info endpoint.
func (s *Service) statistics() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	miniApps := append([]string(nil), s.miniApps...)
	txCounts := make(map[string]int64, len(s.txCounts))
	for appID, count := range s.txCounts {
		txCounts[appID] = count
	}

	stats := map[string]any{
		"running":           s.running,
		"mini_apps":         miniApps,
		"workers_per_app":   s.workersPerApp,
		"min_interval_ms":   s.minInterval.Milliseconds(),
		"max_interval_ms":   s.maxInterval.Milliseconds(),
		"min_amount":        s.minAmount,
		"max_amount":        s.maxAmount,
		"tx_counts":         txCounts,
		"contract_invoker":  s.contractInvoker != nil,
		"miniapp_simulator": s.miniAppSimulator != nil,
	}

	// Add contract invocation stats if available
	if s.contractInvoker != nil {
		stats["contract_stats"] = s.contractInvoker.GetStats()
	}

	// Add MiniApp workflow stats if available
	if s.miniAppSimulator != nil {
		stats["miniapp_workflow_stats"] = s.miniAppSimulator.GetStats()
	}

	if s.startedAt != nil {
		stats["started_at"] = s.startedAt.Format(time.RFC3339)
		stats["uptime"] = time.Since(*s.startedAt).String()
	}

	return stats
}

// Start starts the simulation.
func (s *Service) Start(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return fmt.Errorf("simulation already running")
	}

	s.running = true
	s.stopCh = make(chan struct{})
	now := time.Now()
	s.startedAt = &now

	// NOTE: direct random GAS transfer workers are intentionally disabled.
	// Simulation now runs only through MiniApp workflow simulators to match production flow.

	// Start contract invocation workers if contract invoker is available
	if s.contractInvoker != nil {
		if s.contractInvoker.HasPriceFeed() {
			s.wg.Add(1)
			go func() { defer s.wg.Done(); s.runPriceFeedUpdater() }()
		}

		if s.contractInvoker.HasRandomnessLog() {
			s.wg.Add(1)
			go func() { defer s.wg.Done(); s.runRandomnessRecorder() }()
		}

		s.wg.Add(1)
		go func() { defer s.wg.Done(); s.runAutoTopUp() }()

		s.Logger().WithContext(ctx).Info("contract invocation workers started")
	}

	// Start MiniApp workflow simulators if MiniApp simulator is available
	miniAppWorkers := 0
	if s.miniAppSimulator != nil {
		miniAppWorkers = s.startMiniAppWorkflows(ctx)
	}

	// Start automation task auto top-up worker if chain client is available
	if s.chainClient != nil && s.poolClient != nil {
		s.wg.Add(1)
		go func() { defer s.wg.Done(); s.runAutomationTaskTopUp() }()
	}

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"mini_apps":         s.miniApps,
		"workers_per_app":   s.workersPerApp,
		"miniapp_workers":   miniAppWorkers,
		"contract_invoker":  s.contractInvoker != nil,
		"miniapp_simulator": s.miniAppSimulator != nil,
	}).Info("simulation started")

	return nil
}

// Stop stops the simulation.
func (s *Service) Stop() error {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return fmt.Errorf("simulation not running")
	}

	s.running = false
	close(s.stopCh)
	s.startedAt = nil
	contractInvoker := s.contractInvoker
	s.mu.Unlock()

	s.wg.Wait()

	if contractInvoker != nil {
		contractInvoker.Close()
	}

	s.Logger().WithContext(context.Background()).Info("simulation stopped")

	return s.BaseService.Stop()
}

// GetStatus returns the current simulation status.
func (s *Service) GetStatus() *SimulationStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	miniApps := append([]string(nil), s.miniApps...)

	status := &SimulationStatus{
		Running:       s.running,
		MiniApps:      miniApps,
		MinIntervalMS: int(s.minInterval.Milliseconds()),
		MaxIntervalMS: int(s.maxInterval.Milliseconds()),
		TxCounts:      make(map[string]int64),
		LastTxTimes:   make(map[string]string),
		StartedAt:     s.startedAt,
	}

	for appID, count := range s.txCounts {
		status.TxCounts[appID] = count
	}

	for appID, t := range s.lastTxTimes {
		status.LastTxTimes[appID] = t.Format(time.RFC3339)
	}

	if s.startedAt != nil {
		status.Uptime = time.Since(*s.startedAt).String()
	}

	return status
}

// randomInterval returns a random interval between minInterval and maxInterval.
func (s *Service) randomInterval() time.Duration {
	s.mu.RLock()
	minInterval := s.minInterval
	maxInterval := s.maxInterval
	s.mu.RUnlock()

	minMS := minInterval.Milliseconds()
	maxMS := maxInterval.Milliseconds()

	if minMS >= maxMS {
		return minInterval
	}

	s.rngMu.Lock()
	randomMS := minMS + s.rng.Int63n(maxMS-minMS+1)
	s.rngMu.Unlock()
	return time.Duration(randomMS) * time.Millisecond
}

// randomAmount returns a random amount between minAmount and maxAmount.
func (s *Service) randomAmount() int64 {
	s.mu.RLock()
	minAmount := s.minAmount
	maxAmount := s.maxAmount
	s.mu.RUnlock()

	if minAmount >= maxAmount {
		return minAmount
	}

	s.rngMu.Lock()
	randomAmount := minAmount + s.rng.Int63n(maxAmount-minAmount+1)
	s.rngMu.Unlock()
	return randomAmount
}

// recordTransaction records a simulated transaction to the database.
func (s *Service) recordTransaction(ctx context.Context, tx *SimulationTx) error {
	if s.db == nil {
		// No database configured - just log the transaction
		s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
			"app_id":  tx.AppID,
			"address": tx.AccountAddress,
			"tx_type": tx.TxType,
			"amount":  tx.Amount,
		}).Debug("simulated transaction (no db)")
		return nil
	}

	// Type assert to *database.Repository for GenericCreate
	repo, ok := s.db.(*database.Repository)
	if !ok {
		return fmt.Errorf("database is not *database.Repository")
	}

	// Use Supabase generic create
	type SimulationTxDB struct {
		AppID          string    `json:"app_id"`
		AccountAddress string    `json:"account_address"`
		TxType         string    `json:"tx_type"`
		Amount         int64     `json:"amount"`
		Status         string    `json:"status"`
		TxHash         string    `json:"tx_hash,omitempty"`
		CreatedAt      time.Time `json:"created_at"`
	}

	record := SimulationTxDB{
		AppID:          tx.AppID,
		AccountAddress: tx.AccountAddress,
		TxType:         tx.TxType,
		Amount:         tx.Amount,
		Status:         tx.Status,
		TxHash:         tx.TxHash,
		CreatedAt:      tx.CreatedAt,
	}

	// Insert using generic repository method
	err := database.GenericCreate(repo, ctx, "simulation_transactions", &record, nil)
	if err != nil {
		return fmt.Errorf("insert simulation_transactions: %w", err)
	}

	return nil
}

func normalizeMiniAppIDs(appIDs []string) []string {
	if len(appIDs) == 0 {
		return nil
	}
	normalized := make([]string, 0, len(appIDs))
	for _, appID := range appIDs {
		normalizedID := normalizeMiniAppID(appID)
		if normalizedID != "" {
			normalized = append(normalized, normalizedID)
		}
	}
	return normalized
}

func normalizeMiniAppID(appID string) string {
	trimmed := strings.TrimSpace(appID)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(trimmed, "miniapp-") {
		return trimmed
	}
	return "miniapp-" + trimmed
}

func shortHash(hash string) string {
	if len(hash) <= 16 {
		return hash
	}
	return hash[:16] + "..."
}

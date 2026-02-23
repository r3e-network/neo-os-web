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
	"math/big"
	"math/rand"
	"os"
	"strings"
	"sync"
	"time"

	neoaccountsclient "github.com/r3e-network/neo-miniapp-platform/infrastructure/accountpool/client"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/marble"
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
	if cfg.Marble == nil {
		return nil, fmt.Errorf("neosimulation: marble is required")
	}

	marble, ok := cfg.Marble.(*marble.Marble)
	if !ok {
		return nil, fmt.Errorf("neosimulation: invalid marble type")
	}

	strict := runtime.StrictIdentityMode() || marble.IsEnclave()

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
		Marble:  marble,
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

	// Initialize account pool client with MarbleRun mTLS client for secure mesh communication
	// NOTE: Don't send ServiceID when using MarbleRun mTLS - let the neoaccounts service
	// use the MarbleRun authenticated identity instead. This avoids service_id mismatch errors.
	poolClient, err := neoaccountsclient.New(neoaccountsclient.Config{
		BaseURL:    accountPoolURL,
		ServiceID:  "", // Empty to use MarbleRun authenticated identity
		HTTPClient: marble.HTTPClient(),
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
		rng:              rand.New(rand.NewSource(time.Now().UnixNano())),
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
	err := database.GenericCreate(repo, ctx, "simulation_txs", &record, nil)
	if err != nil {
		return fmt.Errorf("insert simulation_txs: %w", err)
	}

	return nil
}

// runPriceFeedUpdater runs the PriceFeed update loop.
func (s *Service) runPriceFeedUpdater() {
	ctx := context.Background()
	defer func() {
		if r := recover(); r != nil {
			s.Logger().WithField("panic", r).Error("worker panicked")
		}
	}()
	logger := s.Logger().WithFields(map[string]interface{}{"worker": "pricefeed"})

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			logger.WithContext(ctx).Info("stopping PriceFeed updater")
			return
		case <-ticker.C:
			for _, symbol := range s.contractInvoker.GetPriceSymbols() {
				txHash, err := s.contractInvoker.UpdatePriceFeed(ctx, symbol)
				if err != nil {
					logger.WithError(err).WithField("symbol", symbol).Warn("PriceFeed update failed")
				} else {
					logger.WithFields(map[string]interface{}{
						"symbol":  symbol,
						"tx_hash": shortHash(txHash),
					}).Debug("PriceFeed updated")
				}
				time.Sleep(500 * time.Millisecond) // Small delay between updates
			}
		}
	}
}

// runRandomnessRecorder runs the RandomnessLog record loop.
func (s *Service) runRandomnessRecorder() {
	ctx := context.Background()
	defer func() {
		if r := recover(); r != nil {
			s.Logger().WithField("panic", r).Error("worker panicked")
		}
	}()
	logger := s.Logger().WithFields(map[string]interface{}{"worker": "randomness"})

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			logger.WithContext(ctx).Info("stopping RandomnessLog recorder")
			return
		case <-ticker.C:
			txHash, err := s.contractInvoker.RecordRandomness(ctx)
			if err != nil {
				logger.WithError(err).Warn("RandomnessLog record failed")
			} else {
				logger.WithFields(map[string]interface{}{
					"tx_hash": shortHash(txHash),
				}).Debug("RandomnessLog recorded")
			}
		}
	}
}

// runMiniAppWorkflow runs a MiniApp workflow simulation loop.
func (s *Service) runMiniAppWorkflow(appID string, workerID int, workflowFn func(context.Context) error) {
	defer func() {
		if r := recover(); r != nil {
			s.Logger().WithField("panic", r).Error("miniapp workflow worker panicked")
		}
	}()
	ctx := context.Background()
	logger := s.Logger().WithFields(map[string]interface{}{
		"worker":    "miniapp",
		"app_id":    appID,
		"worker_id": workerID,
	})

	// Stagger start times based on app name
	time.Sleep(time.Duration(len(appID)%5) * time.Second)

	s.mu.RLock()
	minInterval := s.minInterval
	maxInterval := s.maxInterval
	s.mu.RUnlock()
	logger.WithContext(ctx).WithFields(map[string]interface{}{
		"min_interval": minInterval.String(),
		"max_interval": maxInterval.String(),
	}).Info("starting MiniApp workflow simulator")

	for {
		interval := s.randomInterval()
		timer := time.NewTimer(interval)
		select {
		case <-s.stopCh:
			if !timer.Stop() {
				<-timer.C
			}
			logger.WithContext(ctx).Info("stopping MiniApp workflow simulator")
			return
		case <-timer.C:
			err := workflowFn(ctx)
			if err != nil {
				logger.WithError(err).Warn("MiniApp workflow failed")
			} else {
				logger.WithContext(ctx).Debug("MiniApp workflow completed")
			}
		}
	}
}

func (s *Service) startMiniAppWorkflows(ctx context.Context) int {
	workflowByAppID := buildWorkflowByAppID(map[miniAppWorkflowKey]func(context.Context) error{
		workflowLottery:          s.miniAppSimulator.SimulateLottery,
		workflowCoinFlip:         s.miniAppSimulator.SimulateCoinFlip,
		workflowDiceGame:         s.miniAppSimulator.SimulateDiceGame,
		workflowScratchCard:      s.miniAppSimulator.SimulateScratchCard,
		workflowMegaMillions:     s.miniAppSimulator.SimulateMegaMillions,
		workflowGasSpin:          s.miniAppSimulator.SimulateGasSpin,
		workflowNeoCrash:         s.miniAppSimulator.SimulateNeoCrash,
		workflowThroneOfGas:      s.miniAppSimulator.SimulateThroneOfGas,
		workflowDoomsdayClock:    s.miniAppSimulator.SimulateDoomsdayClock,
		workflowSchrodingerNFT:   s.miniAppSimulator.SimulateSchrodingerNFT,
		workflowAlgoBattle:       s.miniAppSimulator.SimulateAlgoBattle,
		workflowPredictionMarket: s.miniAppSimulator.SimulatePredictionMarket,
		workflowFlashLoan:        s.miniAppSimulator.SimulateFlashLoan,
		workflowPriceTicker:      s.miniAppSimulator.SimulatePriceTicker,
		workflowPricePredict:     s.miniAppSimulator.SimulatePricePredict,
		workflowTurboOptions:     s.miniAppSimulator.SimulateTurboOptions,
		workflowILGuard:          s.miniAppSimulator.SimulateILGuard,
		workflowCandleWars:       s.miniAppSimulator.SimulateCandleWars,
		workflowDutchAuction:     s.miniAppSimulator.SimulateDutchAuction,
		workflowParasite:         s.miniAppSimulator.SimulateParasite,
		workflowNoLossLottery:    s.miniAppSimulator.SimulateNoLossLottery,
		workflowSecretVote:       s.miniAppSimulator.SimulateSecretVote,
		workflowSecretPoker:      s.miniAppSimulator.SimulateSecretPoker,
		workflowMicroPredict:     s.miniAppSimulator.SimulateMicroPredict,
		workflowRedEnvelope:      s.miniAppSimulator.SimulateRedEnvelope,
		workflowGasCircle:        s.miniAppSimulator.SimulateGasCircle,
		workflowPayToView:        s.miniAppSimulator.SimulatePayToView,
		workflowTimeCapsule:      s.miniAppSimulator.SimulateTimeCapsule,
		workflowGovBooster:       s.miniAppSimulator.SimulateGovBooster,
		workflowAITrader:         s.miniAppSimulator.SimulateAITrader,
		workflowGridBot:          s.miniAppSimulator.SimulateGridBot,
		workflowNFTEvolve:        s.miniAppSimulator.SimulateNFTEvolve,
		workflowBridgeGuardian:   s.miniAppSimulator.SimulateBridgeGuardian,
		workflowFogChess:         s.miniAppSimulator.SimulateFogChess,
		workflowGardenOfNeo:      s.miniAppSimulator.SimulateGardenOfNeo,
		workflowDevTipping:       s.miniAppSimulator.SimulateDevTipping,
		workflowAirdrop:          s.miniAppSimulator.SimulateAirdrop,
		workflowDAOVoting:        s.miniAppSimulator.SimulateDaoVoting,
		workflowGacha:            s.miniAppSimulator.SimulateGacha,
	})

	apps := normalizeMiniAppIDs(s.miniApps)
	if len(apps) == 0 {
		allApps := AllMiniApps()
		apps = make([]string, 0, len(allApps))
		for _, app := range allApps {
			apps = append(apps, app.AppID)
		}
	}

	started := 0
	for _, appID := range apps {
		normalizedID := normalizeMiniAppID(appID)
		if normalizedID == "" {
			continue
		}
		workflow, ok := workflowByAppID[normalizedID]
		if !ok {
			s.Logger().WithContext(ctx).WithField("app_id", appID).Warn("unknown miniapp id; skipping")
			continue
		}
		for workerID := 0; workerID < s.workersPerApp; workerID++ {
			s.wg.Add(1)
			go func(id string, wid int, wf func(context.Context) error) {
				defer s.wg.Done()
				s.runMiniAppWorkflow(id, wid, wf)
			}(normalizedID, workerID, workflow)
			started++
		}
	}

	if started > 0 {
		s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
			"mini_apps":       apps,
			"workers_per_app": s.workersPerApp,
			"total_workers":   started,
			"min_interval":    s.minInterval.String(),
			"max_interval":    s.maxInterval.String(),
		}).Info("MiniApp workflow simulators started")
	} else {
		s.Logger().WithContext(ctx).Warn("MiniApp workflow simulators not started (no valid apps configured)")
	}

	return started
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

// runAutoTopUp periodically checks for pool accounts with low GAS balance and funds them.
// This ensures pool accounts have enough GAS to pay for transaction fees.
func (s *Service) runAutoTopUp() {
	ctx := context.Background()
	defer func() {
		if r := recover(); r != nil {
			s.Logger().WithField("panic", r).Error("worker panicked")
		}
	}()
	logger := s.Logger().WithFields(map[string]interface{}{"worker": "auto-topup"})

	// Wait for initial setup
	time.Sleep(5 * time.Second)

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	logger.WithContext(ctx).Info("starting auto top-up worker for pool accounts")

	// Minimum GAS balance threshold (0.1 GAS = 10000000 in 8 decimals)
	const minGASBalance int64 = 10000000
	// Amount to fund when balance is low (1 GAS = 100000000 in 8 decimals)
	const fundAmount int64 = 100000000

	for {
		select {
		case <-s.stopCh:
			logger.WithContext(ctx).Info("stopping auto top-up worker")
			return
		case <-ticker.C:
			// Get accounts with low GAS balance
			accounts, err := s.poolClient.ListLowBalanceAccounts(ctx, "GAS", minGASBalance, 10)
			if err != nil {
				logger.WithError(err).Warn("failed to list low balance accounts")
				continue
			}

			if len(accounts) == 0 {
				logger.WithContext(ctx).Debug("no accounts need top-up")
				continue
			}

			logger.WithContext(ctx).WithField("count", len(accounts)).Info("found accounts with low GAS balance")

			// Fund each account
			for i := range accounts {
				acc := &accounts[i]
				_, err := s.poolClient.FundAccount(ctx, acc.Address, fundAmount)
				if err != nil {
					logger.WithError(err).WithFields(map[string]interface{}{
						"account_id": acc.ID,
						"address":    acc.Address,
					}).Warn("failed to fund account")
					continue
				}

				logger.WithFields(map[string]interface{}{
					"account_id": acc.ID,
					"address":    acc.Address,
					"amount":     fundAmount,
				}).Info("funded pool account")

				// Small delay between funding operations
				time.Sleep(2 * time.Second)
			}
		}
	}
}

// runAutomationTaskTopUp periodically checks AutomationAnchor periodic tasks with low GAS balance and funds them.
// This ensures periodic automation tasks have enough GAS to pay for execution fees.
// Task IDs are configured via SIMULATION_AUTOMATION_TASK_IDS environment variable (comma-separated list of task IDs).
func (s *Service) runAutomationTaskTopUp() {
	ctx := context.Background()
	defer func() {
		if r := recover(); r != nil {
			s.Logger().WithField("panic", r).Error("worker panicked")
		}
	}()
	logger := s.Logger().WithFields(map[string]interface{}{"worker": "automation-topup"})

	// Get AutomationAnchor contract hash from environment
	automationAnchorHash := strings.TrimSpace(os.Getenv("CONTRACT_AUTOMATIONANCHOR_HASH"))
	if automationAnchorHash == "" {
		logger.WithContext(ctx).Warn("automation task top-up disabled: CONTRACT_AUTOMATIONANCHOR_HASH not set")
		return
	}

	// Get task IDs to monitor from environment
	taskIDsEnv := strings.TrimSpace(os.Getenv("SIMULATION_AUTOMATION_TASK_IDS"))
	if taskIDsEnv == "" {
		logger.WithContext(ctx).Debug("automation task top-up disabled: no task IDs configured in SIMULATION_AUTOMATION_TASK_IDS")
		return
	}

	// Parse task IDs (comma-separated list of integers)
	var taskIDs []int64
	for _, idStr := range strings.Split(taskIDsEnv, ",") {
		idStr = strings.TrimSpace(idStr)
		if idStr == "" {
			continue
		}
		var taskID int64
		if _, err := fmt.Sscanf(idStr, "%d", &taskID); err != nil {
			logger.WithContext(ctx).WithError(err).WithField("task_id_str", idStr).Warn("invalid task ID in SIMULATION_AUTOMATION_TASK_IDS")
			continue
		}
		taskIDs = append(taskIDs, taskID)
	}

	if len(taskIDs) == 0 {
		logger.WithContext(ctx).Debug("automation task top-up disabled: no valid task IDs found")
		return
	}

	// Initialize AutomationAnchor contract client
	automationAnchor := chain.NewAutomationAnchorContract(s.chainClient, automationAnchorHash)
	if automationAnchor == nil {
		logger.WithContext(ctx).Warn("automation task top-up disabled: failed to initialize AutomationAnchor contract")
		return
	}

	logger.WithContext(ctx).WithFields(map[string]interface{}{
		"task_ids":       taskIDs,
		"task_count":     len(taskIDs),
		"check_interval": "60s",
	}).Info("starting automation task auto top-up worker")

	// Minimum GAS balance threshold (1 GAS = 100000000 in 8 decimals)
	const minTaskBalance int64 = 100000000
	// Amount to fund when balance is low (10 GAS = 1000000000 in 8 decimals)
	const topUpAmount int64 = 1000000000

	// Wait for initial setup
	time.Sleep(10 * time.Second)

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			logger.WithContext(ctx).Info("stopping automation task top-up worker")
			return
		case <-ticker.C:
			// Check each task's balance
			for _, taskID := range taskIDs {
				taskIDBigInt := big.NewInt(taskID)

				// Query task balance from AutomationAnchor contract
				// Note: AutomationAnchor.BalanceOf(taskId) returns BigInteger
				balance, err := automationAnchor.BalanceOf(ctx, taskIDBigInt)
				if err != nil {
					logger.WithError(err).WithField("task_id", taskID).Warn("failed to get task balance")
					continue
				}

				logger.WithFields(map[string]interface{}{
					"task_id": taskID,
					"balance": balance.Int64(),
				}).Debug("checked automation task balance")

				// Check if balance is below threshold
				if balance.Int64() < minTaskBalance {
					logger.WithFields(map[string]interface{}{
						"task_id":   taskID,
						"balance":   balance,
						"threshold": minTaskBalance,
						"top_up":    topUpAmount,
					}).Info("automation task balance low, funding task")

					// Fund the task by transferring GAS to AutomationAnchor contract with taskId as data
					// This calls AutomationAnchor.OnNEP17Payment which credits the task balance
					err := s.fundAutomationTask(ctx, automationAnchorHash, taskID, topUpAmount)
					if err != nil {
						logger.WithError(err).WithFields(map[string]interface{}{
							"task_id": taskID,
							"amount":  topUpAmount,
						}).Warn("failed to fund automation task")
						continue
					}

					logger.WithFields(map[string]interface{}{
						"task_id": taskID,
						"amount":  topUpAmount,
					}).Info("funded automation task")

					// Small delay between funding operations
					time.Sleep(5 * time.Second)
				}
			}
		}
	}
}

// fundAutomationTask funds an automation task by transferring GAS to AutomationAnchor with taskId as data.
func (s *Service) fundAutomationTask(ctx context.Context, contractHash string, taskID, amount int64) error {
	// Use poolClient.TransferWithData to send GAS to AutomationAnchor contract
	// The taskId is passed as data, which triggers OnNEP17Payment callback

	// Get or request a pool account for funding tasks
	resp, err := s.poolClient.RequestAccounts(ctx, 1, "automation-funding")
	if err != nil {
		return fmt.Errorf("request account: %w", err)
	}

	if len(resp.Accounts) == 0 {
		return fmt.Errorf("no accounts available in pool")
	}

	account := resp.Accounts[0]
	defer func() {
		// Release account back to pool
		if _, releaseErr := s.poolClient.ReleaseAccounts(ctx, []string{account.ID}); releaseErr != nil {
			s.Logger().WithContext(ctx).WithError(releaseErr).WithField("account_id", account.ID).Warn("failed to release automation funding account")
		}
	}()

	// Check if account has sufficient balance
	gasBalance := int64(0)
	if gb, ok := account.Balances["GAS"]; ok {
		gasBalance = gb.Amount
	}

	// Fund account if needed (need amount + tx fee)
	const minBalanceNeeded = int64(1100000000) // 11 GAS (10 for transfer + 1 for fee)
	if gasBalance < minBalanceNeeded {
		_, fundErr := s.poolClient.FundAccount(ctx, account.Address, minBalanceNeeded)
		if fundErr != nil {
			return fmt.Errorf("fund account: %w", fundErr)
		}
		// Wait for funding to confirm
		time.Sleep(5 * time.Second)
	}

	// Transfer GAS to AutomationAnchor with taskId as data
	// This will trigger AutomationAnchor.OnNEP17Payment(from, amount, taskId)
	// The data parameter should be the taskID as a string (will be converted to BigInteger by the contract)
	taskIDStr := fmt.Sprintf("%d", taskID)
	transferResp, err := s.poolClient.TransferWithData(ctx, account.ID, "0x"+contractHash, amount, taskIDStr)
	if err != nil {
		return fmt.Errorf("transfer to automation anchor: %w", err)
	}

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"task_id": taskID,
		"amount":  amount,
		"tx_hash": transferResp.TxHash,
	}).Debug("automation task funding transaction submitted")

	return nil
}

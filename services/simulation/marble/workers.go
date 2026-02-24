package neosimulation

import (
	"context"
	"time"
)

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

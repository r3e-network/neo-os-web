package neosimulation

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"
)

// SimulateGovBooster simulates bNEO governance optimization.
func (s *MiniAppSimulator) SimulateGovBooster(ctx context.Context) error {
	appID := "builtin-gov-booster"
	amount := int64(1000000)

	memo := fmt.Sprintf("gov:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("gov booster: %w", err)
	}
	atomic.AddInt64(&s.govBoosterVotes, 1)
	return nil
}

// SimulateAITrader simulates autonomous AI trading.
func (s *MiniAppSimulator) SimulateAITrader(ctx context.Context) error {
	appID := "builtin-ai-trader"
	amount := int64(10000000)

	memo := fmt.Sprintf("ai:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("ai trader: %w", err)
	}
	return nil
}

// SimulateGridBot simulates automated grid trading.
func (s *MiniAppSimulator) SimulateGridBot(ctx context.Context) error {
	appID := "builtin-grid-bot"
	amount := int64(5000000)

	memo := fmt.Sprintf("grid:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("grid bot: %w", err)
	}
	return nil
}

// SimulateNFTEvolve simulates dynamic NFT evolution.
func (s *MiniAppSimulator) SimulateNFTEvolve(ctx context.Context) error {
	appID := "builtin-nft-evolve"
	amount := int64(1000000)

	memo := fmt.Sprintf("nft:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("nft evolve: %w", err)
	}
	return nil
}

// SimulateBridgeGuardian simulates cross-chain bridge.
func (s *MiniAppSimulator) SimulateBridgeGuardian(ctx context.Context) error {
	appID := "builtin-bridge-guardian"
	amount := int64(30000000)

	memo := fmt.Sprintf("bridge:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("bridge: %w", err)
	}
	return nil
}

// SimulateFogChess simulates chess with fog of war.
func (s *MiniAppSimulator) SimulateFogChess(ctx context.Context) error {
	appID := "builtin-fog-chess"
	amount := int64(10000000)

	memo := fmt.Sprintf("chess:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("fog chess: %w", err)
	}
	atomic.AddInt64(&s.fogChessGames, 1)

	if randomInt(0, 1) == 1 {
		atomic.AddInt64(&s.fogChessWins, 1)
		winnerAddress := s.getRandomUserAddress()
		_, _ = s.invoker.PayoutToUser(ctx, appID, winnerAddress, int64(float64(amount)*1.8), "chess:win")
	}
	return nil
}

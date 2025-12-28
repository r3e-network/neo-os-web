package neosimulation

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"
)

// SimulatePredictionMarket simulates the prediction market workflow.
func (s *MiniAppSimulator) SimulatePredictionMarket(ctx context.Context) error {
	appID := "builtin-prediction-market"
	amount := int64(20000000)
	direction := randomInt(0, 1)

	memo := fmt.Sprintf("predict:%s:%d", []string{"down", "up"}[direction], time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place prediction: %w", err)
	}
	atomic.AddInt64(&s.predictionBets, 1)

	if randomInt(0, 1) == direction {
		atomic.AddInt64(&s.predictionResolves, 1)
		winnerAddress := s.getRandomUserAddress()
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*2, "predict:win")
		if err == nil {
			atomic.AddInt64(&s.predictionPayouts, 1)
		}
	}
	return nil
}

// SimulateFlashLoan simulates the flash loan workflow.
func (s *MiniAppSimulator) SimulateFlashLoan(ctx context.Context) error {
	appID := "builtin-flashloan"
	amount := int64(100000000)

	memo := fmt.Sprintf("flash:borrow:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, 1000000, memo) // 0.01 GAS fee
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("flash loan: %w", err)
	}
	atomic.AddInt64(&s.flashloanBorrows, 1)
	atomic.AddInt64(&s.flashloanRepays, 1)
	return nil
}

// SimulatePriceTicker simulates the price ticker query workflow.
func (s *MiniAppSimulator) SimulatePriceTicker(ctx context.Context) error {
	atomic.AddInt64(&s.priceQueries, 1)
	return nil
}

// SimulatePricePredict simulates binary price prediction.
func (s *MiniAppSimulator) SimulatePricePredict(ctx context.Context) error {
	appID := "builtin-price-predict"
	amount := int64(10000000)
	direction := randomInt(0, 1)

	memo := fmt.Sprintf("ppredict:%s:%d", []string{"down", "up"}[direction], time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("price predict: %w", err)
	}
	atomic.AddInt64(&s.pricePredictBets, 1)

	if randomInt(0, 1) == 1 {
		atomic.AddInt64(&s.pricePredictWins, 1)
		winnerAddress := s.getRandomUserAddress()
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, int64(float64(amount)*1.9), "ppredict:win")
		if err == nil {
			atomic.AddInt64(&s.pricePredictPayouts, 1)
		}
	}
	return nil
}

// SimulateTurboOptions simulates ultra-fast binary options.
func (s *MiniAppSimulator) SimulateTurboOptions(ctx context.Context) error {
	appID := "builtin-turbo-options"
	amount := int64(50000000)
	direction := randomInt(0, 1)

	memo := fmt.Sprintf("turbo:%s:%d", []string{"down", "up"}[direction], time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("turbo option: %w", err)
	}
	atomic.AddInt64(&s.turboOptionsBets, 1)

	if randomInt(0, 1) == 1 {
		atomic.AddInt64(&s.turboOptionsWins, 1)
		winnerAddress := s.getRandomUserAddress()
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, int64(float64(amount)*1.8), "turbo:win")
		if err == nil {
			atomic.AddInt64(&s.turboOptionsPayouts, 1)
		}
	}
	return nil
}

// SimulateILGuard simulates impermanent loss protection.
func (s *MiniAppSimulator) SimulateILGuard(ctx context.Context) error {
	appID := "builtin-il-guard"
	amount := int64(10000000)

	memo := fmt.Sprintf("ilguard:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("il guard: %w", err)
	}
	atomic.AddInt64(&s.ilGuardDeposits, 1)

	if randomInt(1, 5) == 1 {
		atomic.AddInt64(&s.ilGuardClaims, 1)
		winnerAddress := s.getRandomUserAddress()
		_, _ = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*2, "ilguard:claim")
	}
	return nil
}

package neosimulation

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	neoaccountsclient "github.com/R3E-Network/service_layer/infrastructure/accountpool/client"
)

// SimulatePredictionMarket simulates the prediction market workflow.
// Business flow: PlacePrediction -> RequestResolve
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

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "place prediction")
		if !ok {
			return nil
		}
		startPrice := int64(randomInt(30000, 50000)) * 100000000

		// Place prediction
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "PlacePrediction", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "String", Value: "NEO/GAS"},
			{Type: "Boolean", Value: direction == 1},
			{Type: "Integer", Value: amount},
			{Type: "Integer", Value: startPrice},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("place prediction contract: %w", err)
		}
	}

	if randomInt(0, 1) == direction {
		atomic.AddInt64(&s.predictionResolves, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "prediction payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*2, "predict:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("prediction payout: %w", err)
		}
		atomic.AddInt64(&s.predictionPayouts, 1)
	}
	return nil
}

// SimulateFlashLoan simulates the flash loan workflow.
// Business flow: RequestLoan -> Execute arbitrage -> Repay
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

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		borrowerAddress, ok := s.getRandomUserAddressOrWarn(appID, "request loan")
		if !ok {
			return nil
		}

		// Request loan
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "RequestLoan", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: borrowerAddress},
			{Type: "Integer", Value: amount},
			{Type: "Hash160", Value: borrowerAddress}, // callback contract
			{Type: "String", Value: "onFlashLoanCallback"},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("request loan contract: %w", err)
		}
	}

	atomic.AddInt64(&s.flashloanRepays, 1)
	return nil
}

// SimulatePriceTicker simulates the price ticker query workflow.
func (s *MiniAppSimulator) SimulatePriceTicker(ctx context.Context) error {
	atomic.AddInt64(&s.priceQueries, 1)
	return nil
}

// SimulatePricePredict simulates binary price prediction.
// Business flow: PlacePrediction -> RequestResolve
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

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "place prediction")
		if !ok {
			return nil
		}
		startPrice := int64(randomInt(30000, 50000)) * 100000000

		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "PlacePrediction", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "String", Value: "NEO/GAS"},
			{Type: "Boolean", Value: direction == 1},
			{Type: "Integer", Value: amount},
			{Type: "Integer", Value: startPrice},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("place prediction contract: %w", err)
		}
	}

	if randomInt(0, 1) == 1 {
		atomic.AddInt64(&s.pricePredictWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "price predict payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, int64(float64(amount)*1.9), "ppredict:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("price predict payout: %w", err)
		}
		atomic.AddInt64(&s.pricePredictPayouts, 1)
	}
	return nil
}

// SimulateTurboOptions simulates ultra-fast binary options.
// Business flow: PlaceOption -> RequestResolve
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

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		traderAddress, ok := s.getRandomUserAddressOrWarn(appID, "place option")
		if !ok {
			return nil
		}
		startPrice := int64(randomInt(30000, 50000)) * 100000000

		// Place option
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "PlaceOption", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: traderAddress},
			{Type: "String", Value: "NEO/GAS"},
			{Type: "Boolean", Value: direction == 1},
			{Type: "Integer", Value: amount},
			{Type: "Integer", Value: startPrice},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("place option contract: %w", err)
		}
	}

	if randomInt(0, 1) == 1 {
		atomic.AddInt64(&s.turboOptionsWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "turbo payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, int64(float64(amount)*1.85), "turbo:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("turbo payout: %w", err)
		}
		atomic.AddInt64(&s.turboOptionsPayouts, 1)
	}
	return nil
}

// SimulateILGuard simulates impermanent loss protection.
// Business flow: CreatePosition -> RequestMonitor -> ILCompensated
func (s *MiniAppSimulator) SimulateILGuard(ctx context.Context) error {
	appID := "builtin-il-guard"
	amount := int64(100000000) // 1 GAS minimum

	memo := fmt.Sprintf("ilguard:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("il guard: %w", err)
	}
	atomic.AddInt64(&s.ilGuardDeposits, 1)

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		providerAddress, ok := s.getRandomUserAddressOrWarn(appID, "create position")
		if !ok {
			return nil
		}
		initialPriceRatio := int64(randomInt(80, 120)) * 1000000 // 0.8-1.2 ratio * 1e8

		// Create position
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "CreatePosition", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: providerAddress},
			{Type: "String", Value: "NEO/GAS"},
			{Type: "Integer", Value: amount},
			{Type: "Integer", Value: initialPriceRatio},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("create position contract: %w", err)
		}
	}

	if randomInt(1, 5) == 1 {
		atomic.AddInt64(&s.ilGuardClaims, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "il guard payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount/2, "ilguard:compensate")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("il guard payout: %w", err)
		}
	}
	return nil
}

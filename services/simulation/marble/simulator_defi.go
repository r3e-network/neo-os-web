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
	appID := "miniapp-prediction-market"
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
	appID := "miniapp-flashloan"
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
	appID := "miniapp-price-predict"
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
	appID := "miniapp-turbo-options"
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
	appID := "miniapp-il-guard"
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

// SimulateCandleWars simulates binary options on price direction.
// Business flow: PlaceBet (green/red) -> ResolveRound
func (s *MiniAppSimulator) SimulateCandleWars(ctx context.Context) error {
	appID := "miniapp-candle-wars"
	amount := int64(randomInt(5, 50)) * 1000000 // 0.05-0.5 GAS
	isGreen := randomInt(0, 1) == 1

	direction := "red"
	if isGreen {
		direction = "green"
	}
	memo := fmt.Sprintf("candle:%s:%d:%d", direction, amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("candle bet: %w", err)
	}
	atomic.AddInt64(&s.candleWarsBets, 1)

	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "place bet")
		if !ok {
			return nil
		}
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "PlaceBet", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "Integer", Value: amount},
			{Type: "Boolean", Value: isGreen},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("candle place bet: %w", err)
		}
	}

	// 50% win rate
	if randomInt(0, 1) == 1 {
		atomic.AddInt64(&s.candleWarsWins, 1)
	}
	return nil
}

// SimulateDutchAuction simulates reverse auction.
// Business flow: Purchase at current price (price drops over time)
func (s *MiniAppSimulator) SimulateDutchAuction(ctx context.Context) error {
	appID := "miniapp-dutch-auction"
	// Price between 50-100% of start price
	price := int64(randomInt(50, 100)) * 10000000

	memo := fmt.Sprintf("auction:bid:%d:%d", price, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, price, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("auction bid: %w", err)
	}
	atomic.AddInt64(&s.dutchAuctionBids, 1)

	if s.invoker.HasMiniAppContract(appID) {
		buyerAddress, ok := s.getRandomUserAddressOrWarn(appID, "purchase")
		if !ok {
			return nil
		}
		auctionID := int64(randomInt(1, 10))
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "Purchase", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: buyerAddress},
			{Type: "Integer", Value: auctionID},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("auction purchase: %w", err)
		}
	}

	atomic.AddInt64(&s.dutchAuctionSales, 1)
	return nil
}

// SimulateParasite simulates DeFi staking with PvP attacks.
// Business flow: Stake -> Attack others -> Steal rewards
func (s *MiniAppSimulator) SimulateParasite(ctx context.Context) error {
	appID := "miniapp-the-parasite"
	amount := int64(randomInt(10, 100)) * 10000000 // 1-10 GAS

	memo := fmt.Sprintf("parasite:stake:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("parasite stake: %w", err)
	}
	atomic.AddInt64(&s.parasiteStakes, 1)

	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "stake")
		if !ok {
			return nil
		}
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "Stake", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "Integer", Value: amount},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("parasite stake contract: %w", err)
		}
	}

	// 30% chance to attack
	if randomInt(1, 10) <= 3 {
		atomic.AddInt64(&s.parasiteAttacks, 1)
	}
	return nil
}

// SimulateNoLossLottery simulates stake-to-win lottery.
// Business flow: Stake -> Enter draw -> Win yields (keep principal)
func (s *MiniAppSimulator) SimulateNoLossLottery(ctx context.Context) error {
	appID := "miniapp-no-loss-lottery"
	amount := int64(randomInt(10, 50)) * 10000000 // 1-5 GAS

	memo := fmt.Sprintf("noloss:stake:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("no loss stake: %w", err)
	}
	atomic.AddInt64(&s.noLossLotteryStakes, 1)

	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "stake")
		if !ok {
			return nil
		}
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "Stake", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "Integer", Value: amount},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("no loss stake contract: %w", err)
		}
	}

	// 10% win rate (yield only)
	if randomInt(1, 10) == 1 {
		atomic.AddInt64(&s.noLossLotteryWins, 1)
	}
	return nil
}

// SimulateDeadSwitch simulates dead man's switch.
func (s *MiniAppSimulator) SimulateDeadSwitch(ctx context.Context) error {
	appID := "miniapp-dead-switch"
	amount := int64(100000000)

	memo := fmt.Sprintf("switch:setup:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("dead switch: %w", err)
	}
	atomic.AddInt64(&s.deadSwitchSetups, 1)
	return nil
}

// SimulateHeritageTrust simulates living trust DAO.
func (s *MiniAppSimulator) SimulateHeritageTrust(ctx context.Context) error {
	appID := "miniapp-heritage-trust"
	amount := int64(100000000)

	memo := fmt.Sprintf("trust:create:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("heritage trust: %w", err)
	}
	atomic.AddInt64(&s.heritageTrustCreates, 1)
	return nil
}

// SimulateCompoundCapsule simulates auto-compounding savings.
func (s *MiniAppSimulator) SimulateCompoundCapsule(ctx context.Context) error {
	appID := "miniapp-compound-capsule"
	amount := int64(50000000)

	memo := fmt.Sprintf("capsule:deposit:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("compound capsule: %w", err)
	}
	atomic.AddInt64(&s.compoundDeposits, 1)
	return nil
}

// SimulateSelfLoan simulates self-repaying loans.
func (s *MiniAppSimulator) SimulateSelfLoan(ctx context.Context) error {
	appID := "miniapp-self-loan"
	amount := int64(100000000)

	memo := fmt.Sprintf("loan:borrow:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("self loan: %w", err)
	}
	atomic.AddInt64(&s.selfLoanBorrows, 1)
	return nil
}

// SimulateDarkPool simulates anonymous voting pool.
func (s *MiniAppSimulator) SimulateDarkPool(ctx context.Context) error {
	appID := "miniapp-dark-pool"
	amount := int64(50000000)

	memo := fmt.Sprintf("pool:swap:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("dark pool: %w", err)
	}
	atomic.AddInt64(&s.darkPoolSwaps, 1)
	return nil
}

// SimulateMeltingAsset simulates depreciating assets.
func (s *MiniAppSimulator) SimulateMeltingAsset(ctx context.Context) error {
	appID := "miniapp-melting-asset"
	amount := int64(20000000)

	memo := fmt.Sprintf("melt:deposit:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("melting asset: %w", err)
	}
	atomic.AddInt64(&s.meltingDeposits, 1)
	return nil
}

// SimulateUnbreakableVault simulates time-locked vault.
func (s *MiniAppSimulator) SimulateUnbreakableVault(ctx context.Context) error {
	appID := "miniapp-unbreakable-vault"
	amount := int64(50000000)

	memo := fmt.Sprintf("vault:lock:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("unbreakable vault: %w", err)
	}
	atomic.AddInt64(&s.vaultLocks, 1)
	return nil
}

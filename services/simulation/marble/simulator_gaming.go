package neosimulation

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"sync/atomic"
	"time"

	neoaccountsclient "github.com/R3E-Network/service_layer/infrastructure/accountpool/client"
)

// SimulateLottery simulates the lottery workflow.
// Business flow: BuyTickets -> InitiateDraw -> DrawWinner
func (s *MiniAppSimulator) SimulateLottery(ctx context.Context) error {
	appID := "builtin-lottery"
	ticketCount := randomInt(1, 5)
	amount := int64(ticketCount) * 10000000

	memo := fmt.Sprintf("lottery:round:%d:tickets:%d:%d", atomic.LoadInt64(&s.lotteryDraws)+1, ticketCount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy tickets: %w", err)
	}
	atomic.AddInt64(&s.lotteryTickets, int64(ticketCount))

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "buy tickets")
		if !ok {
			return nil
		}

		// Buy tickets
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "BuyTickets", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "Integer", Value: ticketCount},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("buy tickets contract: %w", err)
		}
	}

	if atomic.LoadInt64(&s.lotteryTickets)%5 == 0 {
		_, err = s.invoker.RecordRandomness(ctx)
		if err != nil && !errors.Is(err, ErrRandomnessLogNotConfigured) {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("draw randomness: %w", err)
		}
		atomic.AddInt64(&s.lotteryDraws, 1)

		// Initiate draw via contract
		if s.invoker.HasMiniAppContract(appID) {
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "InitiateDraw", []neoaccountsclient.ContractParam{})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("initiate draw contract: %w", err)
			}
		}

		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "lottery payout")
		if !ok {
			return nil
		}
		prizeAmount := amount * 3
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, prizeAmount, "lottery:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("lottery payout: %w", err)
		}
		atomic.AddInt64(&s.lotteryPayouts, 1)
	}
	return nil
}

// SimulateCoinFlip simulates the coin flip workflow.
// Business flow: PlaceBet -> RequestRNG -> ResolveBet
func (s *MiniAppSimulator) SimulateCoinFlip(ctx context.Context) error {
	appID := "builtin-coin-flip"
	amount := int64(5000000) // 0.05 GAS minimum
	choice := randomInt(0, 1) == 1

	memo := fmt.Sprintf("coinflip:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place bet: %w", err)
	}
	atomic.AddInt64(&s.coinFlipBets, 1)

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "place bet")
		if !ok {
			return nil
		}

		// Place bet
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "PlaceBet", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "Integer", Value: amount},
			{Type: "Boolean", Value: choice},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("place bet contract: %w", err)
		}
	}

	if randomInt(0, 1) == 1 {
		atomic.AddInt64(&s.coinFlipWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "coin flip payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*2, "coinflip:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("coin flip payout: %w", err)
		}
		atomic.AddInt64(&s.coinFlipPayouts, 1)
	}
	return nil
}

// SimulateDiceGame simulates the dice game workflow.
// Business flow: PlaceBet -> RequestRNG -> RollDice
func (s *MiniAppSimulator) SimulateDiceGame(ctx context.Context) error {
	appID := "builtin-dice-game"
	amount := int64(8000000)
	targetNumber := randomInt(1, 6)

	memo := fmt.Sprintf("dice:%d:%d:%d", targetNumber, amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place dice bet: %w", err)
	}
	atomic.AddInt64(&s.diceGameBets, 1)

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "place bet")
		if !ok {
			return nil
		}

		// Place bet
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "PlaceBet", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "Integer", Value: targetNumber},
			{Type: "Integer", Value: amount},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("place dice bet contract: %w", err)
		}
	}

	rolledNumber := randomInt(1, 6)
	if rolledNumber == targetNumber {
		atomic.AddInt64(&s.diceGameWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "dice payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*6, "dice:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("dice payout: %w", err)
		}
		atomic.AddInt64(&s.diceGamePayouts, 1)
	}
	return nil
}

// SimulateScratchCard simulates the scratch card workflow.
// Business flow: BuyCard -> RequestRNG -> RevealCard
func (s *MiniAppSimulator) SimulateScratchCard(ctx context.Context) error {
	appID := "builtin-scratch-card"
	cardType := int64(randomInt(1, 3))
	amount := cardType * 2000000 // Cost scales with card type

	memo := fmt.Sprintf("scratch:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy scratch card: %w", err)
	}
	atomic.AddInt64(&s.scratchCardBuys, 1)

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "buy card")
		if !ok {
			return nil
		}

		// Buy card
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "BuyCard", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "Integer", Value: cardType},
			{Type: "Integer", Value: amount},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("buy card contract: %w", err)
		}
	}

	if randomInt(1, 5) == 1 {
		atomic.AddInt64(&s.scratchCardWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "scratch payout")
		if !ok {
			return nil
		}
		prize := amount * cardType * 2
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, prize, "scratch:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("scratch payout: %w", err)
		}
		atomic.AddInt64(&s.scratchCardPayouts, 1)
	}
	return nil
}

// SimulateMegaMillions simulates the mega millions lottery workflow.
// Business flow: BuyTicket -> InitiateDraw -> DrawCompleted
func (s *MiniAppSimulator) SimulateMegaMillions(ctx context.Context) error {
	appID := "builtin-mega-millions"
	ticketCount := randomInt(1, 3)
	amount := int64(ticketCount) * 20000000

	memo := fmt.Sprintf("mega:tickets:%d:%d", ticketCount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy mega tickets: %w", err)
	}
	atomic.AddInt64(&s.megaMillionsTickets, int64(ticketCount))

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "buy ticket")
		if !ok {
			return nil
		}
		// Generate 5 main numbers (1-70) and 1 mega ball (1-25)
		mainNumbers := make([]byte, 5)
		for i := 0; i < 5; i++ {
			mainNumbers[i] = byte(randomInt(1, 70))
		}
		megaBall := byte(randomInt(1, 25))

		// Buy ticket
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "BuyTicket", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "ByteArray", Value: hex.EncodeToString(mainNumbers)},
			{Type: "Integer", Value: int64(megaBall)},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("buy ticket contract: %w", err)
		}
	}

	if atomic.LoadInt64(&s.megaMillionsTickets)%10 == 0 {
		atomic.AddInt64(&s.megaMillionsDraws, 1)
		prizeLevel := randomInt(1, 9)
		if prizeLevel <= 3 {
			atomic.AddInt64(&s.megaMillionsWins, 1)
			multiplier := []int64{100, 50, 20}[prizeLevel-1]
			winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "mega millions payout")
			if !ok {
				return nil
			}
			_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*multiplier, "mega:win")
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("mega millions payout: %w", err)
			}
			atomic.AddInt64(&s.megaMillionsPayouts, 1)
		}
	}
	return nil
}

// SimulateGasSpin simulates the gas spin wheel workflow.
// Business flow: PlaceSpin -> RequestRNG -> SpinResult
func (s *MiniAppSimulator) SimulateGasSpin(ctx context.Context) error {
	appID := "builtin-gas-spin"
	amount := int64(5000000) // 0.05 GAS minimum

	memo := fmt.Sprintf("spin:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("spin wheel: %w", err)
	}
	atomic.AddInt64(&s.gasSpinBets, 1)

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "place spin")
		if !ok {
			return nil
		}

		// Place spin
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "PlaceSpin", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "Integer", Value: amount},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("place spin contract: %w", err)
		}
	}

	segment := randomInt(1, 8)
	multipliers := []float64{0, 0.5, 1, 1.5, 2, 3, 5, 10}
	if segment > 1 {
		atomic.AddInt64(&s.gasSpinWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "gas spin payout")
		if !ok {
			return nil
		}
		payout := int64(float64(amount) * multipliers[segment-1])
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payout, "spin:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("gas spin payout: %w", err)
		}
		atomic.AddInt64(&s.gasSpinPayouts, 1)
	}
	return nil
}

// SimulateNeoCrash simulates the crash game workflow.
// Business flow: PlaceBet -> WatchMultiplier -> CashOut (before crash)
func (s *MiniAppSimulator) SimulateNeoCrash(ctx context.Context) error {
	appID := "builtin-neo-crash"
	amount := int64(randomInt(1, 10)) * 10000000 // 0.1-1 GAS

	memo := fmt.Sprintf("crash:bet:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("crash bet: %w", err)
	}
	atomic.AddInt64(&s.neoCrashBets, 1)

	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "place bet")
		if !ok {
			return nil
		}
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "PlaceBet", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "Integer", Value: amount},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("crash place bet: %w", err)
		}
	}

	// Simulate cashout before crash (60% success rate)
	if randomInt(1, 10) <= 6 {
		atomic.AddInt64(&s.neoCrashCashouts, 1)
		multiplier := float64(randomInt(110, 300)) / 100.0
		payout := int64(float64(amount) * multiplier)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "crash payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payout, "crash:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("crash payout: %w", err)
		}
		atomic.AddInt64(&s.neoCrashPayouts, 1)
	}
	return nil
}

// SimulateThroneOfGas simulates the king of the hill game.
// Business flow: ClaimThrone -> CollectTax
func (s *MiniAppSimulator) SimulateThroneOfGas(ctx context.Context) error {
	appID := "builtin-throne-of-gas"
	bid := int64(randomInt(11, 30)) * 10000000 // 1.1-3 GAS (must be > current price)

	memo := fmt.Sprintf("throne:claim:%d:%d", bid, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, bid, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("throne claim: %w", err)
	}
	atomic.AddInt64(&s.throneOfGasClaims, 1)

	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "claim throne")
		if !ok {
			return nil
		}
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "ClaimThrone", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "Integer", Value: bid},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("claim throne contract: %w", err)
		}
	}

	// Tax collected (10% of bid)
	tax := bid / 10
	atomic.AddInt64(&s.throneOfGasTaxes, tax)
	return nil
}

// SimulateDoomsdayClock simulates the FOMO3D style game.
// Business flow: BuyKeys -> ExtendTimer -> WinPot (if last buyer)
func (s *MiniAppSimulator) SimulateDoomsdayClock(ctx context.Context) error {
	appID := "builtin-doomsday-clock"
	keyCount := int64(randomInt(1, 5))
	amount := keyCount * 100000000 // 1 GAS per key

	memo := fmt.Sprintf("doomsday:keys:%d:%d", keyCount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy keys: %w", err)
	}
	atomic.AddInt64(&s.doomsdayClockKeys, keyCount)

	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "buy keys")
		if !ok {
			return nil
		}
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "BuyKeys", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "Integer", Value: keyCount},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("buy keys contract: %w", err)
		}
	}

	// Rare win (1% chance - timer expired)
	if randomInt(1, 100) == 1 {
		atomic.AddInt64(&s.doomsdayClockWins, 1)
	}
	return nil
}

// SimulateSchrodingerNFT simulates the quantum pet box workflow.
// Business flow: Adopt -> Observe (state collapse) -> Trade (blind box)
func (s *MiniAppSimulator) SimulateSchrodingerNFT(ctx context.Context) error {
	appID := "builtin-schrodinger-nft"
	adoptFee := int64(50000000) // 0.5 GAS to adopt
	observeFee := int64(5000000) // 0.05 GAS to observe

	// Randomly decide action: adopt (30%), observe (50%), trade (20%)
	action := randomInt(1, 10)

	if action <= 3 {
		// Adopt a new quantum pet box
		memo := fmt.Sprintf("schrodinger:adopt:%d", time.Now().UnixNano())
		_, err := s.invoker.PayToApp(ctx, appID, adoptFee, memo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("schrodinger adopt: %w", err)
		}
		atomic.AddInt64(&s.schrodingerAdopts, 1)

		if s.invoker.HasMiniAppContract(appID) {
			ownerAddress, ok := s.getRandomUserAddressOrWarn(appID, "adopt pet")
			if !ok {
				return nil
			}
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "Adopt", []neoaccountsclient.ContractParam{
				{Type: "Hash160", Value: ownerAddress},
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("adopt contract: %w", err)
			}
		}
	} else if action <= 8 {
		// Observe pet state (may cause collapse)
		memo := fmt.Sprintf("schrodinger:observe:%d", time.Now().UnixNano())
		_, err := s.invoker.PayToApp(ctx, appID, observeFee, memo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("schrodinger observe: %w", err)
		}
		atomic.AddInt64(&s.schrodingerObserves, 1)

		if s.invoker.HasMiniAppContract(appID) {
			ownerAddress, ok := s.getRandomUserAddressOrWarn(appID, "observe pet")
			if !ok {
				return nil
			}
			petID := int64(randomInt(1, 100))
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "Observe", []neoaccountsclient.ContractParam{
				{Type: "Hash160", Value: ownerAddress},
				{Type: "Integer", Value: petID},
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("observe contract: %w", err)
			}
		}
	} else {
		// Trade blind box
		tradePrice := int64(randomInt(30, 100)) * 10000000
		memo := fmt.Sprintf("schrodinger:trade:%d", time.Now().UnixNano())
		_, err := s.invoker.PayToApp(ctx, appID, 1000000, memo) // listing fee
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("schrodinger trade: %w", err)
		}
		atomic.AddInt64(&s.schrodingerTrades, 1)

		// Payout to seller
		sellerAddress, ok := s.getRandomUserAddressOrWarn(appID, "trade payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, sellerAddress, tradePrice, "schrodinger:sold")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("schrodinger trade payout: %w", err)
		}
	}
	return nil
}

// SimulateAlgoBattle simulates the code gladiator arena workflow.
// Business flow: Upload script -> Match -> Battle (100 rounds in TEE)
func (s *MiniAppSimulator) SimulateAlgoBattle(ctx context.Context) error {
	appID := "builtin-algo-battle"
	uploadFee := int64(10000000)  // 0.1 GAS to upload
	matchFee := int64(50000000)   // 0.5 GAS to match

	// Randomly decide action: upload (40%), match (60%)
	action := randomInt(1, 10)

	if action <= 4 {
		// Upload new battle script
		memo := fmt.Sprintf("algobattle:upload:%d", time.Now().UnixNano())
		_, err := s.invoker.PayToApp(ctx, appID, uploadFee, memo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("algo battle upload: %w", err)
		}
		atomic.AddInt64(&s.algoBattleUploads, 1)

		if s.invoker.HasMiniAppContract(appID) {
			playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "upload script")
			if !ok {
				return nil
			}
			scriptHash := hex.EncodeToString(generateRandomBytes(32))
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "UploadScript", []neoaccountsclient.ContractParam{
				{Type: "Hash160", Value: playerAddress},
				{Type: "String", Value: scriptHash},
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("upload script contract: %w", err)
			}
		}
	} else {
		// Request match
		memo := fmt.Sprintf("algobattle:match:%d", time.Now().UnixNano())
		_, err := s.invoker.PayToApp(ctx, appID, matchFee, memo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("algo battle match: %w", err)
		}
		atomic.AddInt64(&s.algoBattleMatches, 1)

		// 50% win rate
		if randomInt(0, 1) == 1 {
			atomic.AddInt64(&s.algoBattleWins, 1)
			winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "battle payout")
			if !ok {
				return nil
			}
			prize := int64(float64(matchFee) * 1.8)
			_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, prize, "algobattle:win")
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("algo battle payout: %w", err)
			}
		}
	}
	return nil
}

// SimulateQuantumSwap simulates blind box exchange.
func (s *MiniAppSimulator) SimulateQuantumSwap(ctx context.Context) error {
	appID := "miniapp-quantum-swap"
	amount := int64(10000000)

	memo := fmt.Sprintf("quantum:swap:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("quantum swap: %w", err)
	}
	atomic.AddInt64(&s.quantumSwaps, 1)
	return nil
}

// SimulateBurnLeague simulates burn-to-earn.
func (s *MiniAppSimulator) SimulateBurnLeague(ctx context.Context) error {
	appID := "miniapp-burn-league"
	amount := int64(20000000)

	memo := fmt.Sprintf("burn:league:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("burn league: %w", err)
	}
	atomic.AddInt64(&s.burnLeagueBurns, 1)
	return nil
}

// SimulatePuzzleMining simulates puzzle solving for rewards.
func (s *MiniAppSimulator) SimulatePuzzleMining(ctx context.Context) error {
	appID := "miniapp-puzzle-mining"
	amount := int64(5000000)

	memo := fmt.Sprintf("puzzle:solve:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("puzzle mining: %w", err)
	}
	atomic.AddInt64(&s.puzzleSolves, 1)
	return nil
}

// SimulateFogPuzzle simulates fog of war puzzle.
func (s *MiniAppSimulator) SimulateFogPuzzle(ctx context.Context) error {
	appID := "miniapp-fog-puzzle"
	amount := int64(5000000)

	memo := fmt.Sprintf("fog:reveal:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("fog puzzle: %w", err)
	}
	atomic.AddInt64(&s.fogPuzzleReveals, 1)
	return nil
}

// SimulateCryptoRiddle simulates password red envelope.
func (s *MiniAppSimulator) SimulateCryptoRiddle(ctx context.Context) error {
	appID := "miniapp-crypto-riddle"
	amount := int64(10000000)

	memo := fmt.Sprintf("riddle:solve:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("crypto riddle: %w", err)
	}
	atomic.AddInt64(&s.riddleSolves, 1)
	return nil
}

// SimulateScreamToEarn simulates voice-activated earning.
func (s *MiniAppSimulator) SimulateScreamToEarn(ctx context.Context) error {
	appID := "miniapp-scream-to-earn"
	amount := int64(5000000)

	memo := fmt.Sprintf("scream:submit:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("scream to earn: %w", err)
	}
	atomic.AddInt64(&s.screamSubmits, 1)
	return nil
}

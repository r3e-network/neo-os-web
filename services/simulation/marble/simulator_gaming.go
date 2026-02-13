package neosimulation

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"sync/atomic"
	"time"

	neoaccountsclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/accountpool/client"
)

// SimulateLottery simulates the lottery workflow.
// Business flow: BuyTickets -> InitiateDraw -> DrawWinner
func (s *MiniAppSimulator) SimulateLottery(ctx context.Context) error {
	appID := "miniapp-lottery"
	ticketCount := randomInt(1, LotteryDrawEveryNTickets)
	amount := int64(ticketCount) * LotteryTicketPrice

	memo := fmt.Sprintf("lottery:round:%d:tickets:%d:%d", atomic.LoadInt64(&s.lotteryDraws)+1, ticketCount, time.Now().UnixNano())
	txHash, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy tickets: %w", err)
	}
	atomic.AddInt64(&s.lotteryTickets, int64(ticketCount))
	s.recordPayment(appID, txHash, amount)

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

	if atomic.LoadInt64(&s.lotteryTickets)%LotteryDrawEveryNTickets == 0 {
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
		prizeAmount := amount * LotteryPrizeMultiplier
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
	appID := "miniapp-coinflip"
	amount := int64(CoinFlipMinBet)
	choice := randomInt(0, 1) == 1

	memo := fmt.Sprintf("coinflip:%d:%d", amount, time.Now().UnixNano())
	txHash, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place bet: %w", err)
	}
	atomic.AddInt64(&s.coinFlipBets, 1)
	s.recordPayment(appID, txHash, amount)

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
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*CoinFlipPayoutMultiplier, "coinflip:win")
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
	appID := "miniapp-dice-game"
	amount := int64(DiceGameBetAmount)
	targetNumber := randomInt(DiceMinFace, DiceMaxFace)

	memo := fmt.Sprintf("dice:%d:%d:%d", targetNumber, amount, time.Now().UnixNano())
	txHash, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place dice bet: %w", err)
	}
	atomic.AddInt64(&s.diceGameBets, 1)
	s.recordPayment(appID, txHash, amount)

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

	rolledNumber := randomInt(DiceMinFace, DiceMaxFace)
	if rolledNumber == targetNumber {
		atomic.AddInt64(&s.diceGameWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "dice payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*DicePayoutMultiplier, "dice:win")
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
	appID := "miniapp-scratch-card"
	cardType := int64(randomInt(ScratchCardMinType, ScratchCardMaxType))
	amount := cardType * ScratchCardBasePrice // Cost scales with card type

	memo := fmt.Sprintf("scratch:%d:%d", amount, time.Now().UnixNano())
	txHash, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy scratch card: %w", err)
	}
	atomic.AddInt64(&s.scratchCardBuys, 1)
	s.recordPayment(appID, txHash, amount)

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

	if randomInt(1, ScratchCardWinChance) == 1 {
		atomic.AddInt64(&s.scratchCardWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "scratch payout")
		if !ok {
			return nil
		}
		prize := amount * cardType * ScratchCardPrizeFactor
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
	appID := "miniapp-mega-millions"
	ticketCount := randomInt(1, MegaMillionsMaxTickets)
	amount := int64(ticketCount) * MegaMillionsTicketPrice

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
		// Generate main numbers and mega ball
		mainNumbers := make([]byte, MegaMillionsMainNumbers)
		for i := 0; i < MegaMillionsMainNumbers; i++ {
			mainNumbers[i] = byte(randomInt(1, MegaMillionsMainMax))
		}
		megaBall := byte(randomInt(1, MegaMillionsMegaBallMax))

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

	if atomic.LoadInt64(&s.megaMillionsTickets)%MegaMillionsDrawEveryN == 0 {
		atomic.AddInt64(&s.megaMillionsDraws, 1)
		prizeLevel := randomInt(1, MegaMillionsMaxPrizeLevel)
		if prizeLevel <= MegaMillionsWinThreshold {
			atomic.AddInt64(&s.megaMillionsWins, 1)
			multiplier := MegaMillionsPrizeMultipliers[prizeLevel-1]
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
	appID := "miniapp-gas-spin"
	amount := int64(GasSpinMinBet)

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

	segment := randomInt(1, GasSpinSegments)
	if segment > 1 {
		atomic.AddInt64(&s.gasSpinWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "gas spin payout")
		if !ok {
			return nil
		}
		payout := int64(float64(amount) * GasSpinMultipliers[segment-1])
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
	appID := "miniapp-neo-crash"
	amount := int64(randomInt(1, NeoCrashMaxBetUnits)) * NeoCrashBetUnit

	memo := fmt.Sprintf("crash:bet:%d:%d", amount, time.Now().UnixNano())
	txHash, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("crash bet: %w", err)
	}
	atomic.AddInt64(&s.neoCrashBets, 1)
	s.recordPayment(appID, txHash, amount)

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
	if randomInt(1, NeoCrashCashoutChance) <= NeoCrashCashoutSuccess {
		atomic.AddInt64(&s.neoCrashCashouts, 1)
		multiplier := float64(randomInt(NeoCrashMinMultiplier, NeoCrashMaxMultiplier)) / float64(NeoCrashMultiplierScale)
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
	appID := "miniapp-throne-of-gas"
	bid := int64(randomInt(ThroneMinBidUnits, ThroneMaxBidUnits)) * ThroneOfGasBidUnit

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
	tax := bid / ThroneTaxDivisor
	atomic.AddInt64(&s.throneOfGasTaxes, tax)
	return nil
}

// SimulateDoomsdayClock simulates the FOMO3D style game.
// Business flow: BuyKeys -> ExtendTimer -> WinPot (if last buyer)
func (s *MiniAppSimulator) SimulateDoomsdayClock(ctx context.Context) error {
	appID := "miniapp-doomsday-clock"
	keyCount := int64(randomInt(1, DoomsdayMaxKeys))
	amount := keyCount * DoomsdayKeyPrice

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
	if randomInt(1, DoomsdayWinChance) == DoomsdayWinRoll {
		atomic.AddInt64(&s.doomsdayClockWins, 1)
	}
	return nil
}

// SimulateBurnLeague simulates burn-to-earn.
func (s *MiniAppSimulator) SimulateBurnLeague(ctx context.Context) error {
	appID := "miniapp-burn-league"
	amount := int64(BurnLeagueAmount)

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
	amount := int64(PuzzleMiningFee)

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
	amount := int64(FogPuzzleRevealFee)

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
	appID := "miniapp-cryptoriddle"
	amount := int64(CryptoRiddleFee)

	memo := fmt.Sprintf("riddle:solve:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("crypto riddle: %w", err)
	}
	atomic.AddInt64(&s.riddleSolves, 1)
	return nil
}

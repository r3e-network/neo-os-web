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

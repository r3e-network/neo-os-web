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

	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "recordTickets", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: ticketCount},
		})
	}

	if atomic.LoadInt64(&s.lotteryTickets)%5 == 0 {
		_, err = s.invoker.RecordRandomness(ctx)
		if err != nil && !errors.Is(err, ErrRandomnessLogNotConfigured) {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("draw randomness: %w", err)
		}
		atomic.AddInt64(&s.lotteryDraws, 1)

		if s.invoker.HasMiniAppContract(appID) {
			randomness := generateRandomBytes(32)
			_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "drawWinner", []neoaccountsclient.ContractParam{
				{Type: "ByteArray", Value: hex.EncodeToString(randomness)},
			})
		}

		winnerAddress := s.getRandomUserAddress()
		prizeAmount := amount * 3
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, prizeAmount, "lottery:win")
		if err == nil {
			atomic.AddInt64(&s.lotteryPayouts, 1)
		}
	}
	return nil
}

// SimulateCoinFlip simulates the coin flip workflow.
func (s *MiniAppSimulator) SimulateCoinFlip(ctx context.Context) error {
	appID := "builtin-coin-flip"
	amount := int64(5000000)

	memo := fmt.Sprintf("coinflip:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place bet: %w", err)
	}
	atomic.AddInt64(&s.coinFlipBets, 1)

	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "recordBet", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: amount},
		})
	}

	if randomInt(0, 1) == 1 {
		atomic.AddInt64(&s.coinFlipWins, 1)
		winnerAddress := s.getRandomUserAddress()
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*2, "coinflip:win")
		if err == nil {
			atomic.AddInt64(&s.coinFlipPayouts, 1)
		}
	}
	return nil
}

// SimulateDiceGame simulates the dice game workflow.
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

	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "recordBet", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: targetNumber},
			{Type: "Integer", Value: amount},
		})
	}

	rolledNumber := randomInt(1, 6)
	if rolledNumber == targetNumber {
		atomic.AddInt64(&s.diceGameWins, 1)
		winnerAddress := s.getRandomUserAddress()
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*6, "dice:win")
		if err == nil {
			atomic.AddInt64(&s.diceGamePayouts, 1)
		}
	}
	return nil
}

// SimulateScratchCard simulates the scratch card workflow.
func (s *MiniAppSimulator) SimulateScratchCard(ctx context.Context) error {
	appID := "builtin-scratch-card"
	amount := int64(2000000)

	memo := fmt.Sprintf("scratch:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy scratch card: %w", err)
	}
	atomic.AddInt64(&s.scratchCardBuys, 1)

	if randomInt(1, 5) == 1 {
		atomic.AddInt64(&s.scratchCardWins, 1)
		winnerAddress := s.getRandomUserAddress()
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*5, "scratch:win")
		if err == nil {
			atomic.AddInt64(&s.scratchCardPayouts, 1)
		}
	}
	return nil
}

// SimulateMegaMillions simulates the mega millions lottery workflow.
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

	if atomic.LoadInt64(&s.megaMillionsTickets)%10 == 0 {
		atomic.AddInt64(&s.megaMillionsDraws, 1)
		prizeLevel := randomInt(1, 9)
		if prizeLevel <= 3 {
			atomic.AddInt64(&s.megaMillionsWins, 1)
			multiplier := []int64{100, 50, 20}[prizeLevel-1]
			winnerAddress := s.getRandomUserAddress()
			_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*multiplier, "mega:win")
			if err == nil {
				atomic.AddInt64(&s.megaMillionsPayouts, 1)
			}
		}
	}
	return nil
}

// SimulateGasSpin simulates the gas spin wheel workflow.
func (s *MiniAppSimulator) SimulateGasSpin(ctx context.Context) error {
	appID := "builtin-gas-spin"
	amount := int64(5000000)

	memo := fmt.Sprintf("spin:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("spin wheel: %w", err)
	}
	atomic.AddInt64(&s.gasSpinBets, 1)

	segment := randomInt(1, 8)
	multipliers := []float64{0, 0.5, 1, 1.5, 2, 3, 5, 10}
	if segment > 1 {
		atomic.AddInt64(&s.gasSpinWins, 1)
		winnerAddress := s.getRandomUserAddress()
		payout := int64(float64(amount) * multipliers[segment-1])
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payout, "spin:win")
		if err == nil {
			atomic.AddInt64(&s.gasSpinPayouts, 1)
		}
	}
	return nil
}

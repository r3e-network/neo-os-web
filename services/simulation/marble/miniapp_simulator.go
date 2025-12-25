// Package neosimulation provides MiniApp workflow simulation.
package neosimulation

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"sync/atomic"
	"time"
)

// MiniAppSimulator simulates all MiniApp workflows.
type MiniAppSimulator struct {
	invoker ContractInvokerInterface

	// Simulated user addresses for payouts (pool accounts that receive winnings)
	userAddresses []string

	// Statistics per MiniApp
	lotteryTickets     int64
	lotteryDraws       int64
	lotteryPayouts     int64
	coinFlipBets       int64
	coinFlipWins       int64
	coinFlipPayouts    int64
	diceGameBets       int64
	diceGameWins       int64
	diceGamePayouts    int64
	scratchCardBuys    int64
	scratchCardWins    int64
	scratchCardPayouts int64
	predictionBets     int64
	predictionResolves int64
	predictionPayouts  int64
	flashloanBorrows   int64
	flashloanRepays    int64
	priceQueries       int64
	// New MiniApps stats
	gasSpinBets         int64
	gasSpinWins         int64
	gasSpinPayouts      int64
	pricePredictBets    int64
	pricePredictWins    int64
	pricePredictPayouts int64
	secretVoteCasts     int64
	secretVoteTallies   int64
	simulationErrors    int64
}

// MiniAppConfig holds configuration for each MiniApp.
type MiniAppConfig struct {
	AppID       string
	Name        string
	Category    string
	Interval    time.Duration
	BetAmount   int64 // in 8 decimals (1 GAS = 100000000)
	Description string
}

// AllMiniApps returns configuration for all builtin MiniApps.
func AllMiniApps() []MiniAppConfig {
	return []MiniAppConfig{
		{
			AppID:       "builtin-lottery",
			Name:        "Neo Lottery",
			Category:    "gaming",
			Interval:    5 * time.Second,
			BetAmount:   10000000, // 0.1 GAS per ticket
			Description: "Buy lottery tickets, draw winners",
		},
		{
			AppID:       "builtin-coin-flip",
			Name:        "Neo Coin Flip",
			Category:    "gaming",
			Interval:    3 * time.Second,
			BetAmount:   5000000, // 0.05 GAS per flip
			Description: "50/50 coin flip, double or nothing",
		},
		{
			AppID:       "builtin-dice-game",
			Name:        "Neo Dice",
			Category:    "gaming",
			Interval:    4 * time.Second,
			BetAmount:   8000000, // 0.08 GAS per roll
			Description: "Roll dice, win up to 6x",
		},
		{
			AppID:       "builtin-scratch-card",
			Name:        "Neo Scratch Cards",
			Category:    "gaming",
			Interval:    6 * time.Second,
			BetAmount:   2000000, // 0.02 GAS per card
			Description: "Instant win scratch cards",
		},
		{
			AppID:       "builtin-prediction-market",
			Name:        "Neo Predictions",
			Category:    "defi",
			Interval:    10 * time.Second,
			BetAmount:   20000000, // 0.2 GAS per prediction
			Description: "Bet on price movements",
		},
		{
			AppID:       "builtin-flashloan",
			Name:        "Neo FlashLoan",
			Category:    "defi",
			Interval:    15 * time.Second,
			BetAmount:   100000000, // 1 GAS flash loan
			Description: "Instant borrow and repay",
		},
		{
			AppID:       "builtin-price-ticker",
			Name:        "Neo Price Ticker",
			Category:    "defi",
			Interval:    8 * time.Second,
			BetAmount:   0, // Read-only, no payment
			Description: "Query price feeds",
		},
		// New MiniApps
		{
			AppID:       "builtin-gas-spin",
			Name:        "Gas Spin Wheel",
			Category:    "gaming",
			Interval:    5 * time.Second,
			BetAmount:   5000000, // 0.05 GAS per spin
			Description: "Lucky wheel with 8 prize tiers using VRF",
		},
		{
			AppID:       "builtin-price-predict",
			Name:        "Price Prediction",
			Category:    "defi",
			Interval:    8 * time.Second,
			BetAmount:   10000000, // 0.1 GAS per prediction
			Description: "Binary options on price movements",
		},
		{
			AppID:       "builtin-secret-vote",
			Name:        "Secret Vote",
			Category:    "governance",
			Interval:    10 * time.Second,
			BetAmount:   1000000, // 0.01 GAS per vote
			Description: "Privacy-preserving voting using TEE",
		},
		// Phase 2 MiniApps
		{
			AppID:       "builtin-secret-poker",
			Name:        "Secret Poker",
			Category:    "gaming",
			Interval:    8 * time.Second,
			BetAmount:   50000000, // 0.5 GAS per hand
			Description: "TEE Texas Hold'em with hidden cards",
		},
		{
			AppID:       "builtin-micro-predict",
			Name:        "Micro Predict",
			Category:    "defi",
			Interval:    6 * time.Second,
			BetAmount:   10000000, // 0.1 GAS per prediction
			Description: "60-second price predictions",
		},
		{
			AppID:       "builtin-red-envelope",
			Name:        "Red Envelope",
			Category:    "social",
			Interval:    10 * time.Second,
			BetAmount:   20000000, // 0.2 GAS per envelope
			Description: "Social GAS red packets with VRF",
		},
		{
			AppID:       "builtin-gas-circle",
			Name:        "GAS Circle",
			Category:    "social",
			Interval:    12 * time.Second,
			BetAmount:   10000000, // 0.1 GAS daily deposit
			Description: "Daily savings circle with lottery",
		},
		{
			AppID:       "builtin-fog-chess",
			Name:        "Fog Chess",
			Category:    "gaming",
			Interval:    15 * time.Second,
			BetAmount:   10000000, // 0.1 GAS per game
			Description: "Chess with fog of war using TEE",
		},
		{
			AppID:       "builtin-gov-booster",
			Name:        "Gov Booster",
			Category:    "governance",
			Interval:    20 * time.Second,
			BetAmount:   1000000, // 0.01 GAS for votes
			Description: "NEO governance optimization tool",
		},
		// Phase 3 MiniApps
		{
			AppID:       "builtin-turbo-options",
			Name:        "Turbo Options",
			Category:    "defi",
			Interval:    5 * time.Second,
			BetAmount:   50000000, // 0.5 GAS per trade
			Description: "Ultra-fast binary options with 0.1% datafeed",
		},
		{
			AppID:       "builtin-il-guard",
			Name:        "IL Guard",
			Category:    "defi",
			Interval:    30 * time.Second,
			BetAmount:   1000000, // 0.01 GAS monitoring fee
			Description: "Impermanent loss protection tool",
		},
		{
			AppID:       "builtin-guardian-policy",
			Name:        "Guardian Policy",
			Category:    "security",
			Interval:    60 * time.Second,
			BetAmount:   500000, // 0.005 GAS policy fee
			Description: "TEE-enforced transaction security",
		},
		// Phase 4 MiniApps - Long-Running Processes
		{
			AppID:       "builtin-ai-trader",
			Name:        "AI Trader",
			Category:    "defi",
			Interval:    10 * time.Second,
			BetAmount:   10000000, // 0.1 GAS per trade
			Description: "Autonomous AI trading agent with TEE strategy",
		},
		{
			AppID:       "builtin-grid-bot",
			Name:        "Grid Bot",
			Category:    "defi",
			Interval:    5 * time.Second,
			BetAmount:   5000000, // 0.05 GAS per order
			Description: "Automated grid trading market maker",
		},
		{
			AppID:       "builtin-nft-evolve",
			Name:        "NFT Evolve",
			Category:    "gaming",
			Interval:    15 * time.Second,
			BetAmount:   1000000, // 0.01 GAS per action
			Description: "Dynamic NFT evolution engine",
		},
		{
			AppID:       "builtin-bridge-guardian",
			Name:        "Bridge Guardian",
			Category:    "defi",
			Interval:    30 * time.Second,
			BetAmount:   100000000, // 1 GAS per bridge
			Description: "Cross-chain asset bridge with SPV verification",
		},
	}
}

// NewMiniAppSimulator creates a new MiniApp simulator.
func NewMiniAppSimulator(invoker ContractInvokerInterface) *MiniAppSimulator {
	// Pre-generate some simulated user addresses for payouts
	// These are valid Neo N3 testnet addresses that will receive winnings
	userAddresses := []string{
		"NZHf1NJvz1tvELGLWZjhpb3NqZJFFUYpxT", // Simulated user 1
		"NScQ8g3DyS7nbjMXytUvxtzNWG8m4gjhdf", // Simulated user 2
		"NgmXwUVqZrWkhhRDpFRhDC6Si2ZXGGu3SG", // Simulated user 3
		"NfuwpaQ1A2xaeVbxWe8FRtaRgaMa8yF3YM", // Simulated user 4
		"NUVPACMnKFhpuHjsRjhUvXz1XhqfGZYVtY", // Simulated user 5
	}

	return &MiniAppSimulator{
		invoker:       invoker,
		userAddresses: userAddresses,
	}
}

// GetStats returns simulation statistics for all MiniApps.
func (s *MiniAppSimulator) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"lottery": map[string]int64{
			"tickets_bought": atomic.LoadInt64(&s.lotteryTickets),
			"draws":          atomic.LoadInt64(&s.lotteryDraws),
			"payouts":        atomic.LoadInt64(&s.lotteryPayouts),
		},
		"coin_flip": map[string]int64{
			"bets":    atomic.LoadInt64(&s.coinFlipBets),
			"wins":    atomic.LoadInt64(&s.coinFlipWins),
			"payouts": atomic.LoadInt64(&s.coinFlipPayouts),
		},
		"dice_game": map[string]int64{
			"bets":    atomic.LoadInt64(&s.diceGameBets),
			"wins":    atomic.LoadInt64(&s.diceGameWins),
			"payouts": atomic.LoadInt64(&s.diceGamePayouts),
		},
		"scratch_card": map[string]int64{
			"cards_bought": atomic.LoadInt64(&s.scratchCardBuys),
			"wins":         atomic.LoadInt64(&s.scratchCardWins),
			"payouts":      atomic.LoadInt64(&s.scratchCardPayouts),
		},
		"prediction_market": map[string]int64{
			"bets":     atomic.LoadInt64(&s.predictionBets),
			"resolves": atomic.LoadInt64(&s.predictionResolves),
			"payouts":  atomic.LoadInt64(&s.predictionPayouts),
		},
		"flashloan": map[string]int64{
			"borrows": atomic.LoadInt64(&s.flashloanBorrows),
			"repays":  atomic.LoadInt64(&s.flashloanRepays),
		},
		"price_ticker": map[string]int64{
			"queries": atomic.LoadInt64(&s.priceQueries),
		},
		// New MiniApps stats
		"gas_spin": map[string]int64{
			"bets":    atomic.LoadInt64(&s.gasSpinBets),
			"wins":    atomic.LoadInt64(&s.gasSpinWins),
			"payouts": atomic.LoadInt64(&s.gasSpinPayouts),
		},
		"price_predict": map[string]int64{
			"bets":    atomic.LoadInt64(&s.pricePredictBets),
			"wins":    atomic.LoadInt64(&s.pricePredictWins),
			"payouts": atomic.LoadInt64(&s.pricePredictPayouts),
		},
		"secret_vote": map[string]int64{
			"casts":   atomic.LoadInt64(&s.secretVoteCasts),
			"tallies": atomic.LoadInt64(&s.secretVoteTallies),
		},
		"errors": atomic.LoadInt64(&s.simulationErrors),
	}
}

// SimulateLottery simulates the lottery workflow:
// 1. Buy tickets (payment)
// 2. Request randomness for draw
// 3. Determine winner
// 4. Send callback payout to winner
func (s *MiniAppSimulator) SimulateLottery(ctx context.Context) error {
	appID := "builtin-lottery"
	ticketCount := randomInt(1, 5)          // Buy 1-5 tickets
	amount := int64(ticketCount) * 10000000 // 0.1 GAS per ticket

	// Step 1: Buy tickets (payment to PaymentHub)
	memo := fmt.Sprintf("lottery:round:%d:tickets:%d", time.Now().Unix(), ticketCount)
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy tickets: %w", err)
	}
	atomic.AddInt64(&s.lotteryTickets, int64(ticketCount))

	// Step 2: Request randomness for draw (every 5th ticket triggers a draw)
	if atomic.LoadInt64(&s.lotteryTickets)%5 == 0 {
		_, err = s.invoker.RecordRandomness(ctx)
		if err != nil {
			if errors.Is(err, ErrRandomnessLogNotConfigured) {
				// Skip on-chain anchoring when randomness contract is not configured.
				err = nil
			}
		}
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("draw randomness: %w", err)
		}
		atomic.AddInt64(&s.lotteryDraws, 1)

		// Step 3 & 4: Determine winner and send callback payout
		// Prize pool is accumulated tickets * 0.1 GAS, winner gets 90% (10% platform fee)
		prizePool := amount * 5 * 90 / 100 // 5 tickets worth, 90% to winner
		winnerAddress := s.getRandomUserAddress()
		payoutMemo := fmt.Sprintf("lottery:payout:round:%d:winner", time.Now().Unix())
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, prizePool, payoutMemo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("lottery payout: %w", err)
		}
		atomic.AddInt64(&s.lotteryPayouts, 1)
	}

	return nil
}

// getRandomUserAddress returns a random simulated user address for payouts.
func (s *MiniAppSimulator) getRandomUserAddress() string {
	if len(s.userAddresses) == 0 {
		return "NZHf1NJvz1tvELGLWZjhpb3NqZJFFUYpxT" // Fallback address
	}
	return s.userAddresses[randomInt(0, len(s.userAddresses)-1)]
}

// SimulateCoinFlip simulates the coin flip workflow:
// 1. Place bet (payment)
// 2. Request randomness
// 3. Resolve outcome (50% win rate)
// 4. Send callback payout if winner
func (s *MiniAppSimulator) SimulateCoinFlip(ctx context.Context) error {
	appID := "builtin-coin-flip"
	amount := int64(5000000)  // 0.05 GAS bet
	choice := randomInt(0, 1) // 0 = heads, 1 = tails

	// Step 1: Place bet
	memo := fmt.Sprintf("coinflip:bet:%d:choice:%d", time.Now().UnixNano(), choice)
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place bet: %w", err)
	}
	atomic.AddInt64(&s.coinFlipBets, 1)

	// Step 2: Request randomness and resolve
	_, err = s.invoker.RecordRandomness(ctx)
	if err != nil {
		if errors.Is(err, ErrRandomnessLogNotConfigured) {
			err = nil
		}
	}
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("flip randomness: %w", err)
	}

	// Step 3: Simulate outcome (50% win rate)
	outcome := randomInt(0, 1)
	if outcome == choice {
		atomic.AddInt64(&s.coinFlipWins, 1)

		// Step 4: Send callback payout (2x bet minus 5% platform fee)
		payout := amount * 2 * 95 / 100
		winnerAddress := s.getRandomUserAddress()
		payoutMemo := fmt.Sprintf("coinflip:payout:%d:win", time.Now().UnixNano())
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payout, payoutMemo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("coinflip payout: %w", err)
		}
		atomic.AddInt64(&s.coinFlipPayouts, 1)
	}

	return nil
}

// SimulateDiceGame simulates the dice game workflow:
// 1. Place bet on number (1-6)
// 2. Request randomness
// 3. Roll dice and resolve
// 4. Send callback payout if winner (6x payout)
func (s *MiniAppSimulator) SimulateDiceGame(ctx context.Context) error {
	appID := "builtin-dice-game"
	amount := int64(8000000) // 0.08 GAS bet
	chosenNumber := randomInt(1, 6)

	// Step 1: Place bet
	memo := fmt.Sprintf("dice:bet:%d:number:%d", time.Now().UnixNano(), chosenNumber)
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place bet: %w", err)
	}
	atomic.AddInt64(&s.diceGameBets, 1)

	// Step 2: Request randomness and roll
	_, err = s.invoker.RecordRandomness(ctx)
	if err != nil {
		if errors.Is(err, ErrRandomnessLogNotConfigured) {
			err = nil
		}
	}
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("roll randomness: %w", err)
	}

	// Step 3: Simulate outcome (1/6 win rate)
	rolledNumber := randomInt(1, 6)
	if rolledNumber == chosenNumber {
		atomic.AddInt64(&s.diceGameWins, 1)

		// Step 4: Send callback payout (6x bet minus 5% platform fee)
		payout := amount * 6 * 95 / 100
		winnerAddress := s.getRandomUserAddress()
		payoutMemo := fmt.Sprintf("dice:payout:%d:rolled:%d", time.Now().UnixNano(), rolledNumber)
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payout, payoutMemo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("dice payout: %w", err)
		}
		atomic.AddInt64(&s.diceGamePayouts, 1)
	}

	return nil
}

// SimulateScratchCard simulates the scratch card workflow:
// 1. Buy scratch card (payment)
// 2. Request randomness for reveal
// 3. Reveal and determine prize
// 4. Send callback payout if winner
func (s *MiniAppSimulator) SimulateScratchCard(ctx context.Context) error {
	appID := "builtin-scratch-card"
	cardType := randomInt(1, 3)         // 3 card types with different prices
	amount := int64(cardType) * 2000000 // 0.02-0.06 GAS per card

	// Step 1: Buy card
	memo := fmt.Sprintf("scratch:buy:%d:type:%d", time.Now().UnixNano(), cardType)
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy card: %w", err)
	}
	atomic.AddInt64(&s.scratchCardBuys, 1)

	// Step 2: Request randomness for reveal
	_, err = s.invoker.RecordRandomness(ctx)
	if err != nil {
		if errors.Is(err, ErrRandomnessLogNotConfigured) {
			err = nil
		}
	}
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("reveal randomness: %w", err)
	}

	// Step 3: Simulate outcome (20% win rate)
	if randomInt(1, 5) == 1 {
		atomic.AddInt64(&s.scratchCardWins, 1)

		// Step 4: Send callback payout (prize varies by card type: 2x, 5x, 10x)
		multiplier := int64(cardType * 2)        // Type 1: 2x, Type 2: 4x, Type 3: 6x
		payout := amount * multiplier * 95 / 100 // 5% platform fee
		winnerAddress := s.getRandomUserAddress()
		payoutMemo := fmt.Sprintf("scratch:payout:%d:prize:%dx", time.Now().UnixNano(), multiplier)
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payout, payoutMemo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("scratch payout: %w", err)
		}
		atomic.AddInt64(&s.scratchCardPayouts, 1)
	}

	return nil
}

// SimulatePredictionMarket simulates the prediction market workflow:
// 1. Query current price from PriceFeed
// 2. Place prediction bet (up/down)
// 3. Wait and resolve with new price
// 4. Send callback payout if prediction correct
func (s *MiniAppSimulator) SimulatePredictionMarket(ctx context.Context) error {
	appID := "builtin-prediction-market"
	amount := int64(20000000) // 0.2 GAS bet
	symbol := []string{"BTCUSD", "ETHUSD", "NEOUSD", "GASUSD"}[randomInt(0, 3)]
	prediction := randomInt(0, 1) // 0 = down, 1 = up

	// Step 1: Query current price (simulated by updating price feed)
	_, err := s.invoker.UpdatePriceFeed(ctx, symbol)
	if err != nil {
		if errors.Is(err, ErrPriceFeedNotConfigured) {
			err = nil
		}
	}
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("query price: %w", err)
	}

	// Step 2: Place prediction bet
	memo := fmt.Sprintf("predict:%s:%d:dir:%d", symbol, time.Now().UnixNano(), prediction)
	_, err = s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place prediction: %w", err)
	}
	atomic.AddInt64(&s.predictionBets, 1)

	// Step 3: Wait for price to change (simulated resolution period)
	// Note: We don't call UpdatePriceFeed again to avoid roundId conflicts
	// The runPriceFeedUpdater worker handles price updates
	time.Sleep(500 * time.Millisecond)
	atomic.AddInt64(&s.predictionResolves, 1)

	// Step 4: Simulate outcome (50% win rate) and send callback payout
	outcome := randomInt(0, 1)
	if outcome == prediction {
		// Prediction correct - send payout (1.9x bet, 5% platform fee)
		payout := amount * 190 / 100 * 95 / 100
		winnerAddress := s.getRandomUserAddress()
		payoutMemo := fmt.Sprintf("predict:payout:%s:%d:correct", symbol, time.Now().UnixNano())
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payout, payoutMemo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("prediction payout: %w", err)
		}
		atomic.AddInt64(&s.predictionPayouts, 1)
	}

	return nil
}

// SimulateFlashLoan simulates the flash loan workflow:
// 1. Borrow GAS (payment request)
// 2. Execute arbitrage (simulated)
// 3. Repay with fee
func (s *MiniAppSimulator) SimulateFlashLoan(ctx context.Context) error {
	appID := "builtin-flashloan"
	borrowAmount := int64(10000000) // 0.1 GAS loan (reduced to fit account balance)
	fee := borrowAmount * 9 / 10000 // 0.09% fee

	// Step 1: Request flash loan (borrow)
	memo := fmt.Sprintf("flashloan:borrow:%d:amount:%d", time.Now().UnixNano(), borrowAmount)
	_, err := s.invoker.PayToApp(ctx, appID, fee, memo) // Pay fee upfront
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("borrow: %w", err)
	}
	atomic.AddInt64(&s.flashloanBorrows, 1)

	// Step 2: Simulate arbitrage execution (just a delay)
	time.Sleep(100 * time.Millisecond)

	// Step 3: Repay loan (simulated - in real scenario this happens atomically)
	repayMemo := fmt.Sprintf("flashloan:repay:%d:amount:%d", time.Now().UnixNano(), borrowAmount)
	_, err = s.invoker.PayToApp(ctx, appID, borrowAmount, repayMemo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("repay: %w", err)
	}
	atomic.AddInt64(&s.flashloanRepays, 1)

	return nil
}

// SimulatePriceTicker simulates the price ticker workflow:
// 1. Query multiple price feeds (simulated - prices are updated by runPriceFeedUpdater)
// 2. Display prices (simulated)
// Note: We don't call UpdatePriceFeed here to avoid roundId conflicts with runPriceFeedUpdater
func (s *MiniAppSimulator) SimulatePriceTicker(ctx context.Context) error {
	symbols := []string{"BTCUSD", "ETHUSD", "NEOUSD", "GASUSD"}

	// Simulate querying price feeds (actual updates handled by runPriceFeedUpdater)
	for _, symbol := range symbols {
		// Just increment the counter - actual price updates are done by runPriceFeedUpdater
		_ = symbol // Use symbol to avoid unused variable warning
		atomic.AddInt64(&s.priceQueries, 1)
		time.Sleep(200 * time.Millisecond) // Small delay between queries
	}

	return nil
}

// SimulateGasSpin simulates the Gas Spin wheel workflow:
// 1. Place bet (payment)
// 2. Request VRF randomness
// 3. Determine prize tier (0-7)
// 4. Send callback payout if winner
func (s *MiniAppSimulator) SimulateGasSpin(ctx context.Context) error {
	appID := "builtin-gas-spin"
	// Variable bet amount: 0.05-0.5 GAS
	betMultiplier := randomInt(1, 10)
	amount := int64(betMultiplier * 5000000)

	// Step 1: Place bet
	memo := fmt.Sprintf("gasspin:bet:%d:amount:%d", time.Now().UnixNano(), amount)
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place spin bet: %w", err)
	}
	atomic.AddInt64(&s.gasSpinBets, 1)

	// Step 2: Request VRF randomness
	_, err = s.invoker.RecordRandomness(ctx)
	if err != nil {
		if errors.Is(err, ErrRandomnessLogNotConfigured) {
			err = nil
		}
	}
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("spin randomness: %w", err)
	}

	// Step 3: Determine prize tier (0-7)
	// Tier 0-2: Lose (37.5%)
	// Tier 3-5: Win 2x (37.5%)
	// Tier 6-7: Win 5x (25%)
	tier := randomInt(0, 7)
	var multiplier int64
	if tier >= 6 {
		multiplier = 5
	} else if tier >= 3 {
		multiplier = 2
	} else {
		multiplier = 0
	}

	// Step 4: Send payout if winner
	if multiplier > 0 {
		atomic.AddInt64(&s.gasSpinWins, 1)
		// Payout = bet * multiplier * 90% (10% platform fee)
		payout := amount * multiplier * 90 / 100
		winnerAddress := s.getRandomUserAddress()
		payoutMemo := fmt.Sprintf("gasspin:payout:%d:tier:%d:mult:%d", time.Now().UnixNano(), tier, multiplier)
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payout, payoutMemo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("spin payout: %w", err)
		}
		atomic.AddInt64(&s.gasSpinPayouts, 1)
	}

	return nil
}

// SimulatePricePredict simulates the binary options workflow:
// 1. Place bet on price direction (up/down)
// 2. Query current price from datafeed
// 3. Wait for resolution period
// 4. Query new price and resolve
// 5. Send callback payout if correct
func (s *MiniAppSimulator) SimulatePricePredict(ctx context.Context) error {
	appID := "builtin-price-predict"
	// Variable bet: 0.05-0.3 GAS (reduced to fit payout within account balance)
	betMultiplier := randomInt(1, 6)
	amount := int64(betMultiplier * 5000000)

	// Choose symbol and direction
	symbols := []string{"BTCUSD", "ETHUSD", "NEOUSD"}
	symbol := symbols[randomInt(0, len(symbols)-1)]
	direction := randomInt(0, 1) // 0=down, 1=up

	// Step 1: Place bet
	memo := fmt.Sprintf("predict:bet:%s:%d:%d", symbol, direction, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place prediction bet: %w", err)
	}
	atomic.AddInt64(&s.pricePredictBets, 1)

	// Step 2: Simulate price query (actual updates handled by runPriceFeedUpdater)
	// Note: We don't call UpdatePriceFeed here to avoid roundId conflicts
	time.Sleep(100 * time.Millisecond)

	// Step 3: Simulate resolution period (short delay)
	time.Sleep(500 * time.Millisecond)

	// Step 4: Resolve (50% win rate simulation)
	// Note: Price updates are handled by runPriceFeedUpdater
	outcome := randomInt(0, 1)
	if outcome == direction {
		atomic.AddInt64(&s.pricePredictWins, 1)
		// Payout = 1.9x bet * 95% (5% platform fee)
		payout := amount * 190 / 100 * 95 / 100
		winnerAddress := s.getRandomUserAddress()
		payoutMemo := fmt.Sprintf("predict:payout:%s:%d:correct", symbol, time.Now().UnixNano())
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payout, payoutMemo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("prediction payout: %w", err)
		}
		atomic.AddInt64(&s.pricePredictPayouts, 1)
	}

	return nil
}

// SimulateSecretVote simulates privacy-preserving voting:
// 1. Cast vote (payment)
// 2. TEE processes encrypted vote
// 3. Aggregate results (every N votes)
func (s *MiniAppSimulator) SimulateSecretVote(ctx context.Context) error {
	appID := "builtin-secret-vote"
	amount := int64(1000000) // 0.01 GAS per vote

	// Generate proposal ID
	proposalID := fmt.Sprintf("prop-%d", randomInt(1, 10))
	support := randomInt(0, 1) == 1

	// Step 1: Cast vote (payment)
	memo := fmt.Sprintf("vote:%s:%v:%d", proposalID, support, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("cast vote: %w", err)
	}
	atomic.AddInt64(&s.secretVoteCasts, 1)

	// Step 2: TEE processes vote (simulated)
	time.Sleep(100 * time.Millisecond)

	// Step 3: Tally every 5 votes
	if atomic.LoadInt64(&s.secretVoteCasts)%5 == 0 {
		atomic.AddInt64(&s.secretVoteTallies, 1)
	}

	return nil
}

// SimulateAITrader simulates the AI trading agent workflow:
// 1. Fetch price data from datafeed
// 2. Execute trade based on strategy
// 3. Pay trading fee
func (s *MiniAppSimulator) SimulateAITrader(ctx context.Context) error {
	appID := "builtin-ai-trader"
	// Trade amount: 0.05-0.2 GAS
	tradeMultiplier := randomInt(1, 4)
	amount := int64(tradeMultiplier * 5000000)

	// Simulate trade direction
	direction := []string{"buy", "sell"}[randomInt(0, 1)]
	symbol := []string{"NEOUSD", "GASUSD", "BTCUSD"}[randomInt(0, 2)]

	// Step 1: Pay trading fee
	memo := fmt.Sprintf("ai-trader:%s:%s:%d", direction, symbol, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("ai-trader trade: %w", err)
	}

	return nil
}

// SimulateGridBot simulates the grid trading bot workflow:
// 1. Place grid order at price level
// 2. Pay order fee
func (s *MiniAppSimulator) SimulateGridBot(ctx context.Context) error {
	appID := "builtin-grid-bot"
	// Order amount: 0.03-0.1 GAS
	orderMultiplier := randomInt(1, 3)
	amount := int64(orderMultiplier * 3000000)

	// Simulate order type
	orderType := []string{"buy", "sell"}[randomInt(0, 1)]
	priceLevel := randomInt(1, 10)

	// Step 1: Pay order fee
	memo := fmt.Sprintf("grid-bot:%s:level:%d:%d", orderType, priceLevel, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("grid-bot order: %w", err)
	}

	return nil
}

// SimulateNFTEvolve simulates the NFT evolution workflow:
// 1. Feed or play with pet
// 2. Pay care fee
func (s *MiniAppSimulator) SimulateNFTEvolve(ctx context.Context) error {
	appID := "builtin-nft-evolve"
	amount := int64(1000000) // 0.01 GAS per action

	// Simulate action type
	action := []string{"feed", "play"}[randomInt(0, 1)]

	// Step 1: Pay care fee
	memo := fmt.Sprintf("nft-evolve:%s:%d", action, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("nft-evolve action: %w", err)
	}

	return nil
}

// SimulateBridgeGuardian simulates the cross-chain bridge workflow:
// 1. Initiate bridge transfer
// 2. Pay bridge fee
func (s *MiniAppSimulator) SimulateBridgeGuardian(ctx context.Context) error {
	appID := "builtin-bridge-guardian"
	// Bridge amount: 0.5-2 GAS
	bridgeMultiplier := randomInt(1, 4)
	amount := int64(bridgeMultiplier * 50000000)

	// Simulate destination chain
	chain := []string{"eth", "btc"}[randomInt(0, 1)]

	// Step 1: Pay bridge fee
	memo := fmt.Sprintf("bridge:%s:%d:%d", chain, amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("bridge transfer: %w", err)
	}

	return nil
}

// Helper function to generate random int in range [min, max]
func randomInt(min, max int) int {
	if min >= max {
		return min
	}
	n, _ := rand.Int(rand.Reader, big.NewInt(int64(max-min+1)))
	return min + int(n.Int64())
}

// generateGameID generates a unique game ID
func generateGameID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

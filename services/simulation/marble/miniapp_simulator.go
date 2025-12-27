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

	neoaccountsclient "github.com/R3E-Network/service_layer/infrastructure/accountpool/client"
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
	// MegaMillions stats
	megaMillionsTickets int64
	megaMillionsDraws   int64
	megaMillionsWins    int64
	megaMillionsPayouts int64
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
			AppID:       "builtin-mega-millions",
			Name:        "Mega Millions",
			Category:    "gaming",
			Interval:    8 * time.Second,
			BetAmount:   20000000, // 0.2 GAS per ticket
			Description: "Multi-tier lottery with 9 prize levels",
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
		"mega_millions": map[string]int64{
			"tickets": atomic.LoadInt64(&s.megaMillionsTickets),
			"draws":   atomic.LoadInt64(&s.megaMillionsDraws),
			"wins":    atomic.LoadInt64(&s.megaMillionsWins),
			"payouts": atomic.LoadInt64(&s.megaMillionsPayouts),
		},
		"errors": atomic.LoadInt64(&s.simulationErrors),
	}
}

// SimulateLottery simulates the lottery workflow as a real user would experience:
// 1. User pays GAS to PaymentHub to buy tickets (simulates SDK payGAS call)
// 2. Platform processes payment and records tickets in MiniApp contract
// 3. On draw trigger: Platform requests randomness and draws winner
// 4. Platform sends payout to winner
func (s *MiniAppSimulator) SimulateLottery(ctx context.Context) error {
	appID := "builtin-lottery"
	ticketCount := randomInt(1, 5)
	amount := int64(ticketCount) * 10000000 // 0.1 GAS per ticket

	// Step 1: USER ACTION - Pay GAS to PaymentHub (simulates real user via SDK)
	memo := fmt.Sprintf("lottery:round:%d:tickets:%d:%d", atomic.LoadInt64(&s.lotteryDraws)+1, ticketCount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy tickets: %w", err)
	}
	atomic.AddInt64(&s.lotteryTickets, int64(ticketCount))

	// Step 2: PLATFORM ACTION - Process payment and record in MiniApp contract (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "recordTickets", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: ticketCount},
		})
	}

	// Step 3: PLATFORM ACTION - Draw winner every 5 tickets
	if atomic.LoadInt64(&s.lotteryTickets)%5 == 0 {
		// Request randomness for draw
		_, err = s.invoker.RecordRandomness(ctx)
		if err != nil && !errors.Is(err, ErrRandomnessLogNotConfigured) {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("draw randomness: %w", err)
		}
		atomic.AddInt64(&s.lotteryDraws, 1)

		// Platform invokes MiniApp contract to draw winner
		if s.invoker.HasMiniAppContract(appID) {
			randomness := generateRandomBytes(32)
			_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "drawWinner", []neoaccountsclient.ContractParam{
				{Type: "ByteArray", Value: hex.EncodeToString(randomness)},
			})
		}

		// Step 4: PLATFORM ACTION - Send payout to winner
		winnerAddress := s.getRandomUserAddress()
		prizeAmount := amount * 3 // 3x prize pool
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, prizeAmount, "lottery:win")
		if err == nil {
			atomic.AddInt64(&s.lotteryPayouts, 1)
		}
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

// SimulateCoinFlip simulates the coin flip workflow as a real user would experience:
// 1. User pays GAS to PaymentHub to place bet (simulates SDK payGAS call)
// 2. Platform processes bet and records in MiniApp contract
// 3. Platform requests randomness and determines outcome
// 4. Platform sends payout if user wins (2x bet)
func (s *MiniAppSimulator) SimulateCoinFlip(ctx context.Context) error {
	appID := "builtin-coin-flip"
	amount := int64(5000000) // 0.05 GAS per flip
	choice := randomInt(0, 1) // 0=heads, 1=tails

	// Step 1: USER ACTION - Pay GAS to PaymentHub (simulates real user via SDK)
	memo := fmt.Sprintf("coin-flip:%d:%d", choice, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place bet: %w", err)
	}
	atomic.AddInt64(&s.coinFlipBets, 1)

	// Step 2: PLATFORM ACTION - Record bet in MiniApp contract (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "recordBet", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: amount},
			{Type: "Integer", Value: choice},
		})
	}

	// Step 3: PLATFORM ACTION - Request randomness and determine outcome
	_, _ = s.invoker.RecordRandomness(ctx)
	outcome := randomInt(0, 1)

	// Resolve via MiniApp contract (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		randomness := generateRandomBytes(32)
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "resolve", []neoaccountsclient.ContractParam{
			{Type: "ByteArray", Value: hex.EncodeToString(randomness)},
		})
	}

	// Step 4: PLATFORM ACTION - Send payout if user wins (50% chance)
	if outcome == choice {
		atomic.AddInt64(&s.coinFlipWins, 1)
		winnerAddress := s.getRandomUserAddress()
		payoutAmount := amount * 2 // 2x payout
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payoutAmount, "coin-flip:win")
		if err == nil {
			atomic.AddInt64(&s.coinFlipPayouts, 1)
		}
	}

	return nil
}

// SimulateDiceGame simulates the dice game workflow as a real user would experience:
// 1. User pays GAS to PaymentHub to place bet (simulates SDK payGAS call)
// 2. Platform processes bet and records in MiniApp contract
// 3. Platform requests randomness and determines outcome
// 4. Platform sends payout if user wins (6x bet)
func (s *MiniAppSimulator) SimulateDiceGame(ctx context.Context) error {
	appID := "builtin-dice-game"
	amount := int64(8000000) // 0.08 GAS per roll
	chosenNumber := randomInt(1, 6)

	// Step 1: USER ACTION - Pay GAS to PaymentHub
	memo := fmt.Sprintf("dice:%d:%d", chosenNumber, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place bet: %w", err)
	}
	atomic.AddInt64(&s.diceGameBets, 1)

	// Step 2: PLATFORM ACTION - Record bet in MiniApp contract (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "recordBet", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: amount},
			{Type: "Integer", Value: chosenNumber},
		})
	}

	// Step 3: PLATFORM ACTION - Request randomness and determine outcome
	_, _ = s.invoker.RecordRandomness(ctx)
	rolledNumber := randomInt(1, 6)

	// Resolve via MiniApp contract (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		randomness := generateRandomBytes(32)
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "resolve", []neoaccountsclient.ContractParam{
			{Type: "ByteArray", Value: hex.EncodeToString(randomness)},
		})
	}

	// Step 4: PLATFORM ACTION - Send payout if user wins (1/6 chance, 6x payout)
	if rolledNumber == chosenNumber {
		atomic.AddInt64(&s.diceGameWins, 1)
		winnerAddress := s.getRandomUserAddress()
		payoutAmount := amount * 6 // 6x payout
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payoutAmount, "dice:win")
		if err == nil {
			atomic.AddInt64(&s.diceGamePayouts, 1)
		}
	}

	return nil
}

// SimulateScratchCard simulates the scratch card workflow as a real user would experience:
// 1. User pays GAS to PaymentHub to buy card (simulates SDK payGAS call)
// 2. Platform processes purchase and records in MiniApp contract
// 3. Platform requests randomness and reveals card
// 4. Platform sends payout if user wins (20% chance, 5x payout)
func (s *MiniAppSimulator) SimulateScratchCard(ctx context.Context) error {
	appID := "builtin-scratch-card"
	cardType := randomInt(1, 3)
	amount := int64(2000000) // 0.02 GAS per card

	// Step 1: USER ACTION - Pay GAS to PaymentHub
	memo := fmt.Sprintf("scratch:type:%d:%d", cardType, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy card: %w", err)
	}
	atomic.AddInt64(&s.scratchCardBuys, 1)

	// Step 2: PLATFORM ACTION - Record purchase in MiniApp contract (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "recordPurchase", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: cardType},
		})
	}

	// Step 3: PLATFORM ACTION - Request randomness and reveal
	_, _ = s.invoker.RecordRandomness(ctx)

	if s.invoker.HasMiniAppContract(appID) {
		randomness := generateRandomBytes(32)
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "reveal", []neoaccountsclient.ContractParam{
			{Type: "ByteArray", Value: hex.EncodeToString(randomness)},
		})
	}

	// Step 4: PLATFORM ACTION - Send payout if user wins (20% chance, 5x payout)
	if randomInt(1, 5) == 1 {
		atomic.AddInt64(&s.scratchCardWins, 1)
		winnerAddress := s.getRandomUserAddress()
		payoutAmount := amount * 5 // 5x payout
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payoutAmount, "scratch:win")
		if err == nil {
			atomic.AddInt64(&s.scratchCardPayouts, 1)
		}
	}

	return nil
}

// SimulateMegaMillions simulates the Mega Millions lottery workflow:
// 1. User pays GAS to buy ticket with 5 main numbers + 1 mega ball
// 2. Platform records ticket in MiniApp contract
// 3. Platform draws winning numbers periodically
// 4. Platform calculates tier and sends payout
func (s *MiniAppSimulator) SimulateMegaMillions(ctx context.Context) error {
	appID := "builtin-mega-millions"
	amount := int64(20000000) // 0.2 GAS per ticket

	// Generate random ticket: 5 main (1-70) + 1 mega (1-25)
	mainNumbers := make([]byte, 5)
	for i := 0; i < 5; i++ {
		mainNumbers[i] = byte(randomInt(1, 70))
	}
	megaBall := byte(randomInt(1, 25))

	// Step 1: USER ACTION - Pay GAS to PaymentHub
	memo := fmt.Sprintf("mega:%d-%d-%d-%d-%d+%d:%d",
		mainNumbers[0], mainNumbers[1], mainNumbers[2],
		mainNumbers[3], mainNumbers[4], megaBall, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("buy ticket: %w", err)
	}
	atomic.AddInt64(&s.megaMillionsTickets, 1)

	// Step 2: PLATFORM ACTION - Record ticket (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "BuyTicket", []neoaccountsclient.ContractParam{
			{Type: "ByteArray", Value: hex.EncodeToString(mainNumbers)},
			{Type: "Integer", Value: int(megaBall)},
		})
	}

	// Step 3: PLATFORM ACTION - Draw every 10 tickets
	if atomic.LoadInt64(&s.megaMillionsTickets)%10 == 0 {
		_, _ = s.invoker.RecordRandomness(ctx)
		atomic.AddInt64(&s.megaMillionsDraws, 1)

		// Generate winning numbers
		winning := make([]byte, 6)
		for i := 0; i < 5; i++ {
			winning[i] = byte(randomInt(1, 70))
		}
		winning[5] = byte(randomInt(1, 25))

		// Step 4: Calculate tier and payout
		tier := s.calculateMegaTier(mainNumbers, megaBall, winning)
		if tier < 9 {
			atomic.AddInt64(&s.megaMillionsWins, 1)
			winnerAddress := s.getRandomUserAddress()
			payoutAmount := s.getMegaPrize(tier)
			_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payoutAmount, fmt.Sprintf("mega:tier%d", tier))
			if err == nil {
				atomic.AddInt64(&s.megaMillionsPayouts, 1)
			}
		}
	}

	return nil
}

// calculateMegaTier calculates prize tier (0=jackpot, 1-8=other, 9=no win)
func (s *MiniAppSimulator) calculateMegaTier(ticket []byte, mega byte, winning []byte) int {
	matches := 0
	megaMatch := mega == winning[5]
	for i := 0; i < 5; i++ {
		for j := 0; j < 5; j++ {
			if ticket[i] == winning[j] {
				matches++
				break
			}
		}
	}
	if matches == 5 && megaMatch {
		return 0
	}
	if matches == 5 {
		return 1
	}
	if matches == 4 && megaMatch {
		return 2
	}
	if matches == 4 {
		return 3
	}
	if matches == 3 && megaMatch {
		return 4
	}
	if matches == 3 {
		return 5
	}
	if matches == 2 && megaMatch {
		return 6
	}
	if matches == 1 && megaMatch {
		return 7
	}
	if megaMatch {
		return 8
	}
	return 9
}

// getMegaPrize returns prize amount for tier
func (s *MiniAppSimulator) getMegaPrize(tier int) int64 {
	prizes := []int64{
		100000000000, // Tier 0: Jackpot 1000 GAS
		10000000000,  // Tier 1: 100 GAS
		5000000000,   // Tier 2: 50 GAS
		500000000,    // Tier 3: 5 GAS
		200000000,    // Tier 4: 2 GAS
		50000000,     // Tier 5: 0.5 GAS
		50000000,     // Tier 6: 0.5 GAS
		20000000,     // Tier 7: 0.2 GAS
		10000000,     // Tier 8: 0.1 GAS
	}
	if tier >= 0 && tier < len(prizes) {
		return prizes[tier]
	}
	return 0
}

// SimulatePredictionMarket simulates the prediction market workflow as a real user would experience:
// 1. User pays GAS to PaymentHub to place prediction (simulates SDK payGAS call)
// 2. Platform records prediction in MiniApp contract
// 3. Platform resolves prediction based on price data
// 4. Platform sends payout if user wins (2x bet)
func (s *MiniAppSimulator) SimulatePredictionMarket(ctx context.Context) error {
	appID := "builtin-prediction-market"
	amount := int64(20000000) // 0.2 GAS per prediction
	symbol := []string{"BTCUSD", "ETHUSD", "NEOUSD", "GASUSD"}[randomInt(0, 3)]
	prediction := randomInt(0, 1) // 0=down, 1=up

	// Step 1: USER ACTION - Pay GAS to PaymentHub
	memo := fmt.Sprintf("predict:%s:%d:%d", symbol, prediction, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("place prediction: %w", err)
	}
	atomic.AddInt64(&s.predictionBets, 1)

	// Step 2: PLATFORM ACTION - Record prediction in MiniApp contract (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "recordPrediction", []neoaccountsclient.ContractParam{
			{Type: "String", Value: symbol},
			{Type: "Integer", Value: prediction},
			{Type: "Integer", Value: amount},
		})
	}

	// Step 3: PLATFORM ACTION - Wait and resolve
	time.Sleep(100 * time.Millisecond)
	outcome := randomInt(0, 1)

	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "resolve", []neoaccountsclient.ContractParam{
			{Type: "String", Value: symbol},
			{Type: "Integer", Value: outcome},
		})
	}
	atomic.AddInt64(&s.predictionResolves, 1)

	// Step 4: PLATFORM ACTION - Send payout if user wins (50% chance, 2x payout)
	if outcome == prediction {
		winnerAddress := s.getRandomUserAddress()
		payoutAmount := amount * 2
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payoutAmount, "predict:win")
		if err == nil {
			atomic.AddInt64(&s.predictionPayouts, 1)
		}
	}

	return nil
}

// SimulateFlashLoan simulates the flash loan workflow as a real user would experience:
// 1. User pays fee to PaymentHub (simulates SDK payGAS call)
// 2. Platform executes flash loan via MiniApp contract
// Note: Flash loans are atomic - borrow and repay happen in same transaction
func (s *MiniAppSimulator) SimulateFlashLoan(ctx context.Context) error {
	appID := "builtin-flashloan"
	feeAmount := int64(1000000) // 0.01 GAS fee

	// Step 1: USER ACTION - Pay fee to PaymentHub
	memo := fmt.Sprintf("flashloan:fee:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, feeAmount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("flash loan fee: %w", err)
	}

	// Step 2: PLATFORM ACTION - Execute flash loan via MiniApp contract (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		borrowAmount := int64(100000000) // 1 GAS borrow
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "execute", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: borrowAmount},
		})
	}

	atomic.AddInt64(&s.flashloanBorrows, 1)
	atomic.AddInt64(&s.flashloanRepays, 1)

	return nil
}

// SimulatePriceTicker simulates the price ticker workflow as a real user would experience:
// This is a read-only operation - no payment required
// User queries price data via MiniApp contract
func (s *MiniAppSimulator) SimulatePriceTicker(ctx context.Context) error {
	appID := "builtin-price-ticker"
	symbol := []string{"NEOUSD", "GASUSD", "BTCUSD", "ETHUSD"}[randomInt(0, 3)]

	// PLATFORM ACTION - Query price via MiniApp contract (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "queryPrice", []neoaccountsclient.ContractParam{
			{Type: "String", Value: symbol},
		})
	}
	atomic.AddInt64(&s.priceQueries, 1)

	return nil
}

// SimulateGasSpin simulates the Gas Spin wheel workflow as a real user would experience:
// 1. User pays GAS to PaymentHub to spin (simulates SDK payGAS call)
// 2. Platform processes spin via MiniApp contract
// 3. Platform sends payout based on wheel result
func (s *MiniAppSimulator) SimulateGasSpin(ctx context.Context) error {
	appID := "builtin-gas-spin"
	amount := int64(randomInt(1, 10) * 5000000) // 0.05-0.5 GAS

	// Step 1: USER ACTION - Pay GAS to PaymentHub
	memo := fmt.Sprintf("gas-spin:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("spin: %w", err)
	}
	atomic.AddInt64(&s.gasSpinBets, 1)

	// Step 2: PLATFORM ACTION - Process spin via MiniApp contract (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "processSpin", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: amount},
		})
	}

	// Step 3: PLATFORM ACTION - Send payout (62.5% win chance)
	if randomInt(0, 7) >= 3 {
		atomic.AddInt64(&s.gasSpinWins, 1)
		winnerAddress := s.getRandomUserAddress()
		multiplier := []int64{1, 2, 3, 5, 10}[randomInt(0, 4)]
		payoutAmount := amount * multiplier
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payoutAmount, "gas-spin:win")
		if err == nil {
			atomic.AddInt64(&s.gasSpinPayouts, 1)
		}
	}

	return nil
}

// SimulatePricePredict simulates binary options as a real user would experience:
// 1. User pays GAS to PaymentHub (simulates SDK payGAS call)
// 2. Platform records prediction in MiniApp contract
// 3. Platform sends payout if user wins (2x bet)
func (s *MiniAppSimulator) SimulatePricePredict(ctx context.Context) error {
	appID := "builtin-price-predict"
	amount := int64(randomInt(1, 6) * 5000000) // 0.05-0.3 GAS
	direction := randomInt(0, 1)              // 0=down, 1=up

	// Step 1: USER ACTION - Pay GAS to PaymentHub
	memo := fmt.Sprintf("price-predict:%d:%d", direction, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("predict: %w", err)
	}
	atomic.AddInt64(&s.pricePredictBets, 1)

	// Step 2: PLATFORM ACTION - Record prediction (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "recordPrediction", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: direction},
			{Type: "Integer", Value: amount},
		})
	}

	// Step 3: PLATFORM ACTION - Send payout if user wins (50% chance, 2x)
	outcome := randomInt(0, 1)
	if outcome == direction {
		atomic.AddInt64(&s.pricePredictWins, 1)
		winnerAddress := s.getRandomUserAddress()
		payoutAmount := amount * 2
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, payoutAmount, "price-predict:win")
		if err == nil {
			atomic.AddInt64(&s.pricePredictPayouts, 1)
		}
	}

	return nil
}

// SimulateSecretVote simulates privacy-preserving voting as a real user would experience:
// 1. User pays GAS to PaymentHub to cast vote (simulates SDK payGAS call)
// 2. Platform records vote in MiniApp contract
// 3. Platform tallies votes periodically
func (s *MiniAppSimulator) SimulateSecretVote(ctx context.Context) error {
	appID := "builtin-secret-vote"
	amount := int64(1000000) // 0.01 GAS per vote

	proposalID := fmt.Sprintf("prop-%d", randomInt(1, 10))
	support := randomInt(0, 1)

	// Step 1: USER ACTION - Pay GAS to PaymentHub
	memo := fmt.Sprintf("vote:%s:%d:%d", proposalID, support, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("cast vote: %w", err)
	}
	atomic.AddInt64(&s.secretVoteCasts, 1)

	// Step 2: PLATFORM ACTION - Record vote (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "recordVote", []neoaccountsclient.ContractParam{
			{Type: "String", Value: proposalID},
			{Type: "Integer", Value: support},
		})
	}

	// Step 3: PLATFORM ACTION - Tally every 5 votes
	if atomic.LoadInt64(&s.secretVoteCasts)%5 == 0 {
		if s.invoker.HasMiniAppContract(appID) {
			_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "tallyVotes", []neoaccountsclient.ContractParam{
				{Type: "String", Value: proposalID},
			})
		}
		atomic.AddInt64(&s.secretVoteTallies, 1)
	}

	return nil
}

// SimulateAITrader simulates the AI trading agent workflow as a real user would experience:
// 1. User pays GAS to PaymentHub (simulates SDK payGAS call)
// 2. Platform executes trade via MiniApp contract
func (s *MiniAppSimulator) SimulateAITrader(ctx context.Context) error {
	appID := "builtin-ai-trader"
	tradeMultiplier := randomInt(1, 4)
	amount := int64(tradeMultiplier * 5000000) // 0.05-0.2 GAS
	direction := randomInt(0, 1)
	symbol := []string{"NEOUSD", "GASUSD", "BTCUSD"}[randomInt(0, 2)]

	// Step 1: USER ACTION - Pay GAS to PaymentHub
	memo := fmt.Sprintf("ai-trader:%s:%d:%d", symbol, direction, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("ai-trader trade: %w", err)
	}

	// Step 2: PLATFORM ACTION - Execute trade (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "executeTrade", []neoaccountsclient.ContractParam{
			{Type: "String", Value: symbol},
			{Type: "Integer", Value: direction},
			{Type: "Integer", Value: amount},
		})
	}

	return nil
}

// SimulateGridBot simulates the grid trading bot workflow as a real user would experience:
// 1. User pays GAS to PaymentHub (simulates SDK payGAS call)
// 2. Platform places order via MiniApp contract
func (s *MiniAppSimulator) SimulateGridBot(ctx context.Context) error {
	appID := "builtin-grid-bot"
	orderMultiplier := randomInt(1, 3)
	amount := int64(orderMultiplier * 3000000) // 0.03-0.1 GAS
	orderType := randomInt(0, 1)
	priceLevel := randomInt(1, 10)

	// Step 1: USER ACTION - Pay GAS to PaymentHub
	memo := fmt.Sprintf("grid-bot:%d:level:%d:%d", orderType, priceLevel, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("grid-bot order: %w", err)
	}

	// Step 2: PLATFORM ACTION - Place order (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "placeOrder", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: orderType},
			{Type: "Integer", Value: priceLevel},
			{Type: "Integer", Value: amount},
		})
	}

	return nil
}

// SimulateNFTEvolve simulates the NFT evolution workflow as a real user would experience:
// 1. User pays GAS to PaymentHub (simulates SDK payGAS call)
// 2. Platform performs action via MiniApp contract
func (s *MiniAppSimulator) SimulateNFTEvolve(ctx context.Context) error {
	appID := "builtin-nft-evolve"
	amount := int64(1000000) // 0.01 GAS per action
	action := randomInt(0, 1) // 0=feed, 1=play

	// Step 1: USER ACTION - Pay GAS to PaymentHub
	actionName := []string{"feed", "play"}[action]
	memo := fmt.Sprintf("nft-evolve:%s:%d", actionName, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("nft-evolve action: %w", err)
	}

	// Step 2: PLATFORM ACTION - Perform action (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "performAction", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: action},
		})
	}

	return nil
}

// SimulateBridgeGuardian simulates the cross-chain bridge workflow as a real user would experience:
// 1. User pays GAS to PaymentHub (simulates SDK payGAS call)
// 2. Platform initiates bridge via MiniApp contract
func (s *MiniAppSimulator) SimulateBridgeGuardian(ctx context.Context) error {
	appID := "builtin-bridge-guardian"
	bridgeMultiplier := randomInt(1, 2)
	amount := int64(bridgeMultiplier * 30000000) // 0.3-0.6 GAS (fits within 1 GAS account balance)
	chain := randomInt(0, 1) // 0=eth, 1=btc

	// Step 1: USER ACTION - Pay GAS to PaymentHub
	chainName := []string{"eth", "btc"}[chain]
	memo := fmt.Sprintf("bridge:%s:%d:%d", chainName, amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("bridge transfer: %w", err)
	}

	// Step 2: PLATFORM ACTION - Initiate bridge (if configured)
	if s.invoker.HasMiniAppContract(appID) {
		_, _ = s.invoker.InvokeMiniAppContract(ctx, appID, "initiateBridge", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: chain},
			{Type: "Integer", Value: amount},
		})
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

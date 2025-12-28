// Package neosimulation provides MiniApp workflow simulation.
package neosimulation

import (
	"crypto/rand"
	"encoding/hex"
	"math/big"
	"time"
)

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
		// Gaming
		{AppID: "builtin-lottery", Name: "Neo Lottery", Category: "gaming", Interval: 5 * time.Second, BetAmount: 10000000, Description: "Buy lottery tickets, draw winners"},
		{AppID: "builtin-coin-flip", Name: "Neo Coin Flip", Category: "gaming", Interval: 3 * time.Second, BetAmount: 5000000, Description: "50/50 coin flip, double or nothing"},
		{AppID: "builtin-dice-game", Name: "Neo Dice", Category: "gaming", Interval: 4 * time.Second, BetAmount: 8000000, Description: "Roll dice, win up to 6x"},
		{AppID: "builtin-scratch-card", Name: "Neo Scratch Cards", Category: "gaming", Interval: 6 * time.Second, BetAmount: 2000000, Description: "Instant win scratch cards"},
		{AppID: "builtin-mega-millions", Name: "Mega Millions", Category: "gaming", Interval: 10 * time.Second, BetAmount: 20000000, Description: "Multi-tier lottery with 9 prize levels"},
		{AppID: "builtin-gas-spin", Name: "Gas Spin", Category: "gaming", Interval: 5 * time.Second, BetAmount: 5000000, Description: "Lucky wheel with 8 prize tiers"},
		// DeFi
		{AppID: "builtin-prediction-market", Name: "Prediction Market", Category: "defi", Interval: 8 * time.Second, BetAmount: 20000000, Description: "Bet on price movements"},
		{AppID: "builtin-flashloan", Name: "Flash Loan", Category: "defi", Interval: 15 * time.Second, BetAmount: 100000000, Description: "Instant borrow and repay"},
		{AppID: "builtin-price-ticker", Name: "Price Ticker", Category: "defi", Interval: 10 * time.Second, BetAmount: 0, Description: "Query price feeds"},
		{AppID: "builtin-price-predict", Name: "Price Predict", Category: "defi", Interval: 6 * time.Second, BetAmount: 10000000, Description: "Binary options on price"},
		{AppID: "builtin-turbo-options", Name: "Turbo Options", Category: "defi", Interval: 5 * time.Second, BetAmount: 50000000, Description: "Ultra-fast binary options"},
		{AppID: "builtin-il-guard", Name: "IL Guard", Category: "defi", Interval: 10 * time.Second, BetAmount: 10000000, Description: "Impermanent loss protection"},
		// Social
		{AppID: "builtin-secret-vote", Name: "Secret Vote", Category: "social", Interval: 10 * time.Second, BetAmount: 1000000, Description: "Privacy-preserving voting"},
		{AppID: "builtin-secret-poker", Name: "Secret Poker", Category: "social", Interval: 15 * time.Second, BetAmount: 50000000, Description: "TEE Texas Hold'em"},
		{AppID: "builtin-micro-predict", Name: "Micro Predict", Category: "social", Interval: 5 * time.Second, BetAmount: 10000000, Description: "60-second price predictions"},
		{AppID: "builtin-red-envelope", Name: "Red Envelope", Category: "social", Interval: 8 * time.Second, BetAmount: 20000000, Description: "Social GAS red packets"},
		{AppID: "builtin-gas-circle", Name: "Gas Circle", Category: "social", Interval: 10 * time.Second, BetAmount: 10000000, Description: "Daily savings circle with lottery"},
		// Governance & Advanced
		{AppID: "builtin-gov-booster", Name: "Gov Booster", Category: "governance", Interval: 15 * time.Second, BetAmount: 1000000, Description: "bNEO governance optimization"},
		{AppID: "builtin-ai-trader", Name: "AI Trader", Category: "advanced", Interval: 10 * time.Second, BetAmount: 10000000, Description: "Autonomous AI trading agent"},
		{AppID: "builtin-grid-bot", Name: "Grid Bot", Category: "advanced", Interval: 10 * time.Second, BetAmount: 5000000, Description: "Automated grid trading"},
		{AppID: "builtin-nft-evolve", Name: "NFT Evolve", Category: "advanced", Interval: 15 * time.Second, BetAmount: 1000000, Description: "Dynamic NFT evolution engine"},
		{AppID: "builtin-bridge-guardian", Name: "Bridge Guardian", Category: "advanced", Interval: 20 * time.Second, BetAmount: 30000000, Description: "Cross-chain asset bridge"},
		{AppID: "builtin-fog-chess", Name: "Fog Chess", Category: "advanced", Interval: 15 * time.Second, BetAmount: 10000000, Description: "Chess with fog of war using TEE"},
	}
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

// generateRandomBytes generates random bytes for game outcomes

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
		{AppID: "miniapp-lottery", Name: "Neo Lottery", Category: "gaming", Interval: 5 * time.Second, BetAmount: 10000000, Description: "Buy lottery tickets, draw winners"},
		{AppID: "miniapp-coin-flip", Name: "Neo Coin Flip", Category: "gaming", Interval: 3 * time.Second, BetAmount: 5000000, Description: "50/50 coin flip, double or nothing"},
		{AppID: "miniapp-dice-game", Name: "Neo Dice", Category: "gaming", Interval: 4 * time.Second, BetAmount: 8000000, Description: "Roll dice, win up to 6x"},
		{AppID: "miniapp-scratch-card", Name: "Neo Scratch Cards", Category: "gaming", Interval: 6 * time.Second, BetAmount: 2000000, Description: "Instant win scratch cards"},
		{AppID: "miniapp-mega-millions", Name: "Mega Millions", Category: "gaming", Interval: 10 * time.Second, BetAmount: 20000000, Description: "Multi-tier lottery with 9 prize levels"},
		{AppID: "miniapp-gas-spin", Name: "Gas Spin", Category: "gaming", Interval: 5 * time.Second, BetAmount: 5000000, Description: "Lucky wheel with 8 prize tiers"},
		{AppID: "miniapp-neo-crash", Name: "Neo Crash", Category: "gaming", Interval: 4 * time.Second, BetAmount: 10000000, Description: "Crash game - cash out before it crashes"},
		{AppID: "miniapp-throne-of-gas", Name: "Throne of GAS", Category: "gaming", Interval: 8 * time.Second, BetAmount: 110000000, Description: "King of the hill - claim the throne"},
		{AppID: "miniapp-doomsday-clock", Name: "Doomsday Clock", Category: "gaming", Interval: 10 * time.Second, BetAmount: 100000000, Description: "FOMO3D style - last buyer wins the pot"},
		// DeFi
		{AppID: "miniapp-flashloan", Name: "Flash Loan", Category: "defi", Interval: 15 * time.Second, BetAmount: 100000000, Description: "Instant borrow and repay"},
		{AppID: "miniapp-price-predict", Name: "Price Predict", Category: "defi", Interval: 6 * time.Second, BetAmount: 10000000, Description: "Binary options on price"},
		{AppID: "miniapp-turbo-options", Name: "Turbo Options", Category: "defi", Interval: 5 * time.Second, BetAmount: 50000000, Description: "Ultra-fast binary options"},
		// Social
		{AppID: "miniapp-secret-poker", Name: "Secret Poker", Category: "social", Interval: 15 * time.Second, BetAmount: 50000000, Description: "TEE Texas Hold'em"},
		{AppID: "miniapp-micro-predict", Name: "Micro Predict", Category: "social", Interval: 5 * time.Second, BetAmount: 10000000, Description: "60-second price predictions"},
		{AppID: "miniapp-red-envelope", Name: "Red Envelope", Category: "social", Interval: 8 * time.Second, BetAmount: 20000000, Description: "Social GAS red packets"},
		{AppID: "miniapp-gas-circle", Name: "Gas Circle", Category: "social", Interval: 10 * time.Second, BetAmount: 10000000, Description: "Daily savings circle with lottery"},
		{AppID: "miniapp-time-capsule", Name: "TEE Time Capsule", Category: "social", Interval: 10 * time.Second, BetAmount: 20000000, Description: "Encrypted messages unlocked by time or price"},
		// Governance & Advanced
		{AppID: "miniapp-govbooster", Name: "Gov Booster", Category: "governance", Interval: 15 * time.Second, BetAmount: 1000000, Description: "bNEO governance optimization"},
		{AppID: "miniapp-dev-tipping", Name: "EcoBoost", Category: "social", Interval: 5 * time.Second, BetAmount: 100000000, Description: "Support the builders who power the ecosystem"},
		// Phase 7 - Advanced DeFi & Social
		{AppID: "miniapp-heritage-trust", Name: "Heritage Trust", Category: "defi", Interval: 20 * time.Second, BetAmount: 100000000, Description: "Living trust DAO with auto-inheritance"},
		{AppID: "miniapp-graveyard", Name: "Graveyard", Category: "social", Interval: 8 * time.Second, BetAmount: 10000000, Description: "Digital graveyard - paid data deletion"},
		{AppID: "miniapp-compound-capsule", Name: "Compound Capsule", Category: "defi", Interval: 12 * time.Second, BetAmount: 50000000, Description: "Auto-compounding time-locked savings"},
		{AppID: "miniapp-self-loan", Name: "Self Loan", Category: "defi", Interval: 15 * time.Second, BetAmount: 100000000, Description: "Alchemix-style self-repaying loans"},
		{AppID: "miniapp-burn-league", Name: "Burn League", Category: "gaming", Interval: 8 * time.Second, BetAmount: 20000000, Description: "Burn-to-earn deflationary rewards"},
		// Phase 8 - Creative & Social
		{AppID: "miniapp-puzzle-mining", Name: "Puzzle Mining", Category: "gaming", Interval: 10 * time.Second, BetAmount: 5000000, Description: "Solve puzzles to mine rewards"},
		{AppID: "miniapp-unbreakablevault", Name: "Unbreakable Vault", Category: "defi", Interval: 15 * time.Second, BetAmount: 50000000, Description: "Time-locked vault with conditions"},
		{AppID: "miniapp-million-piece-map", Name: "Million Piece Map", Category: "creative", Interval: 10 * time.Second, BetAmount: 1000000, Description: "Collaborative pixel map ownership"},
		{AppID: "miniapp-cryptoriddle", Name: "Crypto Riddle", Category: "gaming", Interval: 8 * time.Second, BetAmount: 10000000, Description: "Password red envelope hunter"},
		// Phase 9 - New MiniApps (3)
		{AppID: "miniapp-grant-share", Name: "GrantShare", Category: "social", Interval: 10 * time.Second, BetAmount: 50000000, Description: "Community grant funding platform"},
		{AppID: "miniapp-neo-ns", Name: "Neo Name Service", Category: "utility", Interval: 15 * time.Second, BetAmount: 10000000, Description: "Register and manage .neo domain names"},
		{AppID: "miniapp-dailycheckin", Name: "Daily Check-in", Category: "utility", Interval: 5 * time.Second, BetAmount: 100000, Description: "Daily check-in for streak rewards"},
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

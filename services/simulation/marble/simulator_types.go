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
// NOTE: Reduced to 10 core apps for stability (2026-01-08)
// IMPORTANT: AppIDs use miniapp- prefix as the standard naming convention
func AllMiniApps() []MiniAppConfig {
	return []MiniAppConfig{
		// Core Gaming (5)
		{AppID: "miniapp-lottery", Name: "Neo Lottery", Category: "gaming", Interval: 30 * time.Second, BetAmount: 10000000, Description: "Buy lottery tickets, draw winners"},
		{AppID: "miniapp-coin-flip", Name: "Neo Coin Flip", Category: "gaming", Interval: 30 * time.Second, BetAmount: 5000000, Description: "50/50 coin flip, double or nothing"},
		{AppID: "miniapp-dice-game", Name: "Neo Dice", Category: "gaming", Interval: 30 * time.Second, BetAmount: 8000000, Description: "Roll dice, win up to 6x"},
		{AppID: "miniapp-scratch-card", Name: "Neo Scratch Cards", Category: "gaming", Interval: 30 * time.Second, BetAmount: 2000000, Description: "Instant win scratch cards"},
		{AppID: "miniapp-neo-crash", Name: "Neo Crash", Category: "gaming", Interval: 30 * time.Second, BetAmount: 10000000, Description: "Crash game - cash out before it crashes"},
		// Core Social (3)
		{AppID: "miniapp-red-envelope", Name: "Red Envelope", Category: "social", Interval: 30 * time.Second, BetAmount: 20000000, Description: "Social GAS red packets"},
		{AppID: "miniapp-time-capsule", Name: "TEE Time Capsule", Category: "social", Interval: 30 * time.Second, BetAmount: 20000000, Description: "Encrypted messages unlocked by time or price"},
		{AppID: "miniapp-dev-tipping", Name: "EcoBoost", Category: "social", Interval: 30 * time.Second, BetAmount: 100000000, Description: "Support the builders who power the ecosystem"},
		// Core Governance (1)
		{AppID: "miniapp-gov-booster", Name: "Gov Booster", Category: "governance", Interval: 30 * time.Second, BetAmount: 1000000, Description: "bNEO governance optimization"},
		// Core Utility (1)
		{AppID: "miniapp-guardian-policy", Name: "Guardian Policy", Category: "utility", Interval: 30 * time.Second, BetAmount: 100000, Description: "Guardian policy management"},
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

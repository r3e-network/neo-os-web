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

// AllMiniApps returns configuration for all platform MiniApps.
func AllMiniApps() []MiniAppConfig {
	return defaultMiniAppConfigs()
}

// Helper function to generate random int in range [min, max]
func randomInt(minVal, maxVal int) int {
	if minVal >= maxVal {
		return minVal
	}
	n, err := rand.Int(rand.Reader, big.NewInt(int64(maxVal-minVal+1)))
	if err != nil {
		return minVal
	}
	return minVal + int(n.Int64())
}

// generateGameID generates a unique game ID
func generateGameID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

// generateRandomBytes generates random bytes for game outcomes

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
		{AppID: "builtin-neo-crash", Name: "Neo Crash", Category: "gaming", Interval: 4 * time.Second, BetAmount: 10000000, Description: "Crash game - cash out before it crashes"},
		{AppID: "builtin-throne-of-gas", Name: "Throne of GAS", Category: "gaming", Interval: 8 * time.Second, BetAmount: 110000000, Description: "King of the hill - claim the throne"},
		{AppID: "builtin-doomsday-clock", Name: "Doomsday Clock", Category: "gaming", Interval: 10 * time.Second, BetAmount: 100000000, Description: "FOMO3D style - last buyer wins the pot"},
		{AppID: "builtin-schrodinger-nft", Name: "Schrödinger's NFT", Category: "gaming", Interval: 8 * time.Second, BetAmount: 50000000, Description: "Quantum pet box - observe to collapse state"},
		{AppID: "builtin-algo-battle", Name: "Algo Battle Arena", Category: "gaming", Interval: 10 * time.Second, BetAmount: 50000000, Description: "Code gladiator battles in TEE"},
		// DeFi
		{AppID: "builtin-prediction-market", Name: "Prediction Market", Category: "defi", Interval: 8 * time.Second, BetAmount: 20000000, Description: "Bet on price movements"},
		{AppID: "builtin-flashloan", Name: "Flash Loan", Category: "defi", Interval: 15 * time.Second, BetAmount: 100000000, Description: "Instant borrow and repay"},
		{AppID: "builtin-price-ticker", Name: "Price Ticker", Category: "defi", Interval: 10 * time.Second, BetAmount: 0, Description: "Query price feeds"},
		{AppID: "builtin-price-predict", Name: "Price Predict", Category: "defi", Interval: 6 * time.Second, BetAmount: 10000000, Description: "Binary options on price"},
		{AppID: "builtin-turbo-options", Name: "Turbo Options", Category: "defi", Interval: 5 * time.Second, BetAmount: 50000000, Description: "Ultra-fast binary options"},
		{AppID: "builtin-il-guard", Name: "IL Guard", Category: "defi", Interval: 10 * time.Second, BetAmount: 10000000, Description: "Impermanent loss protection"},
		{AppID: "builtin-candle-wars", Name: "Candle Wars", Category: "defi", Interval: 5 * time.Second, BetAmount: 5000000, Description: "Binary options on price direction"},
		{AppID: "builtin-dutch-auction", Name: "Dutch Auction", Category: "defi", Interval: 8 * time.Second, BetAmount: 50000000, Description: "Reverse auction - price drops until sold"},
		{AppID: "builtin-the-parasite", Name: "The Parasite", Category: "defi", Interval: 6 * time.Second, BetAmount: 10000000, Description: "DeFi staking with PvP attack mechanics"},
		{AppID: "builtin-no-loss-lottery", Name: "No-Loss Lottery", Category: "defi", Interval: 8 * time.Second, BetAmount: 10000000, Description: "Stake to win yields, keep principal"},
		// Social
		{AppID: "builtin-secret-vote", Name: "Secret Vote", Category: "social", Interval: 10 * time.Second, BetAmount: 1000000, Description: "Privacy-preserving voting"},
		{AppID: "builtin-secret-poker", Name: "Secret Poker", Category: "social", Interval: 15 * time.Second, BetAmount: 50000000, Description: "TEE Texas Hold'em"},
		{AppID: "builtin-micro-predict", Name: "Micro Predict", Category: "social", Interval: 5 * time.Second, BetAmount: 10000000, Description: "60-second price predictions"},
		{AppID: "builtin-red-envelope", Name: "Red Envelope", Category: "social", Interval: 8 * time.Second, BetAmount: 20000000, Description: "Social GAS red packets"},
		{AppID: "builtin-gas-circle", Name: "Gas Circle", Category: "social", Interval: 10 * time.Second, BetAmount: 10000000, Description: "Daily savings circle with lottery"},
		{AppID: "builtin-pay-to-view", Name: "Pay to View", Category: "social", Interval: 6 * time.Second, BetAmount: 10000000, Description: "Unlock premium content with GAS"},
		{AppID: "builtin-time-capsule", Name: "TEE Time Capsule", Category: "social", Interval: 10 * time.Second, BetAmount: 20000000, Description: "Encrypted messages unlocked by time or price"},
		// Governance & Advanced
		{AppID: "builtin-gov-booster", Name: "Gov Booster", Category: "governance", Interval: 15 * time.Second, BetAmount: 1000000, Description: "bNEO governance optimization"},
		{AppID: "builtin-ai-trader", Name: "AI Trader", Category: "advanced", Interval: 10 * time.Second, BetAmount: 10000000, Description: "Autonomous AI trading agent"},
		{AppID: "builtin-grid-bot", Name: "Grid Bot", Category: "advanced", Interval: 10 * time.Second, BetAmount: 5000000, Description: "Automated grid trading"},
		{AppID: "builtin-nft-evolve", Name: "NFT Evolve", Category: "advanced", Interval: 15 * time.Second, BetAmount: 1000000, Description: "Dynamic NFT evolution engine"},
		{AppID: "builtin-bridge-guardian", Name: "Bridge Guardian", Category: "advanced", Interval: 20 * time.Second, BetAmount: 30000000, Description: "Cross-chain asset bridge"},
		{AppID: "builtin-fog-chess", Name: "Fog Chess", Category: "advanced", Interval: 15 * time.Second, BetAmount: 10000000, Description: "Chess with fog of war using TEE"},
		{AppID: "builtin-garden-of-neo", Name: "Garden of NEO", Category: "advanced", Interval: 8 * time.Second, BetAmount: 10000000, Description: "Plants grow based on blockchain data"},
		{AppID: "builtin-dev-tipping", Name: "EcoBoost", Category: "social", Interval: 5 * time.Second, BetAmount: 100000000, Description: "Support the builders who power the ecosystem"},
		// Phase 7 - Advanced DeFi & Social
		{AppID: "builtin-ai-soulmate", Name: "AI Soulmate", Category: "social", Interval: 10 * time.Second, BetAmount: 50000000, Description: "AI companion with TEE-encrypted memories"},
		{AppID: "builtin-dead-switch", Name: "Dead Switch", Category: "defi", Interval: 15 * time.Second, BetAmount: 100000000, Description: "Dead man's switch - automated inheritance"},
		{AppID: "builtin-heritage-trust", Name: "Heritage Trust", Category: "defi", Interval: 20 * time.Second, BetAmount: 100000000, Description: "Living trust DAO with auto-inheritance"},
		{AppID: "builtin-dark-radio", Name: "Dark Radio", Category: "social", Interval: 8 * time.Second, BetAmount: 10000000, Description: "Anonymous censorship-resistant broadcast"},
		{AppID: "builtin-zk-badge", Name: "ZK Badge", Category: "social", Interval: 10 * time.Second, BetAmount: 5000000, Description: "Privacy-preserving wealth proof badges"},
		{AppID: "builtin-graveyard", Name: "Graveyard", Category: "social", Interval: 8 * time.Second, BetAmount: 10000000, Description: "Digital graveyard - paid data deletion"},
		{AppID: "builtin-compound-capsule", Name: "Compound Capsule", Category: "defi", Interval: 12 * time.Second, BetAmount: 50000000, Description: "Auto-compounding time-locked savings"},
		{AppID: "builtin-self-loan", Name: "Self Loan", Category: "defi", Interval: 15 * time.Second, BetAmount: 100000000, Description: "Alchemix-style self-repaying loans"},
		{AppID: "builtin-dark-pool", Name: "Dark Pool", Category: "defi", Interval: 10 * time.Second, BetAmount: 50000000, Description: "Anonymous governance voting pool"},
		{AppID: "builtin-burn-league", Name: "Burn League", Category: "gaming", Interval: 8 * time.Second, BetAmount: 20000000, Description: "Burn-to-earn deflationary rewards"},
		{AppID: "builtin-gov-merc", Name: "Gov Merc", Category: "governance", Interval: 15 * time.Second, BetAmount: 10000000, Description: "Governance mercenary - vote rental market"},
		// Phase 8 - Creative & Social
		{AppID: "builtin-quantum-swap", Name: "Quantum Swap", Category: "gaming", Interval: 8 * time.Second, BetAmount: 10000000, Description: "Blind box exchange - quantum uncertainty"},
		{AppID: "builtin-on-chain-tarot", Name: "On-Chain Tarot", Category: "social", Interval: 10 * time.Second, BetAmount: 5000000, Description: "On-chain tarot card readings"},
		{AppID: "builtin-ex-files", Name: "Ex Files", Category: "social", Interval: 8 * time.Second, BetAmount: 10000000, Description: "Encrypted file sharing with expiry"},
		{AppID: "builtin-scream-to-earn", Name: "Scream to Earn", Category: "gaming", Interval: 6 * time.Second, BetAmount: 5000000, Description: "Voice-activated earning game"},
		{AppID: "builtin-breakup-contract", Name: "Breakup Contract", Category: "social", Interval: 10 * time.Second, BetAmount: 20000000, Description: "Relationship dissolution smart contract"},
		{AppID: "builtin-geo-spotlight", Name: "Geo Spotlight", Category: "social", Interval: 8 * time.Second, BetAmount: 10000000, Description: "Location-based spotlight auctions"},
		{AppID: "builtin-puzzle-mining", Name: "Puzzle Mining", Category: "gaming", Interval: 10 * time.Second, BetAmount: 5000000, Description: "Solve puzzles to mine rewards"},
		{AppID: "builtin-nft-chimera", Name: "NFT Chimera", Category: "creative", Interval: 12 * time.Second, BetAmount: 30000000, Description: "Merge NFTs to create chimeras"},
		{AppID: "builtin-world-piano", Name: "World Piano", Category: "creative", Interval: 8 * time.Second, BetAmount: 5000000, Description: "Collaborative on-chain music creation"},
		{AppID: "builtin-bounty-hunter", Name: "Bounty Hunter", Category: "social", Interval: 10 * time.Second, BetAmount: 10000000, Description: "Bug bounty and task marketplace"},
		{AppID: "builtin-masquerade-dao", Name: "Masquerade DAO", Category: "governance", Interval: 12 * time.Second, BetAmount: 10000000, Description: "Anonymous masked voting DAO"},
		{AppID: "builtin-melting-asset", Name: "Melting Asset", Category: "defi", Interval: 10 * time.Second, BetAmount: 20000000, Description: "Depreciating assets that melt over time"},
		{AppID: "builtin-unbreakable-vault", Name: "Unbreakable Vault", Category: "defi", Interval: 15 * time.Second, BetAmount: 50000000, Description: "Time-locked vault with conditions"},
		{AppID: "builtin-whisper-chain", Name: "Whisper Chain", Category: "social", Interval: 8 * time.Second, BetAmount: 5000000, Description: "Anonymous message propagation"},
		{AppID: "builtin-million-piece-map", Name: "Million Piece Map", Category: "creative", Interval: 10 * time.Second, BetAmount: 1000000, Description: "Collaborative pixel map ownership"},
		{AppID: "builtin-fog-puzzle", Name: "Fog Puzzle", Category: "gaming", Interval: 8 * time.Second, BetAmount: 5000000, Description: "Hidden puzzle with fog of war"},
		{AppID: "builtin-crypto-riddle", Name: "Crypto Riddle", Category: "gaming", Interval: 8 * time.Second, BetAmount: 10000000, Description: "Password red envelope hunter"},
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

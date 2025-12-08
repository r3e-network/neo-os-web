// Package mixer provides privacy-preserving transaction mixing service.
//
// Architecture: Off-Chain Mixing with TEE Proofs + On-Chain Dispute Only
//
// Flow:
//  1. User requests mix via CLI → Mixer service directly (NO on-chain)
//  2. Mixer returns RequestProof to user (for 7-day dispute claim)
//  3. User deposits to Service Layer via gasbank (off-chain balance)
//  4. Mixer processes off-chain (pool account mixing)
//  5. When done, Mixer generates CompletionProof (stored, NOT submitted)
//  6. Normal path: Tokens delivered, user happy, nothing on-chain
//  7. Dispute path: User submits dispute → Mixer submits CompletionProof on-chain
//
// Security:
// - AccountPool service owns HD-derived pool accounts; mixer only locks/uses them
// - RequestProof = Hash256(request) + TEE signature (user can verify)
// - CompletionProof = Hash256(outputs) + TEE signature (dispute evidence)
// - Compliance limits: ≤10,000 per request, ≤100,000 total pool
package mixer

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/internal/chain"
	"github.com/R3E-Network/service_layer/internal/database"
	"github.com/R3E-Network/service_layer/internal/marble"
)

const (
	ServiceID   = "mixer"
	ServiceName = "Mixer Service"
	Version     = "3.2.0"

	// Default token for backward compatibility
	DefaultToken = "GAS"

	// Mixing configuration
	MinMixingTxPerMinute = 5
	MaxMixingTxPerMinute = 20

	// Dispute grace period
	DisputeGracePeriod = 7 * 24 * time.Hour
)

// TokenConfig holds per-token configuration (limits and fees only).
// Pool accounts are shared across all tokens.
type TokenConfig struct {
	TokenType        string  `json:"token_type"`
	ScriptHash       string  `json:"script_hash"` // NEP-17 contract hash
	MinTxAmount      int64   `json:"min_tx_amount"`
	MaxTxAmount      int64   `json:"max_tx_amount"`
	MaxRequestAmount int64   `json:"max_request_amount"`
	MaxPoolBalance   int64   `json:"max_pool_balance"`
	ServiceFeeRate   float64 `json:"service_fee_rate"`
}

// DefaultTokenConfigs returns the default per-token configurations.
func DefaultTokenConfigs() map[string]*TokenConfig {
	return map[string]*TokenConfig{
		"GAS": {
			TokenType:        "GAS",
			ScriptHash:       "0xd2a4cff31913016155e38e474a2c06d08be276cf", // GAS on Neo N3
			MinTxAmount:      100000,
			MaxTxAmount:      100000000,
			MaxRequestAmount: 1000000000000,
			MaxPoolBalance:   10000000000000,
			ServiceFeeRate:   0.005,
		},
		"NEO": {
			TokenType:        "NEO",
			ScriptHash:       "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", // NEO on Neo N3
			MinTxAmount:      1,                                            // NEO is indivisible
			MaxTxAmount:      1000,
			MaxRequestAmount: 100000,
			MaxPoolBalance:   1000000,
			ServiceFeeRate:   0.005,
		},
	}
}

// Service implements the Mixer service.
type Service struct {
	*marble.Service
	mu sync.RWMutex

	// Secrets (for TEE signing of requests/proofs only)
	masterKey []byte

	// Per-token configuration
	tokenConfigs map[string]*TokenConfig

	// Account pool client (for requesting/releasing accounts)
	accountPoolURL string

	// Chain interaction
	chainClient  *chain.Client
	teeFulfiller *chain.TEEFulfiller
	gateway      *chain.GatewayContract

	// Background workers
	stopCh chan struct{}
}

// GetTokenConfig returns the configuration for a specific token.
func (s *Service) GetTokenConfig(tokenType string) *TokenConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if cfg, ok := s.tokenConfigs[tokenType]; ok {
		return cfg
	}
	return s.tokenConfigs[DefaultToken]
}

// GetSupportedTokens returns all supported token types.
func (s *Service) GetSupportedTokens() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	tokens := make([]string, 0, len(s.tokenConfigs))
	for t := range s.tokenConfigs {
		tokens = append(tokens, t)
	}
	return tokens
}

// Config holds Mixer service configuration.
type Config struct {
	Marble         *marble.Marble
	DB             *database.Repository
	ChainClient    *chain.Client
	TEEFulfiller   *chain.TEEFulfiller
	Gateway        *chain.GatewayContract
	TokenConfigs   map[string]*TokenConfig // Optional custom token configs
	AccountPoolURL string                  // URL for accountpool service
}

// New creates a new Mixer service.
func New(cfg Config) (*Service, error) {
	base := marble.NewService(marble.ServiceConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
		DB:      cfg.DB,
	})

	// Use provided token configs or defaults
	tokenConfigs := cfg.TokenConfigs
	if tokenConfigs == nil {
		tokenConfigs = DefaultTokenConfigs()
	}

	s := &Service{
		Service:        base,
		tokenConfigs:   tokenConfigs,
		accountPoolURL: cfg.AccountPoolURL,
		chainClient:    cfg.ChainClient,
		teeFulfiller:   cfg.TEEFulfiller,
		gateway:        cfg.Gateway,
		stopCh:         make(chan struct{}),
	}

	// Load mixer master key from Marble secrets
	// UPGRADE SAFETY: MIXER_MASTER_KEY is injected by MarbleRun Coordinator from
	// manifest-defined secrets. It is used only for TEE HMAC signatures on
	// request/completion proofs (account keys are managed by the accountpool service).
	if key, ok := cfg.Marble.Secret("MIXER_MASTER_KEY"); ok {
		s.masterKey = key
	}

	s.registerRoutes()
	return s, nil
}

// =============================================================================
// Lifecycle
// =============================================================================

// Start starts the mixer service and background workers.
func (s *Service) Start(ctx context.Context) error {
	if err := s.Service.Start(ctx); err != nil {
		return err
	}

	// Resume deposited/mixing requests from persistence
	go s.resumeRequests(ctx)

	// Start background workers (pool management now in accountpool service)
	go s.runMixingLoop(ctx)
	go s.runDeliveryChecker(ctx)

	return nil
}

// Stop stops the mixer service.
func (s *Service) Stop() error {
	close(s.stopCh)
	return s.Service.Stop()
}

// resumeRequests loads requests in deposited/mixing state and resumes processing.
func (s *Service) resumeRequests(ctx context.Context) {
	if s.DB() == nil {
		return
	}

	// Kick off mixing for deposited requests
	if deposited, err := s.DB().ListMixerRequestsByStatus(ctx, string(StatusDeposited)); err == nil {
		for i := range deposited {
			req := RequestFromRecord(&deposited[i])
			go s.startMixing(ctx, req)
		}
	}
}

// =============================================================================
// On-Chain Dispute Submission
// =============================================================================

// submitCompletionProofOnChain submits the completion proof to the on-chain contract.
// This is called ONLY during dispute resolution.
func (s *Service) submitCompletionProofOnChain(ctx context.Context, request *MixRequest) (string, error) {
	if s.teeFulfiller == nil {
		return "", fmt.Errorf("TEE fulfiller not configured")
	}

	proof := request.CompletionProof
	if proof == nil {
		return "", fmt.Errorf("no completion proof")
	}

	// Serialize proof for on-chain submission
	proofBytes, err := json.Marshal(proof)
	if err != nil {
		return "", fmt.Errorf("marshal proof: %w", err)
	}

	// Parse request ID as big.Int for contract call
	requestIDBigInt := new(big.Int)
	// Use hash of request ID as numeric identifier
	idHash := sha256.Sum256([]byte(request.ID))
	requestIDBigInt.SetBytes(idHash[:8])

	// Submit via TEE fulfiller (this is the ONLY on-chain submission in normal mixer flow)
	txHash, err := s.teeFulfiller.FulfillRequest(ctx, requestIDBigInt, proofBytes)
	if err != nil {
		return "", fmt.Errorf("fulfill request: %w", err)
	}

	return txHash, nil
}

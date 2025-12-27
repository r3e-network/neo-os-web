// Package neoaccounts provides a centralized neoaccounts service for other marbles.
// Private keys never leave this service - other services request accounts and
// submit transactions for signing.
package neoaccounts

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"

	neoaccountssupabase "github.com/R3E-Network/service_layer/infrastructure/accountpool/supabase"
	"github.com/R3E-Network/service_layer/infrastructure/chain"
	"github.com/R3E-Network/service_layer/infrastructure/crypto"
	"github.com/R3E-Network/service_layer/infrastructure/database"
	"github.com/R3E-Network/service_layer/infrastructure/marble"
	"github.com/R3E-Network/service_layer/infrastructure/runtime"
	commonservice "github.com/R3E-Network/service_layer/infrastructure/service"
)

const (
	ServiceID   = "neoaccounts"
	ServiceName = "Account Pool Service"
	Version     = "2.0.0" // Updated for multi-token support

	// Pool configuration
	MinPoolAccounts = 1000
	MaxPoolAccounts = 50000
	BatchCreateSize = 100  // Number of accounts to create in each batch
	RotationRate    = 0.1  // 10% of accounts rotated per day
	RotationMinAge  = 24   // Minimum age in hours before rotation

	// Lock timeout - accounts locked longer than this can be force-released
	LockTimeout = 24 * time.Hour
)

// Service implements the NeoAccounts service marble.
type Service struct {
	*commonservice.BaseService
	mu sync.RWMutex

	// Secrets
	masterKey              []byte
	masterPubKey           []byte
	masterKeyHash          []byte
	masterKeyAttestationID string
	encryptionKey          []byte // For decrypting stored WIFs

	// Service-specific repository
	repo neoaccountssupabase.RepositoryInterface

	// Chain interaction (for signing)
	chainClient *chain.Client
}

// Config holds NeoAccounts service configuration.
type Config struct {
	Marble          *marble.Marble
	DB              database.RepositoryInterface
	NeoAccountsRepo neoaccountssupabase.RepositoryInterface
	ChainClient     *chain.Client
}

// New creates a new NeoAccounts service.
func New(cfg Config) (*Service, error) {
	if cfg.Marble == nil {
		return nil, fmt.Errorf("neoaccounts: marble is required")
	}

	strict := runtime.StrictIdentityMode() || cfg.Marble.IsEnclave()

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
		DB:      cfg.DB,
	})

	s := &Service{
		BaseService: base,
		repo:        cfg.NeoAccountsRepo,
		chainClient: cfg.ChainClient,
	}

	// Load and validate master key material.
	if err := s.loadMasterKey(cfg.Marble); err != nil {
		if strict || !allowEphemeralMasterKey() {
			return nil, err
		}

		s.Logger().WithError(err).Warn("master key not configured; generating ephemeral key (explicitly allowed)")

		key, keyErr := crypto.GenerateRandomBytes(32)
		if keyErr != nil {
			return nil, fmt.Errorf("neoaccounts: generate fallback master key: %w", keyErr)
		}

		pubKeyCompressed, pubErr := deriveMasterPubKey(key)
		if pubErr != nil {
			return nil, fmt.Errorf("neoaccounts: derive fallback master pubkey: %w", pubErr)
		}

		computedHash := sha256.Sum256(pubKeyCompressed)
		s.masterKey = key
		s.masterPubKey = pubKeyCompressed
		s.masterKeyHash = computedHash[:]
	}

	// Load encryption key for stored WIFs (optional - only needed for pre-generated accounts)
	if err := s.loadEncryptionKey(cfg.Marble); err != nil {
		s.Logger().WithError(err).Debug("encryption key not configured; stored WIF accounts disabled")
	}

	base.WithHydrate(s.initializePool)
	base.AddTickerWorker(time.Hour, func(ctx context.Context) error {
		s.rotateAccounts(ctx)
		return nil
	}, commonservice.WithTickerWorkerName("account-rotation"))
	base.AddTickerWorker(time.Hour, func(ctx context.Context) error {
		s.cleanupStaleLocks(ctx)
		return nil
	}, commonservice.WithTickerWorkerName("lock-cleanup"))

	base.RegisterStandardRoutes()
	s.registerRoutes()
	return s, nil
}

func allowEphemeralMasterKey() bool {
	raw := strings.TrimSpace(os.Getenv("NEOACCOUNTS_ALLOW_EPHEMERAL_MASTER_KEY"))
	switch strings.ToLower(raw) {
	case "1", "true", "yes":
		return true
	default:
		return false
	}
}

const secretPoolEncryptionKey = "POOL_ENCRYPTION_KEY"

// loadEncryptionKey loads the encryption key for decrypting stored WIFs.
// First tries marble.Secret(), then falls back to direct env var lookup.
func (s *Service) loadEncryptionKey(m *marble.Marble) error {
	// Try marble.Secret() first (for production MarbleRun deployments)
	key, ok := m.Secret(secretPoolEncryptionKey)
	if ok && len(key) == 32 {
		s.encryptionKey = key
		return nil
	}

	// Fallback: direct env var lookup (for simulation/development)
	envValue := strings.TrimSpace(os.Getenv(secretPoolEncryptionKey))
	if envValue == "" {
		return fmt.Errorf("missing %s secret", secretPoolEncryptionKey)
	}

	// Try hex decoding
	decoded, err := hex.DecodeString(envValue)
	if err != nil {
		return fmt.Errorf("%s is not valid hex: %w", secretPoolEncryptionKey, err)
	}
	if len(decoded) != 32 {
		return fmt.Errorf("%s must be 32 bytes, got %d bytes", secretPoolEncryptionKey, len(decoded))
	}

	s.encryptionKey = decoded
	return nil
}

// initializePool ensures the pool has at least MinPoolAccounts.
func (s *Service) initializePool(ctx context.Context) error {
	accounts, err := s.repo.List(ctx)
	if err != nil {
		// In development/testing mode, skip pool initialization if database is unavailable.
		// In strict identity/SGX mode, fail closed (database is required).
		if runtime.StrictIdentityMode() {
			return err
		}
		if runtime.IsDevelopmentOrTesting() {
			s.Logger().WithContext(ctx).WithError(err).Warn("database unavailable; skipping pool initialization")
			return nil
		}
		return err
	}
	if len(accounts) >= MaxPoolAccounts {
		return nil
	}

	need := MinPoolAccounts - len(accounts)
	if need < 0 {
		need = 0
	}
	if need > MaxPoolAccounts-len(accounts) {
		need = MaxPoolAccounts - len(accounts)
	}

	// Create accounts in batches for better performance
	for i := 0; i < need; i++ {
		if _, err := s.createAccount(ctx); err != nil {
			return err
		}
		// Log progress every BatchCreateSize accounts
		if (i+1)%BatchCreateSize == 0 {
			s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
				"created": i + 1,
				"total":   need,
			}).Info("batch account creation progress")
		}
	}

	if need > 0 {
		s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
			"created": need,
		}).Info("pool initialization complete")
	}

	return nil
}

// createAccount creates and persists a new pool account with HD derivation.
// No balance is set on the account itself - balances are tracked in pool_account_balances.
// Uses neo-go's secp256k1 keys for Neo N3 compatibility.
func (s *Service) createAccount(ctx context.Context) (*neoaccountssupabase.Account, error) {
	accountID := uuid.New().String()

	derivedKey, err := s.deriveAccountKey(accountID)
	if err != nil {
		return nil, err
	}

	// Use neo-go's keys package which uses secp256k1 (Neo N3 curve)
	neoPrivKey, err := keys.NewPrivateKeyFromBytes(derivedKey)
	if err != nil {
		return nil, fmt.Errorf("create neo private key: %w", err)
	}

	// Get the Neo N3 address directly from neo-go
	address := neoPrivKey.Address()

	acc := &neoaccountssupabase.Account{
		ID:         accountID,
		Address:    address,
		CreatedAt:  time.Now(),
		LastUsedAt: time.Now(),
		TxCount:    0,
		IsRetiring: false,
		LockedBy:   "",
		LockedAt:   time.Time{},
	}
	if err := s.repo.Create(ctx, acc); err != nil {
		return nil, err
	}

	// Initialize zero balances for known tokens
	for _, tokenType := range []string{TokenTypeGAS, TokenTypeNEO} {
		scriptHash, decimals := neoaccountssupabase.GetDefaultTokenConfig(tokenType)
		if err := s.repo.UpsertBalance(ctx, accountID, tokenType, scriptHash, 0, decimals); err != nil {
			// Log but don't fail - balance can be created on first update.
			s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
				"token_type": tokenType,
				"account_id": accountID,
			}).Warn("failed to initialize account balance")
		}
	}

	return acc, nil
}

// deriveAccountKey derives an account's private key from the master key.
// UPGRADE SAFETY: Uses crypto.DeriveKey which derives keys based only on:
//   - masterKey: From MarbleRun injection (manifest-defined, stable across upgrades)
//   - accountID: Business identifier (stable)
//   - "pool-account": Service context (code constant, stable)
//
// NO enclave identity (MRENCLAVE/MRSIGNER) is used in derivation.
func (s *Service) deriveAccountKey(accountID string) ([]byte, error) {
	return crypto.DeriveKey(s.masterKey, []byte(accountID), "pool-account", 32)
}

// getPrivateKey returns the private key for an account.
// Priority: 1) Stored encrypted WIF, 2) HD derivation from master key.
// This is internal only - private keys never leave this service.
func (s *Service) getPrivateKey(accountID string) (*ecdsa.PrivateKey, error) {
	// Try stored encrypted WIF first (for pre-generated accounts)
	if s.encryptionKey != nil && s.repo != nil {
		acc, err := s.repo.GetByID(context.Background(), accountID)
		if err == nil && acc != nil && acc.EncryptedWIF != "" {
			return s.decryptWIFToPrivateKey(acc.EncryptedWIF)
		}
	}

	// Fall back to HD derivation (for legacy accounts)
	derivedKey, err := s.deriveAccountKey(accountID)
	if err != nil {
		return nil, err
	}

	neoPrivKey, err := keys.NewPrivateKeyFromBytes(derivedKey)
	if err != nil {
		return nil, fmt.Errorf("create neo private key: %w", err)
	}

	return &neoPrivKey.PrivateKey, nil
}

// getPrivateKeyHex derives and returns the private key hex string for an account.
// This is used for creating neo-go wallet accounts for signing.
func (s *Service) getPrivateKeyHex(accountID string) (string, error) {
	derivedKey, err := s.deriveAccountKey(accountID)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(derivedKey), nil
}

// decryptWIFToPrivateKey decrypts an encrypted WIF and returns the private key.
func (s *Service) decryptWIFToPrivateKey(encryptedWIF string) (*ecdsa.PrivateKey, error) {
	if s.encryptionKey == nil {
		return nil, fmt.Errorf("encryption key not configured")
	}

	wif, err := s.decryptWIF(encryptedWIF)
	if err != nil {
		return nil, fmt.Errorf("decrypt WIF: %w", err)
	}

	neoPrivKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		return nil, fmt.Errorf("parse WIF: %w", err)
	}

	return &neoPrivKey.PrivateKey, nil
}

// decryptWIF decrypts an AES-256-GCM encrypted WIF.
func (s *Service) decryptWIF(encryptedWIF string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedWIF)
	if err != nil {
		return "", fmt.Errorf("decode base64: %w", err)
	}

	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}

	return string(plaintext), nil
}

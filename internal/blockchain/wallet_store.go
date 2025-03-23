package blockchain

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/internal/blockchain/compat"
	"github.com/R3E-Network/service_layer/internal/models"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

// WalletData represents the wallet data stored in the database
type WalletData struct {
	ID           uuid.UUID `db:"id"`
	UserID       int       `db:"user_id"`
	Name         string    `db:"name"`
	EncryptedKey []byte    `db:"encrypted_key"`
	Path         string    `db:"path"`
	IV           []byte    `db:"iv"`
	CreatedAt    time.Time `db:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"`
}

// DBWalletStore provides access to wallet storage via database
type DBWalletStore struct {
	db          *sqlx.DB
	logger      *logger.Logger
	config      *config.NeoConfig
	walletPath  string
	encryptKey  []byte
	cacheMutex  sync.RWMutex
	walletCache map[string]*wallet.Wallet
}

// NewDBWalletStore creates a new wallet store
func NewDBWalletStore(db *sqlx.DB, logger *logger.Logger, cfg *config.NeoConfig, encryptionKey string) (*DBWalletStore, error) {
	// Create wallet directory if it doesn't exist
	walletPath := cfg.WalletPath
	if err := os.MkdirAll(walletPath, 0700); err != nil {
		return nil, fmt.Errorf("failed to create wallet directory: %w", err)
	}

	// Decode encryption key
	key, err := hex.DecodeString(encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("invalid encryption key: %w", err)
	}

	if len(key) != 32 {
		return nil, errors.New("encryption key must be 32 bytes long")
	}

	return &DBWalletStore{
		db:          db,
		logger:      logger,
		config:      cfg,
		walletPath:  walletPath,
		encryptKey:  key,
		walletCache: make(map[string]*wallet.Wallet),
	}, nil
}

// CreateWallet creates a new wallet for a user
func (s *DBWalletStore) CreateWallet(ctx context.Context, userID int, name, password string) (string, error) {
	// Generate wallet ID
	walletID := uuid.New()

	// Create wallet file path
	walletPath := filepath.Join(s.walletPath, walletID.String()+".json")

	// Create a new wallet
	w, err := wallet.NewWallet(walletPath)
	if err != nil {
		return "", fmt.Errorf("failed to create wallet: %w", err)
	}

	// Create a new account with the password using our compatibility layer
	if err := compat.CreateAccountWithLabel(w, password, "default"); err != nil {
		return "", fmt.Errorf("failed to create account: %w", err)
	}

	// Save the wallet
	if err := w.Save(); err != nil {
		return "", fmt.Errorf("failed to save wallet: %w", err)
	}

	// Encrypt the password
	encryptedKey, iv, err := s.encryptData([]byte(password))
	if err != nil {
		return "", fmt.Errorf("failed to encrypt wallet password: %w", err)
	}

	// Store the wallet in the database
	query := `
		INSERT INTO wallets (id, user_id, name, encrypted_key, path, iv, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	now := time.Now()
	_, err = s.db.ExecContext(ctx, query,
		walletID, userID, name, encryptedKey, walletPath, iv, now, now)
	if err != nil {
		return "", fmt.Errorf("failed to store wallet in database: %w", err)
	}

	return walletID.String(), nil
}

// GetWallet retrieves a wallet by user ID and wallet ID
func (s *DBWalletStore) GetWallet(userID int, walletID string) (*wallet.Wallet, error) {
	// Parse wallet ID
	id, err := uuid.Parse(walletID)
	if err != nil {
		return nil, fmt.Errorf("invalid wallet ID: %w", err)
	}

	// Check cache first
	cacheKey := fmt.Sprintf("%d:%s", userID, walletID)
	s.cacheMutex.RLock()
	cached, exists := s.walletCache[cacheKey]
	s.cacheMutex.RUnlock()
	if exists {
		return cached, nil
	}

	// Get wallet from database
	query := `
		SELECT id, user_id, name, encrypted_key, path, iv, created_at, updated_at
		FROM wallets
		WHERE id = $1 AND user_id = $2
	`

	var walletData WalletData
	err = s.db.Get(&walletData, query, id, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("wallet not found")
		}
		return nil, fmt.Errorf("failed to get wallet from database: %w", err)
	}

	// Decrypt the password
	password, err := s.decryptData(walletData.EncryptedKey, walletData.IV)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt wallet password: %w", err)
	}

	// Load the wallet from file
	w, err := wallet.NewWalletFromFile(walletData.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to load wallet from file: %w", err)
	}

	// Decrypt accounts
	for _, account := range w.Accounts {
		if err := account.Decrypt(string(password), w.Scrypt); err != nil {
			return nil, fmt.Errorf("failed to decrypt account: %w", err)
		}
	}

	// Store in cache
	s.cacheMutex.Lock()
	s.walletCache[cacheKey] = w
	s.cacheMutex.Unlock()

	return w, nil
}

// ListWallets lists all wallets for a user
func (s *DBWalletStore) ListWallets(ctx context.Context, userID int) ([]WalletData, error) {
	query := `
		SELECT id, user_id, name, path, created_at, updated_at
		FROM wallets
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	var wallets []WalletData
	err := s.db.SelectContext(ctx, &wallets, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list wallets: %w", err)
	}

	// Clear sensitive data
	for i := range wallets {
		wallets[i].EncryptedKey = nil
		wallets[i].IV = nil
	}

	return wallets, nil
}

// DeleteWallet deletes a wallet
func (s *DBWalletStore) DeleteWallet(ctx context.Context, userID int, walletID string) error {
	// Parse wallet ID
	id, err := uuid.Parse(walletID)
	if err != nil {
		return fmt.Errorf("invalid wallet ID: %w", err)
	}

	// Get wallet from database
	query := `
		SELECT path FROM wallets
		WHERE id = $1 AND user_id = $2
	`

	var path string
	err = s.db.GetContext(ctx, &path, query, id, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("wallet not found")
		}
		return fmt.Errorf("failed to get wallet from database: %w", err)
	}

	// Delete wallet from database
	query = `
		DELETE FROM wallets
		WHERE id = $1 AND user_id = $2
	`

	_, err = s.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete wallet from database: %w", err)
	}

	// Delete wallet file
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete wallet file: %w", err)
	}

	// Remove from cache
	cacheKey := fmt.Sprintf("%d:%s", userID, walletID)
	s.cacheMutex.Lock()
	delete(s.walletCache, cacheKey)
	s.cacheMutex.Unlock()

	return nil
}

// encryptData encrypts data using AES-GCM
func (s *DBWalletStore) encryptData(data []byte) ([]byte, []byte, error) {
	// Create a new AES cipher block
	block, err := aes.NewCipher(s.encryptKey)
	if err != nil {
		return nil, nil, err
	}

	// Create a new GCM cipher
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}

	// Create a nonce
	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}

	// Encrypt the data
	ciphertext := aesGCM.Seal(nil, nonce, data, nil)

	return ciphertext, nonce, nil
}

// decryptData decrypts data using AES-GCM
func (s *DBWalletStore) decryptData(ciphertext, nonce []byte) ([]byte, error) {
	// Create a new AES cipher block
	block, err := aes.NewCipher(s.encryptKey)
	if err != nil {
		return nil, err
	}

	// Create a new GCM cipher
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// Decrypt the data
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

// ClearCache clears the wallet cache
func (s *DBWalletStore) ClearCache() {
	s.cacheMutex.Lock()
	s.walletCache = make(map[string]*wallet.Wallet)
	s.cacheMutex.Unlock()
}

// ServiceWalletStore provides functionality for managing service wallets
type ServiceWalletStore struct {
	db          *sqlx.DB
	logger      *logger.Logger
	config      *config.Config
	encryptKey  []byte
	walletCache map[uuid.UUID]string
	cacheMutex  sync.RWMutex
}

// NewServiceWalletStore creates a new wallet store
func NewServiceWalletStore(config *config.Config, logger *logger.Logger, db *sqlx.DB) *ServiceWalletStore {
	// Generate encryption key from config
	encryptKey := []byte(config.Security.EncryptionKey)
	if len(encryptKey) < 32 {
		// Pad the key to 32 bytes if it's too short
		paddedKey := make([]byte, 32)
		copy(paddedKey, encryptKey)
		encryptKey = paddedKey
	} else if len(encryptKey) > 32 {
		// Truncate the key to 32 bytes if it's too long
		encryptKey = encryptKey[:32]
	}

	return &ServiceWalletStore{
		db:          db,
		logger:      logger,
		config:      config,
		encryptKey:  encryptKey,
		walletCache: make(map[uuid.UUID]string),
	}
}

// CreateWallet creates a new wallet for a service
func (s *ServiceWalletStore) CreateWallet(ctx context.Context, service string) (*models.WalletAccount, error) {
	// Create a new Neo N3 wallet
	account, err := wallet.NewAccount()
	if err != nil {
		return nil, fmt.Errorf("failed to create account: %w", err)
	}

	// Use our compatibility helper to get account information
	helper := compat.NewAccountHelper(account)
	address := helper.GetAddress()
	privateKey := helper.GetPrivateKeyHex()
	publicKey := helper.GetPublicKeyHex()

	// Encrypt the private key
	encryptedKey, err := s.encryptPrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt private key: %w", err)
	}

	// Create wallet record
	id := uuid.New()
	walletAccount := &models.WalletAccount{
		ID:                  id,
		Service:             service,
		Address:             address,
		EncryptedPrivateKey: encryptedKey,
		PublicKey:           publicKey,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	// Insert into database
	query := `
		INSERT INTO wallet_accounts (
			id, service, address, encrypted_private_key, public_key, created_at, updated_at
		) VALUES (
			:id, :service, :address, :encrypted_private_key, :public_key, :created_at, :updated_at
		)
	`
	_, err = s.db.NamedExecContext(ctx, query, walletAccount)
	if err != nil {
		return nil, fmt.Errorf("failed to insert wallet account: %w", err)
	}

	// Add to cache
	s.cacheMutex.Lock()
	s.walletCache[id] = privateKey
	s.cacheMutex.Unlock()

	return walletAccount, nil
}

// GetPrivateKey retrieves the private key for a wallet
func (s *ServiceWalletStore) GetPrivateKey(ctx context.Context, walletID uuid.UUID) (string, error) {
	// Check cache first
	s.cacheMutex.RLock()
	privateKey, exists := s.walletCache[walletID]
	s.cacheMutex.RUnlock()

	if exists {
		return privateKey, nil
	}

	// Get from database
	query := `
		SELECT encrypted_private_key FROM wallet_accounts
		WHERE id = $1 AND deleted_at IS NULL
	`
	var encryptedKey string
	err := s.db.GetContext(ctx, &encryptedKey, query, walletID)
	if err != nil {
		return "", fmt.Errorf("failed to get wallet account: %w", err)
	}

	// Decrypt the private key
	privateKey, err = s.decryptPrivateKey(encryptedKey)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt private key: %w", err)
	}

	// Add to cache
	s.cacheMutex.Lock()
	s.walletCache[walletID] = privateKey
	s.cacheMutex.Unlock()

	return privateKey, nil
}

// encryptPrivateKey encrypts a private key
func (s *ServiceWalletStore) encryptPrivateKey(privateKey string) (string, error) {
	// Create a new AES cipher
	block, err := aes.NewCipher(s.encryptKey)
	if err != nil {
		return "", err
	}

	// Create a new GCM cipher
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// Create a nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// Encrypt the data
	ciphertext := gcm.Seal(nonce, nonce, []byte(privateKey), nil)

	// Return the encrypted data as a hex string
	return hex.EncodeToString(ciphertext), nil
}

// decryptPrivateKey decrypts a private key
func (s *ServiceWalletStore) decryptPrivateKey(encryptedKey string) (string, error) {
	// Decode the hex string
	ciphertext, err := hex.DecodeString(encryptedKey)
	if err != nil {
		return "", err
	}

	// Create a new AES cipher
	block, err := aes.NewCipher(s.encryptKey)
	if err != nil {
		return "", err
	}

	// Create a new GCM cipher
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// Ensure the ciphertext is long enough
	if len(ciphertext) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}

	// Extract the nonce
	nonce, ciphertext := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]

	// Decrypt the data
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

// ClearCache clears the wallet cache
func (s *ServiceWalletStore) ClearCache() {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()
	s.walletCache = make(map[uuid.UUID]string)
}

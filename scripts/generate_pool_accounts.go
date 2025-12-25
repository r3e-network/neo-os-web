//go:build scripts

// Generate pre-generated Neo N3 accounts for the account pool.
// Usage: go run -tags=scripts scripts/generate_pool_accounts.go
//
// Environment variables:
//   SUPABASE_URL           - Supabase project URL
//   SUPABASE_SERVICE_KEY   - Supabase service role key
//   POOL_ENCRYPTION_KEY    - 32-byte hex key for WIF encryption
//   ACCOUNT_COUNT          - Number of accounts to generate (default: 1000000)
//   BATCH_SIZE             - Accounts per database batch (default: 1000)
//   WORKERS                - Parallel generation workers (default: 8)
//   GENERATION_BATCH_ID    - Batch identifier (default: auto-generated)
package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"

	"github.com/R3E-Network/service_layer/infrastructure/database"
)

const (
	defaultAccountCount = 1000000
	defaultBatchSize    = 1000
	defaultWorkers      = 8
)

// GeneratedAccount holds all account data for storage.
type GeneratedAccount struct {
	ID           string `json:"id"`
	Address      string `json:"address"`
	PublicKey    string `json:"public_key"`
	EncryptedWIF string `json:"encrypted_wif"`
	KeyVersion   int    `json:"key_version"`
	GenBatch     string `json:"generation_batch"`
	Balance      int64  `json:"balance"`
	CreatedAt    string `json:"created_at"`
	LastUsedAt   string `json:"last_used_at"`
	TxCount      int64  `json:"tx_count"`
	IsRetiring   bool   `json:"is_retiring"`
}

type config struct {
	supabaseURL    string
	supabaseKey    string
	encryptionKey  []byte
	accountCount   int
	batchSize      int
	workers        int
	generationBatch string
}

func main() {
	ctx := context.Background()

	cfg, err := parseConfig()
	if err != nil {
		fatal("Configuration error: %v", err)
	}

	printConfig(cfg)

	// Initialize database
	dbClient, err := database.NewClient(database.Config{
		URL:        cfg.supabaseURL,
		ServiceKey: cfg.supabaseKey,
	})
	if err != nil {
		fatal("Failed to create database client: %v", err)
	}
	repo := database.NewRepository(dbClient)

	// Run generation
	if err := generateAccounts(ctx, repo, cfg); err != nil {
		fatal("Generation failed: %v", err)
	}

	fmt.Println("\n✅ Account generation complete!")
}

func parseConfig() (*config, error) {
	cfg := &config{}

	cfg.supabaseURL = strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	if cfg.supabaseURL == "" {
		return nil, fmt.Errorf("SUPABASE_URL required")
	}

	cfg.supabaseKey = strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_KEY"))
	if cfg.supabaseKey == "" {
		return nil, fmt.Errorf("SUPABASE_SERVICE_KEY required")
	}

	encKeyHex := strings.TrimSpace(os.Getenv("POOL_ENCRYPTION_KEY"))
	if encKeyHex == "" {
		return nil, fmt.Errorf("POOL_ENCRYPTION_KEY required (32-byte hex)")
	}
	encKey, err := hex.DecodeString(encKeyHex)
	if err != nil || len(encKey) != 32 {
		return nil, fmt.Errorf("POOL_ENCRYPTION_KEY must be 32 bytes (64 hex chars)")
	}
	cfg.encryptionKey = encKey

	cfg.accountCount = defaultAccountCount
	if v := os.Getenv("ACCOUNT_COUNT"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			return nil, fmt.Errorf("invalid ACCOUNT_COUNT: %s", v)
		}
		cfg.accountCount = n
	}

	cfg.batchSize = defaultBatchSize
	if v := os.Getenv("BATCH_SIZE"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 10000 {
			return nil, fmt.Errorf("invalid BATCH_SIZE: %s (must be 1-10000)", v)
		}
		cfg.batchSize = n
	}

	cfg.workers = defaultWorkers
	if v := os.Getenv("WORKERS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 64 {
			return nil, fmt.Errorf("invalid WORKERS: %s (must be 1-64)", v)
		}
		cfg.workers = n
	}

	cfg.generationBatch = os.Getenv("GENERATION_BATCH_ID")
	if cfg.generationBatch == "" {
		cfg.generationBatch = fmt.Sprintf("gen-%s", time.Now().Format("20060102-150405"))
	}

	return cfg, nil
}

func printConfig(cfg *config) {
	fmt.Println("╔════════════════════════════════════════════════════════════════╗")
	fmt.Println("║         Account Pool Batch Generator                           ║")
	fmt.Println("╚════════════════════════════════════════════════════════════════╝")
	fmt.Printf("\n📍 Configuration:\n")
	fmt.Printf("   Accounts to generate: %d\n", cfg.accountCount)
	fmt.Printf("   Batch size:           %d\n", cfg.batchSize)
	fmt.Printf("   Workers:              %d\n", cfg.workers)
	fmt.Printf("   Generation batch:     %s\n", cfg.generationBatch)
	fmt.Printf("   Encryption key:       %s...%s\n",
		hex.EncodeToString(cfg.encryptionKey[:4]),
		hex.EncodeToString(cfg.encryptionKey[28:]))
}

func generateAccounts(ctx context.Context, repo *database.Repository, cfg *config) error {
	fmt.Printf("\n🚀 Starting generation of %d accounts...\n", cfg.accountCount)
	startTime := time.Now()

	// Channel for generated accounts
	accountChan := make(chan *GeneratedAccount, cfg.batchSize*2)

	// Progress tracking
	var generated atomic.Int64
	var inserted atomic.Int64

	// Start worker goroutines for account generation
	var wg sync.WaitGroup
	accountsPerWorker := cfg.accountCount / cfg.workers
	remainder := cfg.accountCount % cfg.workers

	for i := 0; i < cfg.workers; i++ {
		count := accountsPerWorker
		if i < remainder {
			count++
		}
		wg.Add(1)
		go func(workerID, count int) {
			defer wg.Done()
			generateWorker(workerID, count, cfg, accountChan, &generated)
		}(i, count)
	}

	// Close channel when all workers done
	go func() {
		wg.Wait()
		close(accountChan)
	}()

	// Progress reporter
	done := make(chan struct{})
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				gen := generated.Load()
				ins := inserted.Load()
				elapsed := time.Since(startTime)
				rate := float64(ins) / elapsed.Seconds()
				pct := float64(ins) / float64(cfg.accountCount) * 100
				fmt.Printf("   📊 Progress: %d/%d (%.1f%%) | Generated: %d | Rate: %.0f/s | Elapsed: %s\n",
					ins, cfg.accountCount, pct, gen, rate, elapsed.Round(time.Second))
			case <-done:
				return
			}
		}
	}()

	// Batch inserter
	batch := make([]*GeneratedAccount, 0, cfg.batchSize)
	for acc := range accountChan {
		batch = append(batch, acc)
		if len(batch) >= cfg.batchSize {
			if err := insertBatch(ctx, repo, batch); err != nil {
				close(done)
				return fmt.Errorf("insert batch: %w", err)
			}
			inserted.Add(int64(len(batch)))
			batch = batch[:0]
		}
	}

	// Insert remaining
	if len(batch) > 0 {
		if err := insertBatch(ctx, repo, batch); err != nil {
			close(done)
			return fmt.Errorf("insert final batch: %w", err)
		}
		inserted.Add(int64(len(batch)))
	}

	close(done)

	elapsed := time.Since(startTime)
	rate := float64(cfg.accountCount) / elapsed.Seconds()
	fmt.Printf("\n📊 Final Statistics:\n")
	fmt.Printf("   Total generated: %d accounts\n", cfg.accountCount)
	fmt.Printf("   Total time:      %s\n", elapsed.Round(time.Millisecond))
	fmt.Printf("   Average rate:    %.0f accounts/second\n", rate)

	return nil
}

func generateWorker(workerID, count int, cfg *config, out chan<- *GeneratedAccount, counter *atomic.Int64) {
	now := time.Now().UTC().Format(time.RFC3339)

	for i := 0; i < count; i++ {
		// Generate random private key
		privKey, err := keys.NewPrivateKey()
		if err != nil {
			fmt.Printf("Worker %d: key generation error: %v\n", workerID, err)
			continue
		}

		// Get WIF and encrypt it
		wif := privKey.WIF()
		encryptedWIF, err := encryptWIF(wif, cfg.encryptionKey)
		if err != nil {
			fmt.Printf("Worker %d: encryption error: %v\n", workerID, err)
			continue
		}

		// Get public key (compressed hex)
		pubKeyHex := hex.EncodeToString(privKey.PublicKey().Bytes())

		acc := &GeneratedAccount{
			ID:           uuid.New().String(),
			Address:      privKey.Address(),
			PublicKey:    pubKeyHex,
			EncryptedWIF: encryptedWIF,
			KeyVersion:   1,
			GenBatch:     cfg.generationBatch,
			Balance:      0,
			CreatedAt:    now,
			LastUsedAt:   now,
			TxCount:      0,
			IsRetiring:   false,
		}

		out <- acc
		counter.Add(1)
	}
}

// encryptWIF encrypts a WIF using AES-256-GCM.
func encryptWIF(wif string, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(wif), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// insertBatch inserts a batch of accounts into Supabase.
func insertBatch(ctx context.Context, repo *database.Repository, accounts []*GeneratedAccount) error {
	if len(accounts) == 0 {
		return nil
	}

	// Pass accounts directly - repo.Request will marshal to JSON
	resp, err := repo.Request(ctx, "POST", "pool_accounts", accounts, "")
	if err != nil {
		fmt.Printf("   ⚠️  Insert error: %v\n", err)
		fmt.Printf("   ⚠️  First account: %s\n", accounts[0].Address)
		return fmt.Errorf("insert accounts: %w", err)
	}

	// Check if response indicates an error
	if len(resp) > 0 && resp[0] == '{' {
		var errResp map[string]interface{}
		if json.Unmarshal(resp, &errResp) == nil {
			if code, ok := errResp["code"]; ok {
				return fmt.Errorf("supabase error: %v - %v", code, errResp["message"])
			}
		}
	}

	return nil
}

func fatal(format string, args ...interface{}) {
	fmt.Printf("❌ "+format+"\n", args...)
	os.Exit(1)
}

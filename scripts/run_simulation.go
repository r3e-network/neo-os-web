//go:build scripts

// Long-running MiniApp simulation with auto top-up.
// Usage: go run -tags=scripts scripts/run_simulation.go
package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/gas"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/nep17"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	TopUpAmount     = 100000000  // 1 GAS per top-up
	MinBalance      = 10000000   // 0.1 GAS minimum before top-up
	SimInterval     = 5 * time.Second
	MaxConcurrent   = 3
	PoolAccountsURL = "/rest/v1/pool_accounts"
)

type PoolAccount struct {
	ID           string `json:"id"`
	Address      string `json:"address"`
	EncryptedWIF string `json:"encrypted_wif"`
	Balance      int64  `json:"balance"`
}

type Simulation struct {
	ctx           context.Context
	cancel        context.CancelFunc
	rpc           *rpcclient.Client
	funderAccount *wallet.Account
	funderActor   *actor.Actor
	gasContract   *nep17.Token
	contracts     map[string]util.Uint160
	supabaseURL   string
	supabaseKey   string
	encryptionKey []byte

	// Stats
	txSent      int64
	txSuccess   int64
	txFailed    int64
	topUps      int64
	startTime   time.Time
}

type MiniAppConfig struct {
	AppID    string
	Name     string
	Amount   int64
	Interval time.Duration
}

func main() {
	fmt.Println("╔════════════════════════════════════════════════════════════════╗")
	fmt.Println("║      Long-Running MiniApp Simulation (Ctrl+C to stop)          ║")
	fmt.Println("╚════════════════════════════════════════════════════════════════╝")

	sim, err := NewSimulation()
	if err != nil {
		fmt.Printf("❌ Init failed: %v\n", err)
		os.Exit(1)
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		fmt.Println("\n⏹️  Stopping simulation...")
		sim.cancel()
	}()

	sim.Run()
	sim.PrintStats()
}

func NewSimulation() (*Simulation, error) {
	ctx, cancel := context.WithCancel(context.Background())

	rpcURL := os.Getenv("NEO_RPC_URL")
	if rpcURL == "" {
		rpcURL = "https://testnet1.neo.coz.io:443"
	}

	rpc, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{})
	if err != nil {
		cancel()
		return nil, fmt.Errorf("RPC connect: %w", err)
	}

	wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if wif == "" {
		cancel()
		return nil, fmt.Errorf("NEO_TESTNET_WIF required")
	}

	privKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("parse WIF: %w", err)
	}
	funderAccount := wallet.NewAccountFromPrivateKey(privKey)

	act, err := actor.NewSimple(rpc, funderAccount)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("create actor: %w", err)
	}

	gasContract := gas.New(act)

	// Load encryption key
	encKeyHex := os.Getenv("POOL_ENCRYPTION_KEY")
	encKey, _ := hex.DecodeString(encKeyHex)

	contracts := loadContracts()

	fmt.Printf("📍 Funder: %s\n", funderAccount.Address)
	fmt.Printf("📍 RPC: %s\n", rpcURL)

	return &Simulation{
		ctx:           ctx,
		cancel:        cancel,
		rpc:           rpc,
		funderAccount: funderAccount,
		funderActor:   act,
		gasContract:   gasContract,
		contracts:     contracts,
		supabaseURL:   os.Getenv("SUPABASE_URL"),
		supabaseKey:   os.Getenv("SUPABASE_SERVICE_KEY"),
		encryptionKey: encKey,
		startTime:     time.Now(),
	}, nil
}

func loadContracts() map[string]util.Uint160 {
	contracts := make(map[string]util.Uint160)
	load := func(name, env string) {
		h, _ := util.Uint160DecodeStringLE(strings.TrimPrefix(os.Getenv(env), "0x"))
		contracts[name] = h
	}
	load("PaymentHub", "CONTRACT_PAYMENT_HUB_ADDRESS")
	load("PriceFeed", "CONTRACT_PRICE_FEED_ADDRESS")
	load("RandomnessLog", "CONTRACT_RANDOMNESS_LOG_ADDRESS")
	load("Governance", "CONTRACT_GOVERNANCE_ADDRESS")
	return contracts
}

func getMiniApps() []MiniAppConfig {
	return []MiniAppConfig{
		{"miniapp-lottery", "Lottery", 10000000, 10 * time.Second},        // 0.1 GAS
		{"miniapp-coin-flip", "CoinFlip", 5000000, 8 * time.Second},       // 0.05 GAS
		{"miniapp-dice-game", "DiceGame", 5000000, 8 * time.Second},       // 0.05 GAS
		{"miniapp-scratch-card", "ScratchCard", 10000000, 15 * time.Second}, // 0.1 GAS
		{"builtin-gas-spin", "GasSpin", 5000000, 12 * time.Second},        // 0.05 GAS
		{"builtin-price-predict", "PricePredict", 10000000, 20 * time.Second}, // 0.1 GAS
	}
}

func (s *Simulation) Run() {
	fmt.Println("\n🚀 Starting simulation...")

	// Fetch pool accounts
	accounts, err := s.getPoolAccounts(10)
	if err != nil {
		fmt.Printf("❌ Failed to fetch pool accounts: %v\n", err)
		return
	}
	fmt.Printf("📦 Loaded %d pool accounts\n", len(accounts))

	if len(accounts) == 0 {
		fmt.Println("❌ No pool accounts available")
		return
	}

	// Convert to pointers for in-place updates
	accountPtrs := make([]*PoolAccount, len(accounts))
	for i := range accounts {
		accountPtrs[i] = &accounts[i]
	}

	miniapps := getMiniApps()
	fmt.Printf("🎮 Simulating %d MiniApps\n\n", len(miniapps))

	// Semaphore for concurrency control
	sem := make(chan struct{}, MaxConcurrent)
	var wg sync.WaitGroup
	var mu sync.Mutex // Protect account balance updates

	ticker := time.NewTicker(SimInterval)
	defer ticker.Stop()

	round := 0
	for {
		select {
		case <-s.ctx.Done():
			fmt.Println("\n⏳ Waiting for pending transactions...")
			wg.Wait()
			return
		case <-ticker.C:
			round++
			fmt.Printf("\n━━━ Round %d ━━━ [%s]\n", round, time.Now().Format("15:04:05"))

			// Refresh all balances every 5 rounds
			if round%5 == 0 {
				fmt.Println("   🔄 Refreshing account balances...")
				for _, acc := range accountPtrs {
					s.refreshAccountBalance(acc)
				}
			}

			// Pick random account and miniapp
			acc := accountPtrs[rand.Intn(len(accountPtrs))]
			app := miniapps[rand.Intn(len(miniapps))]

			mu.Lock()
			currentBalance := acc.Balance
			mu.Unlock()

			fmt.Printf("   📊 %s balance: %.4f GAS\n", acc.Address[:8], float64(currentBalance)/1e8)

			// Check and top-up if needed
			if currentBalance < MinBalance {
				if err := s.topUpAccount(acc); err != nil {
					fmt.Printf("   ⚠️  Top-up failed for %s: %v\n", acc.Address[:8], err)
				} else {
					atomic.AddInt64(&s.topUps, 1)
					mu.Lock()
					acc.Balance += TopUpAmount
					mu.Unlock()
				}
			}

			// Simulate MiniApp interaction
			wg.Add(1)
			sem <- struct{}{}
			go func(acc *PoolAccount, app MiniAppConfig) {
				defer wg.Done()
				defer func() { <-sem }()

				atomic.AddInt64(&s.txSent, 1)
				if err := s.simulateMiniApp(*acc, app); err != nil {
					atomic.AddInt64(&s.txFailed, 1)
					fmt.Printf("   ❌ %s failed: %v\n", app.Name, err)
				} else {
					atomic.AddInt64(&s.txSuccess, 1)
					// Deduct payment amount from local balance
					mu.Lock()
					acc.Balance -= app.Amount
					mu.Unlock()
					fmt.Printf("   ✅ %s: %s paid %.4f GAS\n", app.Name, acc.Address[:8], float64(app.Amount)/1e8)
				}
			}(acc, app)

			// Print periodic stats
			if round%10 == 0 {
				s.printInlineStats()
			}
		}
	}
}

func (s *Simulation) getPoolAccounts(limit int) ([]PoolAccount, error) {
	url := fmt.Sprintf("%s%s?select=id,address,encrypted_wif&limit=%d",
		s.supabaseURL, PoolAccountsURL, limit)

	req, err := http.NewRequestWithContext(s.ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var accounts []PoolAccount
	if err := json.Unmarshal(body, &accounts); err != nil {
		return nil, err
	}

	// Get on-chain balances
	for i := range accounts {
		addr, err := address.StringToUint160(accounts[i].Address)
		if err == nil {
			bal, _ := s.gasContract.BalanceOf(addr)
			if bal != nil {
				accounts[i].Balance = bal.Int64()
			}
		}
	}

	return accounts, nil
}

func (s *Simulation) refreshAccountBalance(acc *PoolAccount) error {
	addr, err := address.StringToUint160(acc.Address)
	if err != nil {
		return err
	}
	bal, err := s.gasContract.BalanceOf(addr)
	if err != nil {
		return err
	}
	if bal != nil {
		acc.Balance = bal.Int64()
	}
	return nil
}

func (s *Simulation) topUpAccount(acc *PoolAccount) error {
	toAddr, err := address.StringToUint160(acc.Address)
	if err != nil {
		return fmt.Errorf("parse address: %w", err)
	}

	fmt.Printf("   💰 Topping up %s with 1 GAS...\n", acc.Address[:8])

	txHash, _, err := s.gasContract.Transfer(
		s.funderAccount.ScriptHash(),
		toAddr,
		big.NewInt(TopUpAmount),
		nil,
	)
	if err != nil {
		return fmt.Errorf("transfer: %w", err)
	}

	fmt.Printf("   📤 Top-up TX: %s\n", txHash.StringLE())
	return nil
}

func (s *Simulation) simulateMiniApp(acc PoolAccount, app MiniAppConfig) error {
	// Decrypt WIF to get account
	wif, err := s.decryptWIF(acc.EncryptedWIF)
	if err != nil {
		return fmt.Errorf("decrypt WIF: %w", err)
	}

	privKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		return fmt.Errorf("parse WIF: %w", err)
	}
	userAccount := wallet.NewAccountFromPrivateKey(privKey)

	// Create actor for this account
	userActor, err := actor.NewSimple(s.rpc, userAccount)
	if err != nil {
		return fmt.Errorf("create actor: %w", err)
	}

	// Simulate payment to PaymentHub
	paymentHub := s.contracts["PaymentHub"]
	if paymentHub.Equals(util.Uint160{}) {
		return fmt.Errorf("PaymentHub contract not configured")
	}

	// Build payment transaction (GAS transfer to PaymentHub with app data)
	txHash, _, err := userActor.SendCall(
		gas.Hash,
		"transfer",
		userAccount.ScriptHash(),
		paymentHub,
		big.NewInt(app.Amount),
		[]byte(app.AppID),
	)
	if err != nil {
		return fmt.Errorf("send payment: %w", err)
	}

	fmt.Printf("   📤 TX: %s\n", txHash.StringLE())
	return nil
}

func (s *Simulation) decryptWIF(encryptedWIF string) (string, error) {
	if len(s.encryptionKey) != 32 {
		return "", fmt.Errorf("invalid encryption key length")
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encryptedWIF)
	if err != nil {
		return "", fmt.Errorf("base64 decode: %w", err)
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

func (s *Simulation) printInlineStats() {
	sent := atomic.LoadInt64(&s.txSent)
	success := atomic.LoadInt64(&s.txSuccess)
	failed := atomic.LoadInt64(&s.txFailed)
	topups := atomic.LoadInt64(&s.topUps)
	elapsed := time.Since(s.startTime)

	fmt.Printf("\n📊 Stats: %d sent | %d success | %d failed | %d top-ups | %.1f tx/min\n",
		sent, success, failed, topups,
		float64(sent)/elapsed.Minutes())
}

func (s *Simulation) PrintStats() {
	sent := atomic.LoadInt64(&s.txSent)
	success := atomic.LoadInt64(&s.txSuccess)
	failed := atomic.LoadInt64(&s.txFailed)
	topups := atomic.LoadInt64(&s.topUps)
	elapsed := time.Since(s.startTime)

	fmt.Println("\n╔════════════════════════════════════════════════════════════════╗")
	fmt.Println("║                    SIMULATION SUMMARY                          ║")
	fmt.Println("╚════════════════════════════════════════════════════════════════╝")
	fmt.Printf("\n⏱️  Duration: %s\n", elapsed.Round(time.Second))
	fmt.Printf("📤 Transactions Sent:    %d\n", sent)
	fmt.Printf("✅ Successful:           %d (%.1f%%)\n", success, percent(success, sent))
	fmt.Printf("❌ Failed:               %d (%.1f%%)\n", failed, percent(failed, sent))
	fmt.Printf("💰 Top-ups:              %d\n", topups)
	fmt.Printf("📈 Rate:                 %.2f tx/min\n", float64(sent)/elapsed.Minutes())
}

func percent(part, total int64) float64 {
	if total == 0 {
		return 0
	}
	return float64(part) / float64(total) * 100
}

// Suppress unused import warning
var _ = smartcontract.Parameter{}

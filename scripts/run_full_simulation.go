//go:build scripts

// Full MiniApp simulation with service callbacks and contract invocations.
// Usage: go run -tags=scripts scripts/run_full_simulation.go
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
	"math/big"
	mrand "math/rand"
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
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/vm/stackitem"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

const (
	TopUpAmount     = 100000000 // 1 GAS per top-up
	MinBalance      = 10000000  // 0.1 GAS minimum
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
	teeAccount    *wallet.Account
	teeActor      *actor.Actor
	funderAccount *wallet.Account
	funderActor   *actor.Actor
	gasContract   *nep17.Token
	contracts     map[string]util.Uint160
	supabaseURL   string
	supabaseKey   string
	encryptionKey []byte

	// Stats
	txSent           int64
	txSuccess        int64
	txFailed         int64
	topUps           int64
	paymentTx        int64
	serviceRequestTx int64
	serviceFulfillTx int64
	randomnessTx     int64
	priceFeedTx      int64
	payoutTx         int64
	startTime        time.Time
}

func main() {
	fmt.Println("╔════════════════════════════════════════════════════════════════╗")
	fmt.Println("║   Full MiniApp Simulation with Service Callbacks               ║")
	fmt.Println("║   (Ctrl+C to stop)                                             ║")
	fmt.Println("╚════════════════════════════════════════════════════════════════╝")

	sim, err := NewSimulation()
	if err != nil {
		fmt.Printf("❌ Init failed: %v\n", err)
		os.Exit(1)
	}

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

	// Funder account (for top-ups)
	funderWIF := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if funderWIF == "" {
		cancel()
		return nil, fmt.Errorf("NEO_TESTNET_WIF required")
	}
	funderKey, _ := keys.NewPrivateKeyFromWIF(funderWIF)
	funderAccount := wallet.NewAccountFromPrivateKey(funderKey)
	funderActor, _ := actor.NewSimple(rpc, funderAccount)

	// TEE account (for service callbacks - RandomnessLog, PriceFeed)
	teeKeyHex := strings.TrimSpace(os.Getenv("TEE_PRIVATE_KEY"))
	var teeAccount *wallet.Account
	var teeActor *actor.Actor
	if teeKeyHex != "" {
		teeKeyBytes, _ := hex.DecodeString(teeKeyHex)
		teeKey, _ := keys.NewPrivateKeyFromBytes(teeKeyBytes)
		teeAccount = wallet.NewAccountFromPrivateKey(teeKey)
		teeActor, _ = actor.NewSimple(rpc, teeAccount)
		fmt.Printf("📍 TEE Signer: %s\n", teeAccount.Address)
	}

	gasContract := gas.New(funderActor)
	encKeyHex := os.Getenv("POOL_ENCRYPTION_KEY")
	encKey, _ := hex.DecodeString(encKeyHex)
	contracts := loadContracts()

	fmt.Printf("📍 Funder: %s\n", funderAccount.Address)
	fmt.Printf("📍 RPC: %s\n", rpcURL)

	return &Simulation{
		ctx:           ctx,
		cancel:        cancel,
		rpc:           rpc,
		teeAccount:    teeAccount,
		teeActor:      teeActor,
		funderAccount: funderAccount,
		funderActor:   funderActor,
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
	load("PaymentHub", "CONTRACT_PAYMENTHUB_HASH")
	load("PriceFeed", "CONTRACT_PRICEFEED_HASH")
	load("RandomnessLog", "CONTRACT_RANDOMNESSLOG_HASH")
	load("Governance", "CONTRACT_GOVERNANCE_HASH")
	load("ServiceGateway", "CONTRACT_SERVICEGATEWAY_HASH")
	load("AppRegistry", "CONTRACT_APPREGISTRY_HASH")
	load("Consumer", "CONTRACT_CONSUMER_HASH")
	return contracts
}

func (s *Simulation) Run() {
	fmt.Println("\n🚀 Starting full simulation with service callbacks...")

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

	accountPtrs := make([]*PoolAccount, len(accounts))
	for i := range accounts {
		accountPtrs[i] = &accounts[i]
	}

	sem := make(chan struct{}, MaxConcurrent)
	var wg sync.WaitGroup
	var mu sync.Mutex

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

			// Refresh balances every 5 rounds
			if round%5 == 0 {
				fmt.Println("   🔄 Refreshing account balances...")
				for _, acc := range accountPtrs {
					s.refreshAccountBalance(acc)
				}
			}

			acc := accountPtrs[mrand.Intn(len(accountPtrs))]
			mu.Lock()
			currentBalance := acc.Balance
			mu.Unlock()

			fmt.Printf("   📊 %s balance: %.4f GAS\n", acc.Address[:8], float64(currentBalance)/1e8)

			// Top-up if needed
			if currentBalance < MinBalance {
				if err := s.topUpAccount(acc); err != nil {
					fmt.Printf("   ⚠️  Top-up failed: %v\n", err)
				} else {
					atomic.AddInt64(&s.topUps, 1)
					mu.Lock()
					acc.Balance += TopUpAmount
					mu.Unlock()
				}
			}

			// Run simulation workflow
			wg.Add(1)
			sem <- struct{}{}
			go func(acc *PoolAccount, round int) {
				defer wg.Done()
				defer func() { <-sem }()
				s.runWorkflow(acc, round, &mu)
			}(acc, round)

			if round%10 == 0 {
				s.printInlineStats()
			}
		}
	}
}

// runWorkflow executes a complete MiniApp workflow with service callbacks
func (s *Simulation) runWorkflow(acc *PoolAccount, round int, mu *sync.Mutex) {
	appID := getRandomAppID()
	atomic.AddInt64(&s.txSent, 1)
	paymentHub := s.contracts["PaymentHub"].StringLE()
	gateway := s.contracts["ServiceGateway"].StringLE()
	rngLog := s.contracts["RandomnessLog"].StringLE()

	// Step 1: User Payment to PaymentHub
	fmt.Printf("   [1/5] 💰 Payment: %s → PaymentHub\n", acc.Address[:8])
	payTx, err := s.sendPayment(acc, appID)
	if err != nil {
		atomic.AddInt64(&s.txFailed, 1)
		fmt.Printf("   ❌ Payment failed: %v\n", err)
		s.storeTx(payTx, "payment", appID, acc.Address, paymentHub, "transfer", 5000000, "failed")
		return
	}
	atomic.AddInt64(&s.paymentTx, 1)
	fmt.Printf("   ✅ Payment TX: %s\n", payTx[:16])
	s.storeTx(payTx, "payment", appID, acc.Address, paymentHub, "transfer", 5000000, "success")
	go s.fetchAndStoreEvents(payTx, appID)

	mu.Lock()
	acc.Balance -= 5000000
	mu.Unlock()

	// Step 2: Service Request via ServiceLayerGateway
	if !s.contracts["ServiceGateway"].Equals(util.Uint160{}) {
		fmt.Printf("   [2/5] 📤 ServiceGateway.requestService()\n")
		reqTx, reqID, err := s.requestService(appID, "randomness")
		if err != nil {
			fmt.Printf("   ⚠️  Request failed: %v\n", err)
		} else {
			atomic.AddInt64(&s.serviceRequestTx, 1)
			fmt.Printf("   ✅ Request TX: %s (ID: %d)\n", reqTx[:16], reqID)
			s.storeTx(reqTx, "request", appID, acc.Address, gateway, "requestService", 0, "success")
			s.storeServiceRequest(reqID, appID, "randomness", acc.Address, reqTx)
			go s.fetchAndStoreEvents(reqTx, appID)

			// Step 3: Service Fulfillment (TEE callback)
			fmt.Printf("   [3/5] 📥 ServiceGateway.fulfillRequest()\n")
			fulfillTx, err := s.fulfillRequest(reqID)
			if err != nil {
				fmt.Printf("   ⚠️  Fulfill failed: %v\n", err)
				s.updateServiceRequest(reqID, false, "")
			} else {
				atomic.AddInt64(&s.serviceFulfillTx, 1)
				fmt.Printf("   ✅ Fulfill TX: %s\n", fulfillTx[:16])
				s.storeTx(fulfillTx, "fulfill", appID, "", gateway, "fulfillRequest", 0, "success")
				s.updateServiceRequest(reqID, true, fulfillTx)
				go s.fetchAndStoreEvents(fulfillTx, appID)
			}
		}
	}

	// Step 4: Direct contract callbacks (RandomnessLog, PriceFeed)
	if s.teeActor != nil && !s.contracts["RandomnessLog"].Equals(util.Uint160{}) {
		fmt.Printf("   [4/5] 🎲 RandomnessLog.record()\n")
		rngTx, err := s.recordRandomness(round)
		if err != nil {
			fmt.Printf("   ⚠️  Randomness: %v\n", err)
		} else {
			atomic.AddInt64(&s.randomnessTx, 1)
			fmt.Printf("   ✅ Randomness TX: %s\n", rngTx[:16])
			s.storeTx(rngTx, "randomness", appID, "", rngLog, "record", 0, "success")
			go s.fetchAndStoreEvents(rngTx, appID)
		}
	}

	// Step 5: Callback Payout (simulated win)
	if mrand.Intn(100) < 30 {
		fmt.Printf("   [5/5] 🎁 Callback Payout: Winner!\n")
		payoutTx, err := s.sendPayout(acc.Address)
		if err != nil {
			fmt.Printf("   ⚠️  Payout failed: %v\n", err)
		} else {
			atomic.AddInt64(&s.payoutTx, 1)
			fmt.Printf("   ✅ Payout TX: %s\n", payoutTx[:16])
			s.storeTx(payoutTx, "payout", appID, acc.Address, "", "transfer", 10000000, "success")
			go s.fetchAndStoreEvents(payoutTx, appID)
		}
	}

	atomic.AddInt64(&s.txSuccess, 1)
}

func getRandomAppID() string {
	apps := []string{
		"builtin-gas-spin",      // Lucky wheel with VRF
		"builtin-price-predict", // Binary options with datafeed
		"builtin-secret-vote",   // Privacy governance voting
		"builtin-lottery",
		"builtin-coin-flip",
		"builtin-dice-game",
		"builtin-secret-poker",  // TEE Texas Hold'em
		"builtin-micro-predict", // High-freq 60s prediction
		"builtin-red-envelope",  // Social GAS packets
	}
	return apps[mrand.Intn(len(apps))]
}

// requestService calls ServiceLayerGateway.requestService() and returns real requestID from chain
func (s *Simulation) requestService(appID, serviceType string) (string, int64, error) {
	if s.funderActor == nil {
		return "", 0, fmt.Errorf("funder actor not configured")
	}
	gateway := s.contracts["ServiceGateway"]
	consumer := s.contracts["Consumer"]
	if consumer.Equals(util.Uint160{}) {
		return "", 0, fmt.Errorf("Consumer contract not configured")
	}

	payload := []byte(fmt.Sprintf(`{"app":"%s","type":"%s"}`, appID, serviceType))

	txHash, _, err := s.funderActor.SendCall(
		gateway, "requestService",
		appID, serviceType, payload,
		consumer, "onServiceCallback",
	)
	if err != nil {
		return "", 0, err
	}

	// Wait for tx and extract real requestID from ServiceRequested event
	requestID, err := s.waitForRequestID(txHash, gateway)
	if err != nil {
		return txHash.StringLE(), 0, fmt.Errorf("tx sent but failed to get requestID: %w", err)
	}

	return txHash.StringLE(), requestID, nil
}

// waitForRequestID waits for tx confirmation and extracts requestID from ServiceRequested event
func (s *Simulation) waitForRequestID(txHash util.Uint256, gateway util.Uint160) (int64, error) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	timeout := time.After(30 * time.Second)

	for {
		select {
		case <-timeout:
			return 0, fmt.Errorf("timeout waiting for tx")
		case <-ticker.C:
			appLog, err := s.rpc.GetApplicationLog(txHash, nil)
			if err != nil {
				continue
			}
			if len(appLog.Executions) == 0 {
				continue
			}
			exec := appLog.Executions[0]
			if exec.VMState.HasFlag(1) { // HALT
				// Find ServiceRequested event
				for _, notif := range exec.Events {
					if notif.ScriptHash.Equals(gateway) && notif.Name == "ServiceRequested" {
						// First item is requestId (BigInteger)
						if len(notif.Item.Value().([]stackitem.Item)) > 0 {
							reqIDItem := notif.Item.Value().([]stackitem.Item)[0]
							reqID, _ := reqIDItem.TryInteger()
							if reqID != nil {
								return reqID.Int64(), nil
							}
						}
					}
				}
				return 0, fmt.Errorf("ServiceRequested event not found")
			}
			return 0, fmt.Errorf("tx failed: %s", exec.FaultException)
		}
	}
}

// fulfillRequest calls ServiceLayerGateway.fulfillRequest() - TEE callback
func (s *Simulation) fulfillRequest(requestID int64) (string, error) {
	if s.teeActor == nil {
		return "", fmt.Errorf("TEE actor not configured")
	}
	gateway := s.contracts["ServiceGateway"]

	randomResult := make([]byte, 32)
	rand.Read(randomResult)

	txHash, _, err := s.teeActor.SendCall(
		gateway, "fulfillRequest",
		big.NewInt(requestID), true, randomResult, "",
	)
	if err != nil {
		return "", err
	}
	return txHash.StringLE(), nil
}

// sendPayment sends GAS to PaymentHub with appID as data
func (s *Simulation) sendPayment(acc *PoolAccount, appID string) (string, error) {
	wif, err := s.decryptWIF(acc.EncryptedWIF)
	if err != nil {
		return "", err
	}
	privKey, _ := keys.NewPrivateKeyFromWIF(wif)
	userAccount := wallet.NewAccountFromPrivateKey(privKey)
	userActor, _ := actor.NewSimple(s.rpc, userAccount)

	paymentHub := s.contracts["PaymentHub"]
	txHash, _, err := userActor.SendCall(
		gas.Hash, "transfer",
		userAccount.ScriptHash(), paymentHub,
		big.NewInt(5000000), []byte(appID),
	)
	if err != nil {
		return "", err
	}
	return txHash.StringLE(), nil
}

// recordRandomness invokes RandomnessLog.record() - SERVICE CALLBACK
func (s *Simulation) recordRandomness(round int) (string, error) {
	if s.teeActor == nil {
		return "", fmt.Errorf("TEE account not configured")
	}
	requestID := fmt.Sprintf("req-%d-%d", time.Now().Unix(), round)
	randomBytes := make([]byte, 32)
	rand.Read(randomBytes)
	attestation := make([]byte, 32)
	rand.Read(attestation)
	timestamp := big.NewInt(time.Now().UnixMilli())

	txHash, _, err := s.teeActor.SendCall(
		s.contracts["RandomnessLog"], "record",
		requestID, randomBytes, attestation, timestamp,
	)
	if err != nil {
		return "", err
	}
	return txHash.StringLE(), nil
}

// sendPayout sends callback payout to winner - SERVICE CALLBACK
func (s *Simulation) sendPayout(toAddress string) (string, error) {
	toAddr, err := address.StringToUint160(toAddress)
	if err != nil {
		return "", err
	}
	amount := big.NewInt(10000000) // 0.1 GAS payout

	txHash, _, err := s.gasContract.Transfer(
		s.funderAccount.ScriptHash(), toAddr, amount, nil,
	)
	if err != nil {
		return "", err
	}
	return txHash.StringLE(), nil
}

// updatePriceFeed invokes PriceFeed.update() - SERVICE CALLBACK
func (s *Simulation) updatePriceFeed() (string, error) {
	if s.teeActor == nil {
		return "", fmt.Errorf("TEE account not configured")
	}
	symbols := []string{"BTCUSD", "ETHUSD", "NEOUSD", "GASUSD"}
	symbol := symbols[mrand.Intn(len(symbols))]
	roundID := big.NewInt(time.Now().Unix())
	price := big.NewInt(10000000000 + int64(mrand.Intn(1000000000)))
	timestamp := big.NewInt(time.Now().UnixMilli())
	attestation := make([]byte, 32)
	rand.Read(attestation)
	sourceSetID := big.NewInt(1)

	txHash, _, err := s.teeActor.SendCall(
		s.contracts["PriceFeed"], "update",
		symbol, roundID, price, timestamp, attestation, sourceSetID,
	)
	if err != nil {
		return "", err
	}
	return txHash.StringLE(), nil
}

func (s *Simulation) getPoolAccounts(limit int) ([]PoolAccount, error) {
	url := fmt.Sprintf("%s%s?select=id,address,encrypted_wif&limit=%d",
		s.supabaseURL, PoolAccountsURL, limit)
	req, _ := http.NewRequestWithContext(s.ctx, "GET", url, nil)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var accounts []PoolAccount
	json.Unmarshal(body, &accounts)

	for i := range accounts {
		s.refreshAccountBalance(&accounts[i])
	}
	return accounts, nil
}

func (s *Simulation) refreshAccountBalance(acc *PoolAccount) {
	addr, err := address.StringToUint160(acc.Address)
	if err != nil {
		return
	}
	bal, _ := s.gasContract.BalanceOf(addr)
	if bal != nil {
		acc.Balance = bal.Int64()
	}
}

func (s *Simulation) topUpAccount(acc *PoolAccount) error {
	toAddr, _ := address.StringToUint160(acc.Address)
	fmt.Printf("   💰 Topping up %s...\n", acc.Address[:8])
	txHash, _, err := s.gasContract.Transfer(
		s.funderAccount.ScriptHash(), toAddr,
		big.NewInt(TopUpAmount), nil,
	)
	if err != nil {
		return err
	}
	fmt.Printf("   📤 Top-up TX: %s\n", txHash.StringLE()[:16])
	return nil
}

func (s *Simulation) decryptWIF(encryptedWIF string) (string, error) {
	if len(s.encryptionKey) != 32 {
		return "", fmt.Errorf("invalid encryption key")
	}
	ciphertext, _ := base64.StdEncoding.DecodeString(encryptedWIF)
	block, _ := aes.NewCipher(s.encryptionKey)
	gcm, _ := cipher.NewGCM(block)
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func (s *Simulation) printInlineStats() {
	fmt.Printf("\n📊 Stats: %d sent | %d success | %d payments | %d requests | %d fulfills | %d payouts\n",
		atomic.LoadInt64(&s.txSent), atomic.LoadInt64(&s.txSuccess),
		atomic.LoadInt64(&s.paymentTx), atomic.LoadInt64(&s.serviceRequestTx),
		atomic.LoadInt64(&s.serviceFulfillTx), atomic.LoadInt64(&s.payoutTx))
}

func (s *Simulation) PrintStats() {
	elapsed := time.Since(s.startTime)
	fmt.Println("\n╔════════════════════════════════════════════════════════════════╗")
	fmt.Println("║              FULL SIMULATION SUMMARY                           ║")
	fmt.Println("╚════════════════════════════════════════════════════════════════╝")
	fmt.Printf("⏱️  Duration: %s\n", elapsed.Round(time.Second))
	fmt.Printf("📤 Total TX Sent:     %d\n", atomic.LoadInt64(&s.txSent))
	fmt.Printf("✅ Successful:        %d\n", atomic.LoadInt64(&s.txSuccess))
	fmt.Printf("❌ Failed:            %d\n", atomic.LoadInt64(&s.txFailed))
	fmt.Println("\n📋 Transaction Types:")
	fmt.Printf("   💰 Payments:          %d (user → PaymentHub)\n", atomic.LoadInt64(&s.paymentTx))
	fmt.Printf("   📤 Service Requests:  %d (ServiceGateway.requestService)\n", atomic.LoadInt64(&s.serviceRequestTx))
	fmt.Printf("   📥 Service Fulfills:  %d (ServiceGateway.fulfillRequest)\n", atomic.LoadInt64(&s.serviceFulfillTx))
	fmt.Printf("   🎲 Randomness:        %d (RandomnessLog.record)\n", atomic.LoadInt64(&s.randomnessTx))
	fmt.Printf("   🎁 Payouts:           %d (callback payout)\n", atomic.LoadInt64(&s.payoutTx))
	fmt.Printf("   💰 Top-ups:           %d\n", atomic.LoadInt64(&s.topUps))
}

// storeTx stores a transaction record in Supabase
func (s *Simulation) storeTx(txHash, txType, appID, account, contract, method string, amount int64, status string) {
	payload := map[string]interface{}{
		"tx_hash":         txHash,
		"tx_type":         txType,
		"app_id":          appID,
		"account_address": account,
		"contract_hash":   contract,
		"method_name":     method,
		"amount":          amount,
		"status":          status,
	}
	go s.postToSupabase("simulation_transactions", payload)
}

// storeEvent stores a contract event in Supabase (matches actual contract_events table schema)
func (s *Simulation) storeEvent(txHash string, blockIndex int64, contract, eventName, appID string, state map[string]interface{}) {
	// Add contract_hash to state data for reference
	state["contract_hash"] = contract

	payload := map[string]interface{}{
		"tx_hash":      txHash,
		"app_id":       appID,
		"event_name":   eventName,
		"block_number": blockIndex,
		"data":         state,
	}
	go s.postToSupabase("contract_events", payload)
}

// fetchAndStoreEvents fetches events from chain and stores them in Supabase
func (s *Simulation) fetchAndStoreEvents(txHashStr, appID string) {
	txHash, err := util.Uint256DecodeStringLE(txHashStr)
	if err != nil {
		fmt.Printf("   📋 Events: decode hash failed: %v\n", err)
		return
	}

	// Wait briefly for tx to be included in block
	time.Sleep(3 * time.Second)

	appLog, err := s.rpc.GetApplicationLog(txHash, nil)
	if err != nil {
		// Retry once after more time
		time.Sleep(5 * time.Second)
		appLog, err = s.rpc.GetApplicationLog(txHash, nil)
		if err != nil {
			return // Silent fail on retry
		}
	}

	if len(appLog.Executions) == 0 {
		return
	}

	exec := appLog.Executions[0]
	if !exec.VMState.HasFlag(1) { // Not HALT
		return
	}

	// Get block index from tx via block hash
	txInfo, err := s.rpc.GetRawTransactionVerbose(txHash)
	if err != nil {
		return
	}

	var blockIndex int64
	if !txInfo.Blockhash.Equals(util.Uint256{}) {
		header, err := s.rpc.GetBlockHeaderByHashVerbose(txInfo.Blockhash)
		if err == nil {
			blockIndex = int64(header.Index)
		}
	}

	// Process each notification/event
	eventCount := 0
	for _, notif := range exec.Events {
		contractHash := notif.ScriptHash.StringLE()
		eventName := notif.Name

		// Extract event parameters as named map
		state := s.extractEventState(notif.Item, eventName, contractHash)

		s.storeEvent(txHashStr, blockIndex, contractHash, eventName, appID, state)
		eventCount++
	}

	if eventCount > 0 {
		fmt.Printf("   📋 Stored %d events for TX %s\n", eventCount, txHashStr[:16])
	}
}

// extractEventState converts stack items to a named parameter map based on event type
func (s *Simulation) extractEventState(item stackitem.Item, eventName, contractHash string) map[string]interface{} {
	state := make(map[string]interface{})

	arr, ok := item.Value().([]stackitem.Item)
	if !ok || len(arr) == 0 {
		return state
	}

	// Map parameters based on event name (using named parameters from updated contracts)
	switch eventName {
	case "ServiceRequested":
		if len(arr) >= 7 {
			state["requestId"] = itemToValue(arr[0])
			state["appId"] = itemToValue(arr[1])
			state["serviceType"] = itemToValue(arr[2])
			state["requester"] = itemToValue(arr[3])
			state["callbackContract"] = itemToValue(arr[4])
			state["callbackMethod"] = itemToValue(arr[5])
			state["payload"] = itemToValue(arr[6])
		}
	case "ServiceFulfilled":
		if len(arr) >= 4 {
			state["requestId"] = itemToValue(arr[0])
			state["success"] = itemToValue(arr[1])
			state["result"] = itemToValue(arr[2])
			state["error"] = itemToValue(arr[3])
		}
	case "PaymentReceived":
		if len(arr) >= 5 {
			state["paymentId"] = itemToValue(arr[0])
			state["appId"] = itemToValue(arr[1])
			state["sender"] = itemToValue(arr[2])
			state["amount"] = itemToValue(arr[3])
			state["memo"] = itemToValue(arr[4])
		}
	case "RandomnessRecorded":
		if len(arr) >= 4 {
			state["requestId"] = itemToValue(arr[0])
			state["randomness"] = itemToValue(arr[1])
			state["attestationHash"] = itemToValue(arr[2])
			state["timestamp"] = itemToValue(arr[3])
		}
	case "PriceUpdated":
		if len(arr) >= 6 {
			state["symbol"] = itemToValue(arr[0])
			state["roundId"] = itemToValue(arr[1])
			state["price"] = itemToValue(arr[2])
			state["timestamp"] = itemToValue(arr[3])
			state["attestationHash"] = itemToValue(arr[4])
			state["sourceSetId"] = itemToValue(arr[5])
		}
	case "Transfer": // NEP-17 Transfer
		if len(arr) >= 3 {
			state["from"] = itemToValue(arr[0])
			state["to"] = itemToValue(arr[1])
			state["amount"] = itemToValue(arr[2])
		}
	default:
		// Generic: store as arg0, arg1, etc.
		for i, v := range arr {
			state[fmt.Sprintf("arg%d", i)] = itemToValue(v)
		}
	}

	return state
}

// itemToValue converts a stack item to a Go value
func itemToValue(item stackitem.Item) interface{} {
	switch item.Type() {
	case stackitem.IntegerT:
		val, _ := item.TryInteger()
		if val != nil {
			return val.String()
		}
		return "0"
	case stackitem.BooleanT:
		val, _ := item.TryBool()
		return val
	case stackitem.ByteArrayT:
		val, _ := item.TryBytes()
		// Try to decode as address (UInt160)
		if len(val) == 20 {
			return hex.EncodeToString(val)
		}
		// Try as UTF-8 string
		if s := string(val); isPrintable(s) {
			return s
		}
		return hex.EncodeToString(val)
	case stackitem.BufferT:
		val, _ := item.TryBytes()
		return hex.EncodeToString(val)
	default:
		return fmt.Sprintf("%v", item.Value())
	}
}

func isPrintable(s string) bool {
	for _, r := range s {
		if r < 32 || r > 126 {
			return false
		}
	}
	return len(s) > 0
}

// storeServiceRequest stores a service request in Supabase
func (s *Simulation) storeServiceRequest(reqID int64, appID, svcType, requester, reqTx string) {
	payload := map[string]interface{}{
		"request_id":   reqID,
		"app_id":       appID,
		"service_type": svcType,
		"requester":    requester,
		"request_tx":   reqTx,
		"status":       "pending",
	}
	go s.postToSupabase("service_requests", payload)
}

// updateServiceRequest updates a service request status
func (s *Simulation) updateServiceRequest(reqID int64, success bool, fulfillTx string) {
	status := "fulfilled"
	if !success {
		status = "failed"
	}
	payload := map[string]interface{}{
		"status":       status,
		"success":      success,
		"fulfill_tx":   fulfillTx,
		"fulfilled_at": time.Now().Format(time.RFC3339),
	}
	go s.patchToSupabase("service_requests", fmt.Sprintf("request_id=eq.%d", reqID), payload)
}

func (s *Simulation) postToSupabase(table string, payload map[string]interface{}) {
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/rest/v1/%s", s.supabaseURL, table)
	req, _ := http.NewRequest("POST", url, strings.NewReader(string(body)))
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		fmt.Printf("   ⚠️  Supabase %s error %d: %s\n", table, resp.StatusCode, string(respBody)[:100])
	}
}

func (s *Simulation) patchToSupabase(table, filter string, payload map[string]interface{}) {
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/rest/v1/%s?%s", s.supabaseURL, table, filter)
	req, _ := http.NewRequest("PATCH", url, strings.NewReader(string(body)))
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	http.DefaultClient.Do(req)
}

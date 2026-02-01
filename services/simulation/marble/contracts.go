// Package neosimulation provides contract invocation capabilities for the simulation service.
// All contract invocations use pool accounts managed by the neoaccounts service.
// Private keys never leave the TEE - signing happens inside the account pool service.
package neosimulation

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	neoaccountsclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/accountpool/client"
)

// ContractInvoker handles smart contract invocations using pool accounts.
// All signing happens inside the TEE via the account pool service.
type ContractInvoker struct {
	poolClient PoolClientInterface

	// Platform contract addresses (as strings for InvokeContract API)
	priceFeedAddress           string
	randomnessLogAddress       string
	paymentHubAddress          string
	serviceLayerGatewayAddress string

	// MiniApp contract addresses (appID -> contract address)
	miniAppContracts map[string]string

	// Price feed configuration
	priceFeeds map[string]int64 // symbol -> base price (8 decimals)

	// Account management
	mu               sync.RWMutex
	lockedAccounts   map[string]string // purpose -> accountID
	accountAddresses map[string]string // accountID -> address
	accountBalances  map[string]int64  // accountID -> estimated GAS balance

	// Statistics
	priceFeedUpdates  int64
	randomnessRecords int64
	paymentHubPays    int64
	callbackPayouts   int64
	contractErrors    int64

	// Round ID counter for price feeds
	roundID int64
}

// ContractInvokerConfig holds configuration for the contract invoker.
type ContractInvokerConfig struct {
	PoolClient                 PoolClientInterface
	PriceFeedAddress           string
	RandomnessLogAddress       string
	PaymentHubAddress          string
	ServiceLayerGatewayAddress string
	MiniAppContracts           map[string]string // appID -> contract address
}

var (
	ErrPriceFeedNotConfigured     = errors.New("price feed address not configured")
	ErrRandomnessLogNotConfigured = errors.New("randomness log address not configured")
	ErrPaymentHubNotConfigured    = errors.New("payment hub address not configured")
	ErrMiniAppContractNotFound    = errors.New("miniapp contract not found")
)

type ConfigurationError struct {
	Component string
	Setting   string
	Message   string
	wrapErr   error
}

func (e *ConfigurationError) Error() string {
	if e.wrapErr != nil {
		return fmt.Sprintf("%s: %s not configured - %s: %v", e.Component, e.Setting, e.Message, e.wrapErr)
	}
	if e.Component != "" && e.Setting != "" {
		return fmt.Sprintf("%s: %s not configured - %s", e.Component, e.Setting, e.Message)
	}
	return e.Message
}

func (e *ConfigurationError) Unwrap() error {
	return e.wrapErr
}

func NewConfigurationError(component, setting, message string, wrapErr ...error) *ConfigurationError {
	cfgErr := &ConfigurationError{
		Component: component,
		Setting:   setting,
		Message:   message,
	}
	if len(wrapErr) > 0 && wrapErr[0] != nil {
		cfgErr.wrapErr = wrapErr[0]
	}
	return cfgErr
}

// NewContractInvoker creates a new contract invoker using pool accounts.
func NewContractInvoker(cfg ContractInvokerConfig) (*ContractInvoker, error) {
	if cfg.PoolClient == nil {
		return nil, fmt.Errorf("pool client is required")
	}

	// Normalize contract addresses (remove 0x prefix if present)
	priceFeedAddress := strings.TrimPrefix(cfg.PriceFeedAddress, "0x")
	randomnessLogAddress := strings.TrimPrefix(cfg.RandomnessLogAddress, "0x")
	paymentHubAddress := strings.TrimPrefix(cfg.PaymentHubAddress, "0x")
	serviceLayerGatewayAddress := strings.TrimPrefix(cfg.ServiceLayerGatewayAddress, "0x")

	// Normalize MiniApp contract addresses
	miniAppContracts := make(map[string]string)
	for appID, address := range cfg.MiniAppContracts {
		miniAppContracts[appID] = strings.TrimPrefix(address, "0x")
	}

	if paymentHubAddress == "" {
		return nil, fmt.Errorf("payment hub address is required")
	}

	priceFeeds := map[string]int64{
		// Major Cryptocurrencies
		"BTCUSD":   10500000000000, // $105,000
		"ETHUSD":   390000000000,   // $3,900
		"LINKUSD":  1500000000,     // $15
		"ARBUSD":   120000000,      // $1.20
		"SOLUSD":   22000000000,    // $220
		"AVAXUSD":  4500000000,     // $45
		"MATICUSD": 55000000,       // $0.55
		"UNIUSD":   1400000000,     // $14
		"AAVEUSD":  35000000000,    // $350
		"CRVUSD":   80000000,       // $0.80
		"GMXUSD":   4500000000,     // $45
		"LDOUSD":   250000000,      // $2.50
		"MKRUSD":   200000000000,   // $2,000
		"SNXUSD":   350000000,      // $3.50
		"COMPUSD":  8000000000,     // $80
		"YFIUSD":   900000000000,   // $9,000
		"SUSHIUSD": 150000000,      // $1.50
		"BALUSD":   400000000,      // $4.00
		"ONEINCH":  50000000,       // $0.50
		"GRTUSD":   20000000,       // $0.20
		"ENSUSD":   3500000000,     // $35
		"RPLUSD":   2500000000,     // $25
		"OPUSD":    250000000,      // $2.50
		"PEPEUSD":  2000,           // $0.00002
		"WLDUSD":   300000000,      // $3.00
		"INJUSD":   4000000000,     // $40
		"TIAUSD":   1200000000,     // $12
		"STXUSD":   200000000,      // $2.00
		"IMXUSD":   250000000,      // $2.50
		"APTUSD":   1200000000,     // $12
		"SUIUSD":   450000000,      // $4.50
		"SEIUSD":   80000000,       // $0.80
		// Stablecoins
		"USDCUSD": 100000000, // $1.00
		"USDTUSD": 100000000, // $1.00
		"DAIUSD":  100000000, // $1.00
		"FRAXUSD": 100000000, // $1.00
		"LUSD":    100000000, // $1.00
		// Wrapped Assets
		"WBTCUSD": 10500000000000, // $105,000
		"WETHUSD": 390000000000,   // $3,900
		"WSTETH":  450000000000,   // $4,500
		"RETH":    420000000000,   // $4,200
		"CBETH":   410000000000,   // $4,100
		// Forex Pairs
		"EURUSD": 108000000, // $1.08
		"GBPUSD": 127000000, // $1.27
		"JPYUSD": 67000,     // $0.0067
		"AUDUSD": 65000000,  // $0.65
		"CADUSD": 72000000,  // $0.72
		"CHFUSD": 113000000, // $1.13
		// Commodities
		"XAUUSD": 262000000000, // $2,620 (Gold)
		"XAGUSD": 3000000000,   // $30 (Silver)
		// Neo Ecosystem
		"NEOUSD": 1500000000, // $15
		"GASUSD": 700000000,  // $7
	}

	if priceFeedAddress == "" {
		priceFeeds = map[string]int64{}
	}

	return &ContractInvoker{
		poolClient:                 cfg.PoolClient,
		priceFeedAddress:           priceFeedAddress,
		randomnessLogAddress:       randomnessLogAddress,
		paymentHubAddress:          paymentHubAddress,
		serviceLayerGatewayAddress: serviceLayerGatewayAddress,
		miniAppContracts:           miniAppContracts,
		// Chainlink price feeds (via Arbitrum RPC) - all major pairs (8 decimals)
		priceFeeds:       priceFeeds,
		lockedAccounts:   make(map[string]string),
		accountAddresses: make(map[string]string),
		accountBalances:  make(map[string]int64),
		roundID:          time.Now().Unix(),
	}, nil
}

func (inv *ContractInvoker) HasPriceFeed() bool {
	return inv != nil && inv.priceFeedAddress != ""
}

func (inv *ContractInvoker) HasRandomnessLog() bool {
	return inv != nil && inv.randomnessLogAddress != ""
}

func (inv *ContractInvoker) HasPaymentHub() bool {
	return inv != nil && inv.paymentHubAddress != ""
}

// HasMiniAppContract checks if a MiniApp contract is configured.
func (inv *ContractInvoker) HasMiniAppContract(appID string) bool {
	if inv == nil || inv.miniAppContracts == nil {
		return false
	}
	_, ok := inv.miniAppContracts[appID]
	return ok
}

// GetMiniAppContractAddress returns the contract address for a MiniApp.
func (inv *ContractInvoker) GetMiniAppContractAddress(appID string) (string, error) {
	if inv == nil || inv.miniAppContracts == nil {
		return "", NewConfigurationError("ContractInvoker", "MiniAppContracts",
			fmt.Sprintf("miniapp contract map not initialized for appID: %s", appID), ErrMiniAppContractNotFound)
	}
	address, ok := inv.miniAppContracts[appID]
	if !ok {
		return "", NewConfigurationError("ContractInvoker", "MiniAppContract",
			fmt.Sprintf("contract not found for appID: %s. Available contracts: %v", appID, getKeys(inv.miniAppContracts)), ErrMiniAppContractNotFound)
	}
	return address, nil
}

// InvokeMiniAppContract invokes a method on a MiniApp contract.
func (inv *ContractInvoker) InvokeMiniAppContract(ctx context.Context, appID, method string, params []neoaccountsclient.ContractParam) (string, error) {
	contractAddress, err := inv.GetMiniAppContractAddress(appID)
	if err != nil {
		return "", err
	}

	// Get or request a pool account for this MiniApp
	accountID, err := inv.getOrRequestAccount(ctx, "miniapp-"+appID)
	if err != nil {
		atomic.AddInt64(&inv.contractErrors, 1)
		return "", fmt.Errorf("get pool account: %w", err)
	}

	// Invoke the MiniApp contract
	resp, err := inv.poolClient.InvokeContract(ctx, accountID, contractAddress, method, params, "")
	if err != nil {
		atomic.AddInt64(&inv.contractErrors, 1)
		return "", fmt.Errorf("invoke miniapp contract: %w", err)
	}

	if resp.State != "HALT" {
		atomic.AddInt64(&inv.contractErrors, 1)
		return "", fmt.Errorf("miniapp contract execution failed: %s", resp.Exception)
	}

	fmt.Printf("neosimulation: miniapp contract invoked - app=%s, method=%s, tx=%s\n",
		appID, method, resp.TxHash)
	return resp.TxHash, nil
}

// Minimum GAS balance for MiniApp workflows (0.6 GAS = 60000000 in 8 decimals)
// This includes buffer for transaction fees (~0.01 GAS per tx)
const minGASBalanceForWorkflow int64 = 60000000

// Amount to fund when balance is low (1 GAS = 100000000 in 8 decimals)
const fundAmountForWorkflow int64 = 100000000

// Time to wait after funding transaction is confirmed for blockchain state propagation.
// Since FundAccount now waits for on-chain confirmation, we only need a small buffer.
const fundingConfirmationWait = 5 * time.Second

// getOrRequestAccount gets an existing locked account or requests a new one.
// If the account has insufficient GAS balance, it will be funded automatically.
func (inv *ContractInvoker) getOrRequestAccount(ctx context.Context, purpose string) (string, error) {
	inv.mu.Lock()
	defer inv.mu.Unlock()

	// Check if we already have an account for this purpose
	if accountID, ok := inv.lockedAccounts[purpose]; ok {
		// Check if existing account needs funding
		if balance, hasBalance := inv.accountBalances[accountID]; hasBalance && balance < minGASBalanceForWorkflow {
			if addr, hasAddr := inv.accountAddresses[accountID]; hasAddr {
				fmt.Printf("neosimulation: funding existing account %s (balance: %d) for purpose %s\n", accountID, balance, purpose)
				_, err := inv.poolClient.FundAccount(ctx, addr, fundAmountForWorkflow)
				if err == nil {
					inv.accountBalances[accountID] = balance + fundAmountForWorkflow
					// Wait for funding transaction to be confirmed on blockchain
					fmt.Printf("neosimulation: waiting %v for funding confirmation...\n", fundingConfirmationWait)
					time.Sleep(fundingConfirmationWait)
				} else {
					fmt.Printf("neosimulation: warning: failed to fund existing account %s: %v\n", accountID, err)
				}
			}
		}
		return accountID, nil
	}

	// Request a new account from the pool
	resp, err := inv.poolClient.RequestAccounts(ctx, 1, purpose)
	if err != nil {
		return "", fmt.Errorf("request account: %w", err)
	}

	if len(resp.Accounts) == 0 {
		return "", fmt.Errorf("no accounts available in pool")
	}

	account := resp.Accounts[0]
	inv.lockedAccounts[purpose] = account.ID
	inv.accountAddresses[account.ID] = account.Address

	// Track initial balance if available
	var gasBalance int64
	if gb, ok := account.Balances["GAS"]; ok {
		gasBalance = gb.Amount
	}
	inv.accountBalances[account.ID] = gasBalance

	fmt.Printf("neosimulation: requested new account %s (address: %s, balance: %d) for purpose %s\n",
		account.ID, account.Address, gasBalance, purpose)

	// Fund the account if it has insufficient GAS for MiniApp workflows
	if gasBalance < minGASBalanceForWorkflow {
		fmt.Printf("neosimulation: funding new account %s with %d GAS\n", account.ID, fundAmountForWorkflow)
		fundResp, err := inv.poolClient.FundAccount(ctx, account.Address, fundAmountForWorkflow)
		if err != nil {
			// Log warning but don't fail - the account might still work for some operations
			fmt.Printf("neosimulation: warning: failed to fund account %s: %v\n", account.ID, err)
		} else {
			inv.accountBalances[account.ID] = gasBalance + fundAmountForWorkflow
			fmt.Printf("neosimulation: funding tx submitted: %s\n", fundResp.TxHash)
			// Wait for funding transaction to be confirmed on blockchain
			fmt.Printf("neosimulation: waiting %v for funding confirmation...\n", fundingConfirmationWait)
			time.Sleep(fundingConfirmationWait)
			fmt.Printf("neosimulation: account %s funded and ready\n", account.ID)
		}
	}

	return account.ID, nil
}

// UpdatePriceFeed updates a price feed with simulated data using the master wallet.
// PriceFeed requires the caller to be a registered TEE signer in AppRegistry.
func (inv *ContractInvoker) UpdatePriceFeed(ctx context.Context, symbol string) (string, error) {
	if inv.priceFeedAddress == "" {
		return "", NewConfigurationError("ContractInvoker", "PriceFeedAddress",
			"price feed address must be configured via CONTRACT_PRICE_FEED_ADDRESS env var", ErrPriceFeedNotConfigured)
	}
	basePrice, ok := inv.priceFeeds[symbol]
	if !ok {
		return "", fmt.Errorf("unknown symbol: %s", symbol)
	}

	// Generate price with 2% variance
	price := generatePrice(basePrice, 2)
	ts := time.Now().UnixMilli()
	if ts < 0 {
		ts = 0
	}
	timestamp := uint64(ts) // #nosec G115 -- ts is clamped to non-negative
	attestationHash := generateRandomBytes()
	sourceSetID := int64(1)

	// Increment round ID atomically
	roundID := atomic.AddInt64(&inv.roundID, 1)

	// Invoke contract via pool client using master wallet (TEE signer)
	// PriceFeed requires the caller to be registered in AppRegistry
	resp, err := inv.poolClient.InvokeMaster(ctx, inv.priceFeedAddress, "update", []neoaccountsclient.ContractParam{
		{Type: "String", Value: symbol},
		{Type: "Integer", Value: roundID},
		{Type: "Integer", Value: price},
		{Type: "Integer", Value: timestamp},
		{Type: "ByteArray", Value: hex.EncodeToString(attestationHash)},
		{Type: "Integer", Value: sourceSetID},
	}, "") // Empty string = CalledByEntry (default)
	if err != nil {
		atomic.AddInt64(&inv.contractErrors, 1)
		return "", fmt.Errorf("invoke contract: %w", err)
	}

	if resp.State != "HALT" {
		atomic.AddInt64(&inv.contractErrors, 1)
		return "", fmt.Errorf("contract execution failed: %s", resp.Exception)
	}

	atomic.AddInt64(&inv.priceFeedUpdates, 1)
	return resp.TxHash, nil
}

// RecordRandomness records a randomness value on-chain using the master wallet.
// RandomnessLog requires the caller to be a registered TEE signer in AppRegistry.
func (inv *ContractInvoker) RecordRandomness(ctx context.Context) (string, error) {
	if inv.randomnessLogAddress == "" {
		return "", NewConfigurationError("ContractInvoker", "RandomnessLogAddress",
			"randomness log address must be configured via CONTRACT_RANDOMNESS_LOG_ADDRESS env var", ErrRandomnessLogNotConfigured)
	}
	requestID := generateRequestID()
	randomness := generateRandomBytes()
	attestationHash := generateRandomBytes()
	ts := time.Now().UnixMilli()
	if ts < 0 {
		ts = 0
	}
	timestamp := uint64(ts) // #nosec G115 -- ts is clamped to non-negative

	// Invoke contract via pool client using master wallet (TEE signer)
	// RandomnessLog requires the caller to be registered in AppRegistry
	resp, err := inv.poolClient.InvokeMaster(ctx, inv.randomnessLogAddress, "record", []neoaccountsclient.ContractParam{
		{Type: "String", Value: requestID},
		{Type: "ByteArray", Value: hex.EncodeToString(randomness)},
		{Type: "ByteArray", Value: hex.EncodeToString(attestationHash)},
		{Type: "Integer", Value: timestamp},
	}, "") // Empty string = CalledByEntry (default)
	if err != nil {
		atomic.AddInt64(&inv.contractErrors, 1)
		return "", fmt.Errorf("invoke contract: %w", err)
	}

	if resp.State != "HALT" {
		atomic.AddInt64(&inv.contractErrors, 1)
		return "", fmt.Errorf("contract execution failed: %s", resp.Exception)
	}

	atomic.AddInt64(&inv.randomnessRecords, 1)
	return resp.TxHash, nil
}

// PayToApp makes a payment to a MiniApp via direct GAS.Transfer with data.
// This simulates real user behavior where users pay from their own wallets.
// The pool account must have sufficient GAS for the payment + transaction fees.
//
// Payment Flow (Direct GAS.Transfer with data):
// 1. Pool account calls TransferWithData which uses neo-go SDK's actor pattern
// 2. GAS contract transfers GAS to PaymentHub with appId as data
// 3. PaymentHub.OnNEP17Payment callback is triggered
// 4. PaymentHub validates appId and updates balance
// 5. Receipt is created and PaymentReceived event is emitted
func (inv *ContractInvoker) PayToApp(ctx context.Context, appID string, amount int64, memo string) (string, error) {
	if inv.paymentHubAddress == "" {
		return "", NewConfigurationError("ContractInvoker", "PaymentHubAddress",
			"payment hub address must be configured via CONTRACT_PAYMENT_HUB_ADDRESS env var", ErrPaymentHubNotConfigured)
	}
	// Get or request a pool account for this payment
	accountID, err := inv.getOrRequestAccount(ctx, "payment-"+appID)
	if err != nil {
		atomic.AddInt64(&inv.contractErrors, 1)
		return "", fmt.Errorf("get pool account: %w", err)
	}

	// Use TransferWithData which uses neo-go SDK's actor pattern
	// This correctly handles the GAS.Transfer parameters and avoids CONVERT errors
	// The data parameter (appId) is passed to OnNEP17Payment callback
	resp, err := inv.poolClient.TransferWithData(ctx, accountID, "0x"+inv.paymentHubAddress, amount, appID)
	if err != nil {
		atomic.AddInt64(&inv.contractErrors, 1)
		// Reset balance to 0 on failure to trigger re-funding on next attempt
		// This handles cases where chain balance is depleted but memory balance is stale
		inv.mu.Lock()
		inv.accountBalances[accountID] = 0
		inv.mu.Unlock()
		return "", fmt.Errorf("transfer GAS to PaymentHub: %w", err)
	}

	// Update estimated balance (deduct payment amount)
	inv.mu.Lock()
	if balance, ok := inv.accountBalances[accountID]; ok {
		inv.accountBalances[accountID] = balance - amount
	}
	inv.mu.Unlock()

	atomic.AddInt64(&inv.paymentHubPays, 1)
	return resp.TxHash, nil
}

// PayoutToUser sends a callback payout from a MiniApp's pool account to a user address.
// This simulates the platform paying out winnings to users who won games.
// The pool account must have sufficient GAS for the payout + transaction fees.
func (inv *ContractInvoker) PayoutToUser(ctx context.Context, appID string, userAddress string, amount int64, memo string) (string, error) {
	// Get or request a pool account for this MiniApp's payouts
	accountID, err := inv.getOrRequestAccount(ctx, "payout-"+appID)
	if err != nil {
		atomic.AddInt64(&inv.contractErrors, 1)
		return "", fmt.Errorf("get pool account for payout: %w", err)
	}

	// Transfer GAS from pool account to user address
	// Empty token address means GAS (native token)
	resp, err := inv.poolClient.Transfer(ctx, accountID, userAddress, amount, "")
	if err != nil {
		atomic.AddInt64(&inv.contractErrors, 1)
		// Reset balance to 0 on failure to trigger re-funding on next attempt
		inv.mu.Lock()
		inv.accountBalances[accountID] = 0
		inv.mu.Unlock()
		return "", fmt.Errorf("transfer payout: %w", err)
	}

	// Update estimated balance
	inv.mu.Lock()
	if balance, ok := inv.accountBalances[accountID]; ok {
		inv.accountBalances[accountID] = balance - amount
	}
	inv.mu.Unlock()

	atomic.AddInt64(&inv.callbackPayouts, 1)
	fmt.Printf("neosimulation: callback payout sent - app=%s, to=%s, amount=%d, tx=%s, memo=%s\n",
		appID, userAddress, amount, resp.TxHash, memo)
	return resp.TxHash, nil
}

// GetStats returns contract invocation statistics.
func (inv *ContractInvoker) GetStats() map[string]interface{} {
	inv.mu.RLock()
	lockedCount := len(inv.lockedAccounts)
	inv.mu.RUnlock()

	return map[string]interface{}{
		"price_feed_updates": atomic.LoadInt64(&inv.priceFeedUpdates),
		"randomness_records": atomic.LoadInt64(&inv.randomnessRecords),
		"payment_hub_pays":   atomic.LoadInt64(&inv.paymentHubPays),
		"callback_payouts":   atomic.LoadInt64(&inv.callbackPayouts),
		"contract_errors":    atomic.LoadInt64(&inv.contractErrors),
		"locked_accounts":    lockedCount,
	}
}

// GetPriceSymbols returns the list of price feed symbols.
func (inv *ContractInvoker) GetPriceSymbols() []string {
	if inv.priceFeedAddress == "" {
		return nil
	}
	symbols := make([]string, 0, len(inv.priceFeeds))
	for symbol := range inv.priceFeeds {
		symbols = append(symbols, symbol)
	}
	return symbols
}

// GetLockedAccountCount returns the number of currently locked accounts.
func (inv *ContractInvoker) GetLockedAccountCount() int {
	inv.mu.RLock()
	defer inv.mu.RUnlock()
	return len(inv.lockedAccounts)
}

// ReleaseAllAccounts releases all locked accounts back to the pool.
func (inv *ContractInvoker) ReleaseAllAccounts(ctx context.Context) {
	inv.mu.Lock()
	accountIDs := make([]string, 0, len(inv.lockedAccounts))
	for _, accountID := range inv.lockedAccounts {
		accountIDs = append(accountIDs, accountID)
	}
	inv.lockedAccounts = make(map[string]string)
	inv.accountAddresses = make(map[string]string)
	inv.accountBalances = make(map[string]int64)
	inv.mu.Unlock()

	if len(accountIDs) > 0 {
		if _, err := inv.poolClient.ReleaseAccounts(ctx, accountIDs); err != nil {
			fmt.Printf("neosimulation: warning: failed to release accounts: %v\n", err)
		}
	}
}

// Close releases all accounts and cleans up resources.
func (inv *ContractInvoker) Close() {
	inv.ReleaseAllAccounts(context.Background())
}

func generatePrice(basePrice int64, variancePercent int) int64 {
	variance := basePrice * int64(variancePercent) / 100
	n, err := rand.Int(rand.Reader, big.NewInt(variance*2))
	if err != nil {
		return basePrice
	}
	return basePrice - variance + n.Int64()
}

const randomBytesLength = 32

func generateRandomBytes() []byte {
	b := make([]byte, randomBytesLength)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp-based pseudo-randomness on error
		for i := range b {
			b[i] = byte(time.Now().UnixNano() + int64(i))
		}
	}
	return b
}

func generateRequestID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp-based pseudo-randomness on error
		for i := range b {
			b[i] = byte(time.Now().UnixNano() + int64(i))
		}
	}
	return hex.EncodeToString(b)
}

// NewContractInvokerFromEnv creates a contract invoker from environment variables.
// This is a convenience function for creating the invoker with standard configuration.
func NewContractInvokerFromEnv(poolClient *neoaccountsclient.Client) (*ContractInvoker, error) {
	priceFeedAddress := strings.TrimSpace(os.Getenv("CONTRACT_PRICE_FEED_ADDRESS"))
	randomnessLogAddress := strings.TrimSpace(os.Getenv("CONTRACT_RANDOMNESS_LOG_ADDRESS"))
	paymentHubAddress := strings.TrimSpace(os.Getenv("CONTRACT_PAYMENT_HUB_ADDRESS"))
	serviceLayerGatewayAddress := strings.TrimSpace(os.Getenv("CONTRACT_SERVICE_GATEWAY_ADDRESS"))

	if paymentHubAddress == "" {
		return nil, fmt.Errorf("contract addresses not configured (missing CONTRACT_PAYMENT_HUB_ADDRESS)")
	}

	// Load MiniApp contract addresses from environment variables
	miniAppContracts := loadMiniAppContractsFromEnv()

	return NewContractInvoker(ContractInvokerConfig{
		PoolClient:                 poolClient,
		PriceFeedAddress:           priceFeedAddress,
		RandomnessLogAddress:       randomnessLogAddress,
		PaymentHubAddress:          paymentHubAddress,
		ServiceLayerGatewayAddress: serviceLayerGatewayAddress,
		MiniAppContracts:           miniAppContracts,
	})
}

// loadMiniAppContractsFromEnv loads MiniApp contract addresses from environment variables.
// Environment variable format: CONTRACT_MINIAPP_<APPID>_ADDRESS
// Example: CONTRACT_MINIAPP_LOTTERY_ADDRESS=0x3e330b4c396b40aa08d49912c0179319831b3a6e
func loadMiniAppContractsFromEnv() map[string]string {
	contracts := make(map[string]string)

	// Define mapping from env var suffix to app ID
	miniAppEnvMapping := map[string]string{
		"LOTTERY":        "miniapp-lottery",
		"COINFLIP":       "miniapp-coinflip",
		"DICEGAME":       "miniapp-dice-game",
		"SCRATCHCARD":    "miniapp-scratch-card",
		"FLASHLOAN":      "miniapp-flashloan",
		"REDENVELOPE":    "miniapp-red-envelope",
		"GASCIRCLE":      "miniapp-gas-circle",
		"GOVBOOSTER":     "miniapp-govbooster",
		"GUARDIANPOLICY": "miniapp-guardianpolicy",
		"NEOCRASH":       "miniapp-neo-crash",
		"TIMECAPSULE":    "miniapp-time-capsule",
		"GARDENOFNEO":    "miniapp-garden-of-neo",
		"DEVTIPPING":     "miniapp-dev-tipping",
		"DAILYCHECKIN":   "miniapp-dailycheckin",
	}

	for envSuffix, appID := range miniAppEnvMapping {
		envVar := "CONTRACT_MINIAPP_" + envSuffix + "_ADDRESS"
		address := strings.TrimSpace(os.Getenv(envVar))
		if address != "" {
			contracts[appID] = address
		}
	}

	// Log summary of loaded contracts
	if len(contracts) > 0 {
		fmt.Printf("neosimulation: loaded %d MiniApp contract addresses from environment\n", len(contracts))
		for appID, address := range contracts {
			fmt.Printf("  - %s: %s\n", appID, address[:min(20, len(address))]+"...")
		}
	}

	return contracts
}

func getKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

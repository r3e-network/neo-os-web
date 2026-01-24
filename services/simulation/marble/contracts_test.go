// Package neosimulation provides simulation service for automated transaction testing.
package neosimulation

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	neoaccountsclient "github.com/R3E-Network/service_layer/infrastructure/accountpool/client"
)

// =============================================================================
// NewContractInvoker Tests
// =============================================================================

func TestNewContractInvoker_Success(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xabc123",
		RandomnessLogAddress: "0xdef456",
		PaymentHubAddress:    "0x789ghi",
	})

	require.NoError(t, err)
	assert.NotNil(t, inv)
	assert.Equal(t, "abc123", inv.priceFeedAddress)
	assert.Equal(t, "def456", inv.randomnessLogAddress)
	assert.Equal(t, "789ghi", inv.paymentHubAddress)
}

func TestNewContractInvoker_NilPoolClient(t *testing.T) {
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        nil,
		PriceFeedAddress:     "0xabc123",
		RandomnessLogAddress: "0xdef456",
		PaymentHubAddress:    "0x789ghi",
	})

	assert.Error(t, err)
	assert.Nil(t, inv)
	assert.Contains(t, err.Error(), "pool client is required")
}

func TestNewContractInvoker_MissingContractAddresses(t *testing.T) {
	mockClient := newMockPoolClient()

	tests := []struct {
		name              string
		priceFeedAddress     string
		randomnessLogAddress string
		paymentHubAddress    string
		expectErr         bool
	}{
		{"missing price feed", "", "0xdef456", "0x789ghi", false},
		{"missing randomness log", "0xabc123", "", "0x789ghi", false},
		{"missing payment hub", "0xabc123", "0xdef456", "", true},
		{"all missing", "", "", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv, err := NewContractInvoker(ContractInvokerConfig{
				PoolClient:        mockClient,
				PriceFeedAddress:     tt.priceFeedAddress,
				RandomnessLogAddress: tt.randomnessLogAddress,
				PaymentHubAddress:    tt.paymentHubAddress,
			})

			if tt.expectErr {
				assert.Error(t, err)
				assert.Nil(t, inv)
				assert.Contains(t, err.Error(), "payment hub address is required")
				return
			}

			assert.NoError(t, err)
			assert.NotNil(t, inv)
		})
	}
}

func TestNewContractInvoker_NormalizesAddresses(t *testing.T) {
	mockClient := newMockPoolClient()

	// Test with 0x prefix
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xabc123",
		RandomnessLogAddress: "0xdef456",
		PaymentHubAddress:    "0x789ghi",
	})

	require.NoError(t, err)
	assert.Equal(t, "abc123", inv.priceFeedAddress)
	assert.Equal(t, "def456", inv.randomnessLogAddress)
	assert.Equal(t, "789ghi", inv.paymentHubAddress)

	// Test without 0x prefix
	inv2, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "abc123",
		RandomnessLogAddress: "def456",
		PaymentHubAddress:    "789ghi",
	})

	require.NoError(t, err)
	assert.Equal(t, "abc123", inv2.priceFeedAddress)
}

// =============================================================================
// UpdatePriceFeed Tests (uses InvokeMaster - master account)
// =============================================================================

func TestContractInvoker_UpdatePriceFeed_Success(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	txHash, err := inv.UpdatePriceFeed(ctx, "BTCUSD")

	require.NoError(t, err)
	assert.Equal(t, "0xtest-tx-hash-invoke-master", txHash)

	// Verify InvokeMaster was called (not InvokeContract)
	calls := mockClient.getInvokeMasterCalls()
	require.Len(t, calls, 1)
	assert.Equal(t, "pricefeed", calls[0].ContractAddress)
	assert.Equal(t, "update", calls[0].Method)
	assert.Equal(t, "", calls[0].Scope) // CalledByEntry (default)

	// Verify no pool account was requested
	assert.Empty(t, mockClient.getRequestAccountsCalls())

	// Verify stats updated
	stats := inv.GetStats()
	assert.Equal(t, int64(1), stats["price_feed_updates"])
}

func TestContractInvoker_UpdatePriceFeed_MissingHash(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	_, err = inv.UpdatePriceFeed(ctx, "BTCUSD")

	assert.ErrorIs(t, err, ErrPriceFeedNotConfigured)
}

func TestContractInvoker_UpdatePriceFeed_UnknownSymbol(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	txHash, err := inv.UpdatePriceFeed(ctx, "UNKNOWN")

	assert.Error(t, err)
	assert.Empty(t, txHash)
	assert.Contains(t, err.Error(), "unknown symbol")
}

func TestContractInvoker_UpdatePriceFeed_InvokeError(t *testing.T) {
	mockClient := newMockPoolClient()
	mockClient.invokeMasterErr = errors.New("network error")

	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	txHash, err := inv.UpdatePriceFeed(ctx, "BTCUSD")

	assert.Error(t, err)
	assert.Empty(t, txHash)

	// Verify error counter incremented
	stats := inv.GetStats()
	assert.Equal(t, int64(1), stats["contract_errors"])
}

func TestContractInvoker_UpdatePriceFeed_ContractFault(t *testing.T) {
	mockClient := newMockPoolClient()
	mockClient.invokeMasterResp = &neoaccountsclient.InvokeContractResponse{
		TxHash:    "",
		State:     "FAULT",
		Exception: "contract execution failed",
	}

	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	txHash, err := inv.UpdatePriceFeed(ctx, "BTCUSD")

	assert.Error(t, err)
	assert.Empty(t, txHash)
	assert.Contains(t, err.Error(), "contract execution failed")
}

// =============================================================================
// RecordRandomness Tests (uses InvokeMaster - master account)
// =============================================================================

func TestContractInvoker_RecordRandomness_Success(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	txHash, err := inv.RecordRandomness(ctx)

	require.NoError(t, err)
	assert.Equal(t, "0xtest-tx-hash-invoke-master", txHash)

	// Verify InvokeMaster was called (not InvokeContract)
	calls := mockClient.getInvokeMasterCalls()
	require.Len(t, calls, 1)
	assert.Equal(t, "randomness", calls[0].ContractAddress)
	assert.Equal(t, "record", calls[0].Method)
	assert.Equal(t, "", calls[0].Scope) // CalledByEntry (default)

	// Verify no pool account was requested
	assert.Empty(t, mockClient.getRequestAccountsCalls())

	// Verify stats updated
	stats := inv.GetStats()
	assert.Equal(t, int64(1), stats["randomness_records"])
}

func TestContractInvoker_RecordRandomness_MissingHash(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	_, err = inv.RecordRandomness(ctx)

	assert.ErrorIs(t, err, ErrRandomnessLogNotConfigured)
}

func TestContractInvoker_RecordRandomness_InvokeError(t *testing.T) {
	mockClient := newMockPoolClient()
	mockClient.invokeMasterErr = errors.New("network error")

	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	txHash, err := inv.RecordRandomness(ctx)

	assert.Error(t, err)
	assert.Empty(t, txHash)

	// Verify error counter incremented
	stats := inv.GetStats()
	assert.Equal(t, int64(1), stats["contract_errors"])
}

// =============================================================================
// PayToApp Tests (uses TransferWithData)
// =============================================================================

func TestContractInvoker_PayToApp_Success(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	txHash, err := inv.PayToApp(ctx, "miniapp-lottery", 1000000, "test-memo")

	require.NoError(t, err)
	assert.Equal(t, "0xtest-tx-hash-transfer-with-data", txHash)

	// Verify pool account was requested
	reqCalls := mockClient.getRequestAccountsCalls()
	require.Len(t, reqCalls, 1)
	assert.Equal(t, 1, reqCalls[0].Count)
	assert.Equal(t, "payment-miniapp-lottery", reqCalls[0].Purpose)

	// Verify TransferWithData was called (direct GAS transfer with appId data)
	transferCalls := mockClient.getTransferWithDataCalls()
	require.Len(t, transferCalls, 1)
	assert.Equal(t, "test-account-1", transferCalls[0].AccountID)
	assert.Equal(t, "0xpaymenthub", transferCalls[0].ToAddress)
	assert.Equal(t, int64(1000000), transferCalls[0].Amount)
	assert.Equal(t, "miniapp-lottery", transferCalls[0].Data)

	// Verify stats updated
	stats := inv.GetStats()
	assert.Equal(t, int64(1), stats["payment_hub_pays"])
}

func TestContractInvoker_PayToApp_ReusesAccount(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()

	// First call - should request account
	_, err = inv.PayToApp(ctx, "miniapp-lottery", 1000000, "memo1")
	require.NoError(t, err)

	// Second call - should reuse account
	_, err = inv.PayToApp(ctx, "miniapp-lottery", 2000000, "memo2")
	require.NoError(t, err)

	// Verify only one account was requested
	reqCalls := mockClient.getRequestAccountsCalls()
	assert.Len(t, reqCalls, 1)

	// Verify two transfers were made
	transferCalls := mockClient.getTransferWithDataCalls()
	assert.Len(t, transferCalls, 2)
}

func TestContractInvoker_PayToApp_DifferentAppsGetDifferentAccounts(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()

	// Call for lottery
	_, err = inv.PayToApp(ctx, "miniapp-lottery", 1000000, "memo1")
	require.NoError(t, err)

	// Call for coin-flip
	_, err = inv.PayToApp(ctx, "miniapp-coinflip", 2000000, "memo2")
	require.NoError(t, err)

	// Verify two accounts were requested (one per app)
	reqCalls := mockClient.getRequestAccountsCalls()
	assert.Len(t, reqCalls, 2)
	assert.Equal(t, "payment-miniapp-lottery", reqCalls[0].Purpose)
	assert.Equal(t, "payment-miniapp-coinflip", reqCalls[1].Purpose)
}

func TestContractInvoker_PayToApp_RequestAccountError(t *testing.T) {
	mockClient := newMockPoolClient()
	mockClient.requestAccountsErr = errors.New("no accounts available")

	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	txHash, err := inv.PayToApp(ctx, "miniapp-lottery", 1000000, "memo")

	assert.Error(t, err)
	assert.Empty(t, txHash)

	// Verify error counter incremented
	stats := inv.GetStats()
	assert.Equal(t, int64(1), stats["contract_errors"])
}

func TestContractInvoker_PayToApp_EmptyAccountsResponse(t *testing.T) {
	mockClient := newMockPoolClient()
	mockClient.requestAccountsResp = &neoaccountsclient.RequestAccountsResponse{
		Accounts: []neoaccountsclient.AccountInfo{},
	}

	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	txHash, err := inv.PayToApp(ctx, "miniapp-lottery", 1000000, "memo")

	assert.Error(t, err)
	assert.Empty(t, txHash)
	assert.Contains(t, err.Error(), "no accounts available")
}

func TestContractInvoker_PayToApp_InvokeError(t *testing.T) {
	mockClient := newMockPoolClient()
	mockClient.transferWithDataErr = errors.New("transfer failed")

	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	txHash, err := inv.PayToApp(ctx, "miniapp-lottery", 1000000, "memo")

	assert.Error(t, err)
	assert.Empty(t, txHash)

	stats := inv.GetStats()
	assert.Equal(t, int64(1), stats["contract_errors"])
}

// =============================================================================
// Account Management Tests
// =============================================================================

func TestContractInvoker_GetLockedAccountCount(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	// Initially no locked accounts
	assert.Equal(t, 0, inv.GetLockedAccountCount())

	// Lock an account via PayToApp
	ctx := context.Background()
	_, _ = inv.PayToApp(ctx, "app1", 1000, "memo")

	assert.Equal(t, 1, inv.GetLockedAccountCount())

	// Lock another account
	_, _ = inv.PayToApp(ctx, "app2", 1000, "memo")

	assert.Equal(t, 2, inv.GetLockedAccountCount())
}

func TestContractInvoker_ReleaseAllAccounts(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()

	// Lock some accounts
	_, _ = inv.PayToApp(ctx, "app1", 1000, "memo")
	_, _ = inv.PayToApp(ctx, "app2", 1000, "memo")

	assert.Equal(t, 2, inv.GetLockedAccountCount())

	// Release all
	inv.ReleaseAllAccounts(ctx)

	assert.Equal(t, 0, inv.GetLockedAccountCount())

	// Verify ReleaseAccounts was called
	relCalls := mockClient.getReleaseAccountsCalls()
	assert.Len(t, relCalls, 1)
}

func TestContractInvoker_Close(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()
	_, _ = inv.PayToApp(ctx, "app1", 1000, "memo")

	inv.Close()

	assert.Equal(t, 0, inv.GetLockedAccountCount())
}

// =============================================================================
// GetStats Tests
// =============================================================================

func TestContractInvoker_GetStats(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	ctx := context.Background()

	// Perform some operations
	_, _ = inv.UpdatePriceFeed(ctx, "BTCUSD")
	_, _ = inv.UpdatePriceFeed(ctx, "ETHUSD")
	_, _ = inv.RecordRandomness(ctx)
	_, _ = inv.PayToApp(ctx, "app1", 1000, "memo")

	stats := inv.GetStats()

	assert.Equal(t, int64(2), stats["price_feed_updates"])
	assert.Equal(t, int64(1), stats["randomness_records"])
	assert.Equal(t, int64(1), stats["payment_hub_pays"])
	assert.Equal(t, int64(0), stats["contract_errors"])
	assert.Equal(t, 1, stats["locked_accounts"])
}

// =============================================================================
// GetPriceSymbols Tests
// =============================================================================

func TestContractInvoker_GetPriceSymbols(t *testing.T) {
	mockClient := newMockPoolClient()
	inv, err := NewContractInvoker(ContractInvokerConfig{
		PoolClient:        mockClient,
		PriceFeedAddress:     "0xpricefeed",
		RandomnessLogAddress: "0xrandomness",
		PaymentHubAddress:    "0xpaymenthub",
	})
	require.NoError(t, err)

	symbols := inv.GetPriceSymbols()

	// We have 52 Chainlink Arbitrum price feeds
	assert.Len(t, symbols, 52)
	// Verify some key symbols are present
	assert.Contains(t, symbols, "BTCUSD")
	assert.Contains(t, symbols, "ETHUSD")
	assert.Contains(t, symbols, "NEOUSD")
	assert.Contains(t, symbols, "GASUSD")
}

// =============================================================================
// Helper Function Tests
// =============================================================================

func TestGeneratePrice(t *testing.T) {
	basePrice := int64(100000000) // $1.00 with 8 decimals
	variancePercent := 2

	// Generate multiple prices and verify they're within range
	for i := 0; i < 100; i++ {
		price := generatePrice(basePrice, variancePercent)
		minPrice := basePrice - (basePrice * int64(variancePercent) / 100)
		maxPrice := basePrice + (basePrice * int64(variancePercent) / 100)

		assert.GreaterOrEqual(t, price, minPrice)
		assert.LessOrEqual(t, price, maxPrice)
	}
}

func TestGenerateRandomBytes(t *testing.T) {
	bytes1 := generateRandomBytes(32)
	bytes2 := generateRandomBytes(32)

	assert.Len(t, bytes1, 32)
	assert.Len(t, bytes2, 32)
	assert.NotEqual(t, bytes1, bytes2) // Should be different (extremely unlikely to be same)
}

func TestGenerateRequestID(t *testing.T) {
	id1 := generateRequestID()
	id2 := generateRequestID()

	assert.Len(t, id1, 32) // 16 bytes = 32 hex chars
	assert.Len(t, id2, 32)
	assert.NotEqual(t, id1, id2)
}

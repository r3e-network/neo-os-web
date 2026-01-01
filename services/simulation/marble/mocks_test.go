// Package neosimulation provides simulation service for automated transaction testing.
package neosimulation

import (
	"context"
	"fmt"
	"sync"
	"time"

	neoaccountsclient "github.com/R3E-Network/service_layer/infrastructure/accountpool/client"
)

// =============================================================================
// Mock Pool Client
// =============================================================================

// mockPoolClient implements a mock version of the account pool client for testing.
type mockPoolClient struct {
	mu sync.Mutex

	// Configurable responses
	requestAccountsResp *neoaccountsclient.RequestAccountsResponse
	requestAccountsErr  error

	releaseAccountsResp *neoaccountsclient.ReleaseAccountsResponse
	releaseAccountsErr  error

	invokeContractResp *neoaccountsclient.InvokeContractResponse
	invokeContractErr  error

	invokeMasterResp *neoaccountsclient.InvokeContractResponse
	invokeMasterErr  error

	fundAccountResp *neoaccountsclient.FundAccountResponse
	fundAccountErr  error

	transferResp *neoaccountsclient.TransferResponse
	transferErr  error

	transferWithDataResp *neoaccountsclient.TransferWithDataResponse
	transferWithDataErr  error

	// Call tracking
	requestAccountsCalls  []requestAccountsCall
	releaseAccountsCalls  []releaseAccountsCall
	invokeContractCalls   []invokeContractCall
	invokeMasterCalls     []invokeMasterCall
	fundAccountCalls      []fundAccountCall
	transferCalls         []transferCall
	transferWithDataCalls []transferWithDataCall
}

type requestAccountsCall struct {
	Count   int
	Purpose string
}

type releaseAccountsCall struct {
	AccountIDs []string
}

type invokeContractCall struct {
	AccountID    string
	ContractHash string
	Method       string
	Params       []neoaccountsclient.ContractParam
	Scope        string
}

type invokeMasterCall struct {
	ContractHash string
	Method       string
	Params       []neoaccountsclient.ContractParam
	Scope        string
}

type fundAccountCall struct {
	ToAddress string
	Amount    int64
}

type transferCall struct {
	AccountID string
	ToAddress string
	Amount    int64
	TokenHash string
}

type transferWithDataCall struct {
	AccountID string
	ToAddress string
	Amount    int64
	Data      string
}

func newMockPoolClient() *mockPoolClient {
	return &mockPoolClient{
		requestAccountsResp: &neoaccountsclient.RequestAccountsResponse{
			Accounts: []neoaccountsclient.AccountInfo{
				{
					ID:      "test-account-1",
					Address: "NTestAddress1234567890123456789012",
					Balances: map[string]neoaccountsclient.TokenBalance{
						"GAS": {Amount: 1000000000}, // 10 GAS
					},
				},
			},
			LockID: "test-lock-1",
		},
		releaseAccountsResp: &neoaccountsclient.ReleaseAccountsResponse{
			ReleasedCount: 1,
		},
		invokeContractResp: &neoaccountsclient.InvokeContractResponse{
			TxHash:      "0xtest-tx-hash-invoke-contract",
			State:       "HALT",
			GasConsumed: "1000000",
			AccountID:   "test-account-1",
		},
		invokeMasterResp: &neoaccountsclient.InvokeContractResponse{
			TxHash:      "0xtest-tx-hash-invoke-master",
			State:       "HALT",
			GasConsumed: "500000",
			AccountID:   "master",
		},
		fundAccountResp: &neoaccountsclient.FundAccountResponse{
			TxHash:      "0xtest-tx-hash-fund",
			FromAddress: "NMasterAddress",
			ToAddress:   "NTestAddress",
			Amount:      1000000000,
		},
		transferResp: &neoaccountsclient.TransferResponse{
			TxHash: "0xtest-tx-hash-transfer",
		},
		transferWithDataResp: &neoaccountsclient.TransferWithDataResponse{
			TxHash: "0xtest-tx-hash-transfer-with-data",
		},
	}
}

func (m *mockPoolClient) RequestAccounts(ctx context.Context, count int, purpose string) (*neoaccountsclient.RequestAccountsResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.requestAccountsCalls = append(m.requestAccountsCalls, requestAccountsCall{Count: count, Purpose: purpose})
	return m.requestAccountsResp, m.requestAccountsErr
}

func (m *mockPoolClient) ReleaseAccounts(ctx context.Context, accountIDs []string) (*neoaccountsclient.ReleaseAccountsResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.releaseAccountsCalls = append(m.releaseAccountsCalls, releaseAccountsCall{AccountIDs: accountIDs})
	return m.releaseAccountsResp, m.releaseAccountsErr
}

func (m *mockPoolClient) InvokeContract(ctx context.Context, accountID, contractHash, method string, params []neoaccountsclient.ContractParam, scope string) (*neoaccountsclient.InvokeContractResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.invokeContractCalls = append(m.invokeContractCalls, invokeContractCall{
		AccountID:    accountID,
		ContractHash: contractHash,
		Method:       method,
		Params:       params,
		Scope:        scope,
	})
	return m.invokeContractResp, m.invokeContractErr
}

func (m *mockPoolClient) InvokeMaster(ctx context.Context, contractHash, method string, params []neoaccountsclient.ContractParam, scope string) (*neoaccountsclient.InvokeContractResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.invokeMasterCalls = append(m.invokeMasterCalls, invokeMasterCall{
		ContractHash: contractHash,
		Method:       method,
		Params:       params,
		Scope:        scope,
	})
	return m.invokeMasterResp, m.invokeMasterErr
}

func (m *mockPoolClient) FundAccount(ctx context.Context, toAddress string, amount int64) (*neoaccountsclient.FundAccountResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.fundAccountCalls = append(m.fundAccountCalls, fundAccountCall{ToAddress: toAddress, Amount: amount})
	return m.fundAccountResp, m.fundAccountErr
}

func (m *mockPoolClient) Transfer(ctx context.Context, accountID, toAddress string, amount int64, tokenHash string) (*neoaccountsclient.TransferResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.transferCalls = append(m.transferCalls, transferCall{AccountID: accountID, ToAddress: toAddress, Amount: amount, TokenHash: tokenHash})
	return m.transferResp, m.transferErr
}

func (m *mockPoolClient) TransferWithData(ctx context.Context, accountID, toAddress string, amount int64, data string) (*neoaccountsclient.TransferWithDataResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.transferWithDataCalls = append(m.transferWithDataCalls, transferWithDataCall{AccountID: accountID, ToAddress: toAddress, Amount: amount, Data: data})
	return m.transferWithDataResp, m.transferWithDataErr
}

// Helper methods for test assertions
func (m *mockPoolClient) getRequestAccountsCalls() []requestAccountsCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]requestAccountsCall{}, m.requestAccountsCalls...)
}

func (m *mockPoolClient) getReleaseAccountsCalls() []releaseAccountsCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]releaseAccountsCall{}, m.releaseAccountsCalls...)
}

func (m *mockPoolClient) getInvokeContractCalls() []invokeContractCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]invokeContractCall{}, m.invokeContractCalls...)
}

func (m *mockPoolClient) getInvokeMasterCalls() []invokeMasterCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]invokeMasterCall{}, m.invokeMasterCalls...)
}

func (m *mockPoolClient) getFundAccountCalls() []fundAccountCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]fundAccountCall{}, m.fundAccountCalls...)
}

func (m *mockPoolClient) getTransferWithDataCalls() []transferWithDataCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]transferWithDataCall{}, m.transferWithDataCalls...)
}

func (m *mockPoolClient) reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.requestAccountsCalls = nil
	m.releaseAccountsCalls = nil
	m.invokeContractCalls = nil
	m.invokeMasterCalls = nil
	m.fundAccountCalls = nil
	m.transferCalls = nil
	m.transferWithDataCalls = nil
}

// =============================================================================
// Mock Contract Invoker
// =============================================================================

// mockContractInvoker implements a mock version of ContractInvoker for testing.
type mockContractInvoker struct {
	mu sync.Mutex

	// Configurable responses
	updatePriceFeedResp string
	updatePriceFeedErr  error

	recordRandomnessResp string
	recordRandomnessErr  error

	payToAppResp string
	payToAppErr  error

	payoutToUserResp string
	payoutToUserErr  error

	// MiniApp contract support
	miniAppContracts       map[string]string // appID -> contract hash
	invokeMiniAppResp      string
	invokeMiniAppErr       error
	invokeMiniAppCalls     []invokeMiniAppCall

	// Call tracking
	updatePriceFeedCalls  []updatePriceFeedCall
	recordRandomnessCalls []recordRandomnessCall
	payToAppCalls         []payToAppCall
	payoutToUserCalls     []payoutToUserCall

	// Stats
	stats map[string]interface{}
}

type updatePriceFeedCall struct {
	Symbol string
}

type recordRandomnessCall struct{}

type payToAppCall struct {
	AppID  string
	Amount int64
	Memo   string
}

type payoutToUserCall struct {
	AppID       string
	UserAddress string
	Amount      int64
	Memo        string
}

type invokeMiniAppCall struct {
	AppID  string
	Method string
	Params []neoaccountsclient.ContractParam
}

func newMockContractInvoker() *mockContractInvoker {
	return &mockContractInvoker{
		updatePriceFeedResp:  "0xtest-pricefeed-tx",
		recordRandomnessResp: "0xtest-randomness-tx",
		payToAppResp:         "0xtest-payment-tx",
		payoutToUserResp:     "0xtest-payout-tx",
		invokeMiniAppResp:    "0xtest-miniapp-tx",
		miniAppContracts: map[string]string{
			"miniapp-lottery":           "0x3e330b4c396b40aa08d49912c0179319831b3a6e",
			"miniapp-coin-flip":         "0xbd4c9203495048900e34cd9c4618c05994e86cc0",
			"miniapp-dice-game":         "0xfacff9abd201dca86e6a63acfb5d60da278da8ea",
			"miniapp-scratch-card":      "0x2674ef3b4d8c006201d1e7e473316592f6cde5f2",
			"miniapp-prediction-market": "0x64118096bd004a2bcb010f4371aba45121eca790",
			"miniapp-flashloan":         "0xee51e5b399f7727267b7d296ff34ec6bb9283131",
			"miniapp-price-ticker":      "0x838bd5dd3d257a844fadddb5af2b9dac45e1d320",
			"miniapp-gas-spin":          "0x19bcb0a50ddf5bf7cefbb47044cdb3ce4cb9e4cd",
			"miniapp-price-predict":     "0x6317f97029b39f9211193085fe20dcf6500ec59d",
			"miniapp-secret-vote":       "0x7763ce957515f6acef6d093376977ac6c1cbc47d",
			"miniapp-ai-trader":         "0xc3356f394897e36b3903ea81d87717da8db98809",
			"miniapp-grid-bot":          "0x0d9cfc40ac2ab58de449950725af9637e0884b28",
			"miniapp-nft-evolve":        "0xadd18a719d14d59c064244833cd2c812c79d6015",
			"miniapp-bridge-guardian":   "0x2d03f3e4ff10e14ea94081e0c21e79e79c33f9e3",
		},
		stats: map[string]interface{}{
			"price_feed_updates":  int64(0),
			"randomness_records":  int64(0),
			"payment_hub_pays":    int64(0),
			"callback_payouts":    int64(0),
			"contract_errors":     int64(0),
			"locked_accounts":     0,
		},
	}
}

func (m *mockContractInvoker) UpdatePriceFeed(ctx context.Context, symbol string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.updatePriceFeedCalls = append(m.updatePriceFeedCalls, updatePriceFeedCall{Symbol: symbol})
	if m.updatePriceFeedErr == nil {
		m.stats["price_feed_updates"] = m.stats["price_feed_updates"].(int64) + 1
	}
	return m.updatePriceFeedResp, m.updatePriceFeedErr
}

func (m *mockContractInvoker) RecordRandomness(ctx context.Context) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.recordRandomnessCalls = append(m.recordRandomnessCalls, recordRandomnessCall{})
	if m.recordRandomnessErr == nil {
		m.stats["randomness_records"] = m.stats["randomness_records"].(int64) + 1
	}
	return m.recordRandomnessResp, m.recordRandomnessErr
}

func (m *mockContractInvoker) PayToApp(ctx context.Context, appID string, amount int64, memo string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.payToAppCalls = append(m.payToAppCalls, payToAppCall{AppID: appID, Amount: amount, Memo: memo})
	if m.payToAppErr == nil {
		m.stats["payment_hub_pays"] = m.stats["payment_hub_pays"].(int64) + 1
	}
	return m.payToAppResp, m.payToAppErr
}

func (m *mockContractInvoker) PayoutToUser(ctx context.Context, appID string, userAddress string, amount int64, memo string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.payoutToUserCalls = append(m.payoutToUserCalls, payoutToUserCall{AppID: appID, UserAddress: userAddress, Amount: amount, Memo: memo})
	if m.payoutToUserErr == nil {
		m.stats["callback_payouts"] = m.stats["callback_payouts"].(int64) + 1
	}
	return m.payoutToUserResp, m.payoutToUserErr
}

func (m *mockContractInvoker) GetStats() map[string]interface{} {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make(map[string]interface{})
	for k, v := range m.stats {
		result[k] = v
	}
	return result
}

func (m *mockContractInvoker) GetPriceSymbols() []string {
	return []string{"BTCUSD", "ETHUSD", "NEOUSD", "GASUSD"}
}

func (m *mockContractInvoker) GetLockedAccountCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.stats["locked_accounts"].(int)
}

func (m *mockContractInvoker) ReleaseAllAccounts(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.stats["locked_accounts"] = 0
}

func (m *mockContractInvoker) Close() {
	m.ReleaseAllAccounts(context.Background())
}

// MiniApp contract methods
func (m *mockContractInvoker) HasMiniAppContract(appID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.miniAppContracts[appID]
	return ok
}

func (m *mockContractInvoker) GetMiniAppContractHash(appID string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	hash, ok := m.miniAppContracts[appID]
	if !ok {
		return "", fmt.Errorf("miniapp contract not found: %s", appID)
	}
	return hash, nil
}

func (m *mockContractInvoker) InvokeMiniAppContract(ctx context.Context, appID, method string, params []neoaccountsclient.ContractParam) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.invokeMiniAppCalls = append(m.invokeMiniAppCalls, invokeMiniAppCall{AppID: appID, Method: method, Params: params})
	return m.invokeMiniAppResp, m.invokeMiniAppErr
}

// Helper methods for test assertions
func (m *mockContractInvoker) getUpdatePriceFeedCalls() []updatePriceFeedCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]updatePriceFeedCall{}, m.updatePriceFeedCalls...)
}

func (m *mockContractInvoker) getRecordRandomnessCalls() []recordRandomnessCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]recordRandomnessCall{}, m.recordRandomnessCalls...)
}

func (m *mockContractInvoker) getPayToAppCalls() []payToAppCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]payToAppCall{}, m.payToAppCalls...)
}

func (m *mockContractInvoker) getInvokeMiniAppCalls() []invokeMiniAppCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]invokeMiniAppCall{}, m.invokeMiniAppCalls...)
}

func (m *mockContractInvoker) reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.updatePriceFeedCalls = nil
	m.recordRandomnessCalls = nil
	m.payToAppCalls = nil
	m.payoutToUserCalls = nil
	m.invokeMiniAppCalls = nil
	m.stats = map[string]interface{}{
		"price_feed_updates":  int64(0),
		"randomness_records":  int64(0),
		"payment_hub_pays":    int64(0),
		"callback_payouts":    int64(0),
		"contract_errors":     int64(0),
		"locked_accounts":     0,
	}
}

// =============================================================================
// Test Helpers
// =============================================================================

// testClock provides a controllable clock for testing time-dependent code.
type testClock struct {
	now time.Time
}

func newTestClock(t time.Time) *testClock {
	return &testClock{now: t}
}

func (c *testClock) Now() time.Time {
	return c.now
}

func (c *testClock) Advance(d time.Duration) {
	c.now = c.now.Add(d)
}

// Verify interface compliance
var _ PoolClientInterface = (*mockPoolClient)(nil)
var _ ContractInvokerInterface = (*mockContractInvoker)(nil)

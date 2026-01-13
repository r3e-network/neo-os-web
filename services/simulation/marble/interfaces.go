// Package neosimulation provides simulation service for automated transaction testing.
package neosimulation

import (
	"context"

	neoaccountsclient "github.com/R3E-Network/service_layer/infrastructure/accountpool/client"
)

// PoolClientInterface defines the interface for pool client operations used by ContractInvoker.
// This interface allows for dependency injection and easier testing.
type PoolClientInterface interface {
	RequestAccounts(ctx context.Context, count int, purpose string) (*neoaccountsclient.RequestAccountsResponse, error)
	ReleaseAccounts(ctx context.Context, accountIDs []string) (*neoaccountsclient.ReleaseAccountsResponse, error)
	InvokeContract(ctx context.Context, accountID, contractAddress, method string, params []neoaccountsclient.ContractParam, scope string) (*neoaccountsclient.InvokeContractResponse, error)
	InvokeMaster(ctx context.Context, contractAddress, method string, params []neoaccountsclient.ContractParam, scope string) (*neoaccountsclient.InvokeContractResponse, error)
	FundAccount(ctx context.Context, toAddress string, amount int64) (*neoaccountsclient.FundAccountResponse, error)
	Transfer(ctx context.Context, accountID, toAddress string, amount int64, tokenAddress string) (*neoaccountsclient.TransferResponse, error)
	TransferWithData(ctx context.Context, accountID, toAddress string, amount int64, data string) (*neoaccountsclient.TransferWithDataResponse, error)
}

// ContractInvokerInterface defines the interface for contract invocation operations.
// This interface allows for dependency injection and easier testing.
type ContractInvokerInterface interface {
	UpdatePriceFeed(ctx context.Context, symbol string) (string, error)
	RecordRandomness(ctx context.Context) (string, error)
	PayToApp(ctx context.Context, appID string, amount int64, memo string) (string, error)
	PayoutToUser(ctx context.Context, appID string, userAddress string, amount int64, memo string) (string, error)
	// MiniApp contract methods
	HasMiniAppContract(appID string) bool
	GetMiniAppContractAddress(appID string) (string, error)
	InvokeMiniAppContract(ctx context.Context, appID, method string, params []neoaccountsclient.ContractParam) (string, error)
	// Stats and management
	GetStats() map[string]interface{}
	GetPriceSymbols() []string
	GetLockedAccountCount() int
	ReleaseAllAccounts(ctx context.Context)
	Close()
}

// Verify interface compliance at compile time
var _ PoolClientInterface = (*neoaccountsclient.Client)(nil)
var _ ContractInvokerInterface = (*ContractInvoker)(nil)

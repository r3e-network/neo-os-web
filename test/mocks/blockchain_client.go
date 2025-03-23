package mocks

import (
	"context"

	"github.com/stretchr/testify/mock"

	"service_layer/internal/blockchain"
)

// BlockchainClient is a mock implementation of the blockchain client
type BlockchainClient struct {
	mock.Mock
}

// InvokeContractFunction mocks the invocation of a smart contract function
func (m *BlockchainClient) InvokeContractFunction(scriptHash string, method string, args []interface{}) (*blockchain.InvokeResult, error) {
	mockArgs := m.Called(scriptHash, method, args)

	result := mockArgs.Get(0)
	if result == nil {
		return nil, mockArgs.Error(1)
	}

	return result.(*blockchain.InvokeResult), mockArgs.Error(1)
}

// GetTransactionInfo mocks retrieving transaction information
func (m *BlockchainClient) GetTransactionInfo(txID string) (*blockchain.TransactionInfo, error) {
	mockArgs := m.Called(txID)

	result := mockArgs.Get(0)
	if result == nil {
		return nil, mockArgs.Error(1)
	}

	return result.(*blockchain.TransactionInfo), mockArgs.Error(1)
}

// GetContractStorage mocks retrieving data from a contract's storage
func (m *BlockchainClient) GetContractStorage(scriptHash string, key string) (string, error) {
	mockArgs := m.Called(scriptHash, key)
	return mockArgs.String(0), mockArgs.Error(1)
}

// DeployContract mocks contract deployment
func (m *BlockchainClient) DeployContract(ctx context.Context, contract *blockchain.ContractDeployment) (*blockchain.DeployResult, error) {
	mockArgs := m.Called(ctx, contract)

	result := mockArgs.Get(0)
	if result == nil {
		return nil, mockArgs.Error(1)
	}

	return result.(*blockchain.DeployResult), mockArgs.Error(1)
}

// GetBlockHeight mocks retrieving the current block height
func (m *BlockchainClient) GetBlockHeight() (uint32, error) {
	mockArgs := m.Called()
	return uint32(mockArgs.Int(0)), mockArgs.Error(1)
}

// GetBalance mocks retrieving a wallet balance
func (m *BlockchainClient) GetBalance(address string, assetID string) (*blockchain.Balance, error) {
	mockArgs := m.Called(address, assetID)

	result := mockArgs.Get(0)
	if result == nil {
		return nil, mockArgs.Error(1)
	}

	return result.(*blockchain.Balance), mockArgs.Error(1)
}

// Transfer mocks a token transfer
func (m *BlockchainClient) Transfer(fromAddress string, toAddress string, amount string, assetID string) (*blockchain.TransferResult, error) {
	mockArgs := m.Called(fromAddress, toAddress, amount, assetID)

	result := mockArgs.Get(0)
	if result == nil {
		return nil, mockArgs.Error(1)
	}

	return result.(*blockchain.TransferResult), mockArgs.Error(1)
}

package blockchain

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/R3E-Network/service_layer/internal/database"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/google/uuid"
	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

// ContractService provides functionality for contract deployment and verification
type ContractService struct {
	client         *Client
	walletStore    WalletStore
	contractRepo   *database.ContractRepository
	logger         *logger.Logger
	compilerClient *CompilerClient
}

// WalletStore provides access to wallet storage
type WalletStore interface {
	GetWallet(userID int, walletID string) (*wallet.Wallet, error)
}

// CompilerClient provides access to NEO contract compilation
type CompilerClient struct {
	// In a real implementation, this would be a client to a Neo compiler service
	// For simplicity, we'll mock this
}

// NewContractService creates a new contract service
func NewContractService(
	client *Client,
	walletStore WalletStore,
	contractRepo *database.ContractRepository,
	logger *logger.Logger,
) *ContractService {
	return &ContractService{
		client:         client,
		walletStore:    walletStore,
		contractRepo:   contractRepo,
		logger:         logger,
		compilerClient: &CompilerClient{},
	}
}

// DeployContract deploys a smart contract to the blockchain
func (s *ContractService) DeployContract(ctx context.Context, req *models.ContractDeployRequest, userID int) (*models.ContractDeployResponse, error) {
	// Create a new contract record
	contract := models.NewContract(req.Name, req.Description, req.Source, userID, req.Network)

	// Store the contract in the database
	if err := s.contractRepo.Create(ctx, contract); err != nil {
		return nil, fmt.Errorf("failed to create contract record: %w", err)
	}

	// Start a goroutine to handle the actual deployment
	// This allows the API to return immediately while the deployment happens asynchronously
	go func() {
		deployCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		if err := s.processContractDeployment(deployCtx, contract, req, userID); err != nil {
			s.logger.Errorf("Contract deployment failed: %v", err)

			// Update the contract status to failed
			contract.Status = models.ContractStatusFailed
			if err := s.contractRepo.Update(deployCtx, contract); err != nil {
				s.logger.Errorf("Failed to update contract status: %v", err)
			}
		}
	}()

	// Return the initial response
	return contract.ToDeployResponse(), nil
}

// processContractDeployment handles the actual contract deployment
func (s *ContractService) processContractDeployment(ctx context.Context, contract *models.Contract, req *models.ContractDeployRequest, userID int) error {
	// Update contract status to deploying
	contract.Status = models.ContractStatusDeploying
	if err := s.contractRepo.Update(ctx, contract); err != nil {
		return fmt.Errorf("failed to update contract status: %w", err)
	}

	// 1. Compile the contract
	// In a production environment, this would call an actual compiler service
	// For now, we'll simulate this
	bytecode, manifest, err := s.compileContract(req.Source, req.Compiler, req.Parameters)
	if err != nil {
		return fmt.Errorf("failed to compile contract: %w", err)
	}

	// Store the bytecode and manifest
	contract.Bytecode = bytecode
	contract.Manifest = manifest
	if err := s.contractRepo.Update(ctx, contract); err != nil {
		return fmt.Errorf("failed to update contract: %w", err)
	}

	// 2. Get the wallet
	wallet, err := s.walletStore.GetWallet(userID, req.Wallet)
	if err != nil {
		return fmt.Errorf("failed to get wallet: %w", err)
	}

	// 3. Deploy the contract
	txHash, address, err := s.deployContractToBlockchain(ctx, bytecode, manifest, wallet)
	if err != nil {
		return fmt.Errorf("failed to deploy contract: %w", err)
	}

	// 4. Update the contract with the transaction hash and address
	contract.TxHash = txHash
	contract.Address = address
	contract.Status = models.ContractStatusDeployed
	if err := s.contractRepo.Update(ctx, contract); err != nil {
		return fmt.Errorf("failed to update contract: %w", err)
	}

	return nil
}

// compileContract compiles a contract
func (s *ContractService) compileContract(source, compiler string, parameters map[string]interface{}) ([]byte, []byte, error) {
	// Decode the source code
	sourceCode, err := base64.StdEncoding.DecodeString(source)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to decode source code: %w", err)
	}

	// In a real implementation, this would call an actual compiler service
	// For now, we'll simulate this with mock data

	// Simulate bytecode
	bytecode := []byte("simulated-bytecode")

	// Simulate manifest
	manifest := []byte(`{"name":"SimulatedManifest"}`)

	return bytecode, manifest, nil
}

// deployContractToBlockchain deploys the contract to the blockchain
func (s *ContractService) deployContractToBlockchain(ctx context.Context, bytecode, manifest []byte, w *wallet.Wallet) (string, string, error) {
	// Get the default account
	if len(w.Accounts) == 0 {
		return "", "", errors.New("wallet has no accounts")
	}

	account := w.Accounts[0]

	// Create a deployment script
	script, err := smartcontract.CreateDeploymentScript(bytecode, manifest)
	if err != nil {
		return "", "", fmt.Errorf("failed to create deployment script: %w", err)
	}

	// Create a transaction
	tx := transaction.NewTransaction(script)

	// Sign the transaction
	if err := tx.Sign(account.PrivateKey()); err != nil {
		return "", "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send the transaction
	txHash, err := s.client.SendTransaction(tx)
	if err != nil {
		return "", "", fmt.Errorf("failed to send transaction: %w", err)
	}

	// Calculate the contract address
	hash, err := keys.PublicKeyFromBytes(account.PublicKey())
	if err != nil {
		return "", "", fmt.Errorf("failed to get public key: %w", err)
	}

	address := hash.Address()

	return txHash, address, nil
}

// GetContract retrieves a contract by ID
func (s *ContractService) GetContract(ctx context.Context, id string) (*models.ContractResponse, error) {
	// Convert the ID to UUID
	contractID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid contract ID: %w", err)
	}

	// Get the contract from the database
	contract, err := s.contractRepo.GetByID(ctx, contractID)
	if err != nil {
		return nil, fmt.Errorf("failed to get contract: %w", err)
	}

	// Convert to response
	return contract.ToResponse(), nil
}

// GetContractsByUser retrieves contracts by user ID
func (s *ContractService) GetContractsByUser(ctx context.Context, userID int) ([]*models.ContractResponse, error) {
	// Get contracts from the database
	contracts, err := s.contractRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get contracts: %w", err)
	}

	// Convert to responses
	responses := make([]*models.ContractResponse, len(contracts))
	for i, contract := range contracts {
		responses[i] = contract.ToResponse()
	}

	return responses, nil
}

// VerifyContract verifies a contract's source code
func (s *ContractService) VerifyContract(ctx context.Context, req *models.ContractVerifyRequest, userID int) (*models.ContractVerifyResponse, error) {
	// Convert the contract ID to UUID
	contractID, err := uuid.Parse(req.ContractID)
	if err != nil {
		return nil, fmt.Errorf("invalid contract ID: %w", err)
	}

	// Get the contract from the database
	contract, err := s.contractRepo.GetByID(ctx, contractID)
	if err != nil {
		return nil, fmt.Errorf("failed to get contract: %w", err)
	}

	// Compile the provided source code
	bytecode, manifest, err := s.compileContract(req.Source, req.Compiler, req.Parameters)
	if err != nil {
		return nil, fmt.Errorf("failed to compile contract: %w", err)
	}

	// Compare the bytecode
	bytecodeMatch := compareBytes(bytecode, contract.Bytecode)

	// Compare the manifest
	var manifestMatch bool
	if bytecodeMatch {
		// Only compare manifest if bytecode matches
		manifestMatch = compareBytes(manifest, contract.Manifest)
	}

	// Verification result
	verified := bytecodeMatch && manifestMatch

	// Create verification details
	details := map[string]interface{}{
		"bytecodeMatch": bytecodeMatch,
		"manifestMatch": manifestMatch,
		"compilerSettings": map[string]interface{}{
			"compiler":   req.Compiler,
			"parameters": req.Parameters,
		},
	}

	// Convert details to JSON
	detailsJSON, err := json.Marshal(details)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal verification details: %w", err)
	}

	// Create a verification record
	var message string
	if verified {
		message = "Contract successfully verified"
	} else {
		message = "Contract verification failed"
	}

	verification := models.NewContractVerification(
		contractID,
		verified,
		message,
		detailsJSON,
		userID,
	)

	// Store the verification
	if err := s.contractRepo.CreateVerification(ctx, verification); err != nil {
		return nil, fmt.Errorf("failed to create verification record: %w", err)
	}

	// Return the response
	return &models.ContractVerifyResponse{
		Verified: verified,
		Message:  message,
		Details:  details,
	}, nil
}

// compareBytes compares two byte slices
func compareBytes(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}

	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}

	return true
}

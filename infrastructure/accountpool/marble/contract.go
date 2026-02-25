// Package neoaccounts provides transaction signing for the neoaccounts service.
package neoaccounts

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
)

// DeployContract deploys a new smart contract using a pool account.
// All signing happens inside TEE - private keys never leave the enclave.
func (s *Service) DeployContract(ctx context.Context, serviceID, accountID, nefBase64, manifestJSON string, data any) (*DeployContractResponse, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	if s.chainClient == nil {
		return nil, fmt.Errorf("chain client not configured")
	}
	if accountID == "" {
		return nil, fmt.Errorf("account_id required")
	}
	if nefBase64 == "" {
		return nil, fmt.Errorf("nef_base64 required")
	}
	if manifestJSON == "" {
		return nil, fmt.Errorf("manifest_json required")
	}

	s.mu.RLock()
	acc, err := s.repo.GetByID(ctx, accountID)
	if err != nil {
		s.mu.RUnlock()
		return nil, fmt.Errorf("account not found: %w", err)
	}

	if acc.LockedBy != serviceID {
		s.mu.RUnlock()
		return nil, fmt.Errorf("account not locked by service %s", serviceID)
	}
	s.mu.RUnlock()

	// Derive pool account private key inside TEE
	priv, err := s.getPrivateKey(acc)
	if err != nil {
		return nil, fmt.Errorf("derive key: %w", err)
	}

	signer, err := deriveWalletAccount(priv)
	if err != nil {
		return nil, fmt.Errorf("create signer account: %w", err)
	}

	// Decode NEF from base64
	nefBytes, err := base64.StdEncoding.DecodeString(nefBase64)
	if err != nil {
		return nil, fmt.Errorf("decode nef base64: %w", err)
	}

	// Build deployment parameters
	params := []chain.ContractParam{
		chain.NewByteArrayParam(nefBytes),
		chain.NewByteArrayParam([]byte(manifestJSON)),
	}
	if data != nil {
		params = append(params, chain.NewAnyParam())
	}

	// ContractManagement native contract hash
	contractMgmtHash := "0xfffdc93764dbaddd97c48f252a53ea4643faa3fd"

	// Simulate deployment first
	invokeResult, err := s.chainClient.InvokeFunctionWithSigners(ctx, contractMgmtHash, "deploy", params, signer.ScriptHash())
	if err != nil {
		return nil, fmt.Errorf("deployment simulation failed: %w", err)
	}
	if invokeResult.State != "HALT" {
		return nil, fmt.Errorf("deployment simulation faulted: %s", invokeResult.Exception)
	}

	// Build and sign the transaction inside TEE
	txBuilder := chain.NewTxBuilder(s.chainClient, s.chainClient.NetworkID())
	tx, err := txBuilder.BuildAndSignTx(ctx, invokeResult, signer, transaction.CalledByEntry)
	if err != nil {
		return nil, fmt.Errorf("build deployment transaction: %w", err)
	}

	txHash, err := txBuilder.BroadcastTx(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("broadcast deployment: %w", err)
	}

	txHashString := "0x" + txHash.StringLE()

	// Wait for confirmation
	waitCtx, cancel := context.WithTimeout(ctx, chain.DefaultTxWaitTimeout)
	defer cancel()

	appLog, err := s.chainClient.WaitForApplicationLog(waitCtx, txHashString, chain.DefaultPollInterval)
	if err != nil {
		return nil, fmt.Errorf("wait for deployment execution: %w", err)
	}

	// Extract contract hash from deployment result
	contractHash := ""
	if appLog != nil && len(appLog.Executions) > 0 {
		exec := appLog.Executions[0]
		if exec.VMState != "HALT" {
			return nil, fmt.Errorf("deployment failed with state: %s", exec.VMState)
		}
		// Contract hash is typically in the first notification or stack result
		// The stack item contains the deployed contract state as a struct
		if len(exec.Stack) > 0 {
			// Try to extract hash from the stack item's Value field
			var valueMap map[string]any
			if err := json.Unmarshal(exec.Stack[0].Value, &valueMap); err == nil {
				if h, ok := valueMap["hash"].(string); ok {
					contractHash = h
				}
			}
		}
	}

	// Update account metadata
	s.mu.Lock()
	acc.LastUsedAt = time.Now()
	acc.TxCount++
	if updateErr := s.repo.Update(ctx, acc); updateErr != nil {
		s.Logger().WithContext(ctx).WithError(updateErr).Warn("failed to update account metadata after deploy")
	}
	s.mu.Unlock()

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"account_id":    accountID,
		"tx_hash":       txHashString,
		"contract_hash": contractHash,
		"gas_consumed":  invokeResult.GasConsumed,
	}).Info("contract deployed")

	return &DeployContractResponse{
		TxHash:       txHashString,
		ContractHash: contractHash,
		GasConsumed:  invokeResult.GasConsumed,
		AccountID:    accountID,
	}, nil
}

// UpdateContract updates an existing smart contract using a pool account.
// All signing happens inside TEE - private keys never leave the enclave.
func (s *Service) UpdateContract(ctx context.Context, serviceID, accountID, contractHash, nefBase64, manifestJSON string, data any) (*UpdateContractResponse, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	if s.chainClient == nil {
		return nil, fmt.Errorf("chain client not configured")
	}
	if accountID == "" {
		return nil, fmt.Errorf("account_id required")
	}
	if contractHash == "" {
		return nil, fmt.Errorf("contract_hash required")
	}
	if nefBase64 == "" {
		return nil, fmt.Errorf("nef_base64 required")
	}
	if manifestJSON == "" {
		return nil, fmt.Errorf("manifest_json required")
	}

	s.mu.RLock()
	acc, err := s.repo.GetByID(ctx, accountID)
	if err != nil {
		s.mu.RUnlock()
		return nil, fmt.Errorf("account not found: %w", err)
	}

	if acc.LockedBy != serviceID {
		s.mu.RUnlock()
		return nil, fmt.Errorf("account not locked by service %s", serviceID)
	}
	s.mu.RUnlock()

	// Derive pool account private key inside TEE
	priv, err := s.getPrivateKey(acc)
	if err != nil {
		return nil, fmt.Errorf("derive key: %w", err)
	}

	signer, err := deriveWalletAccount(priv)
	if err != nil {
		return nil, fmt.Errorf("create signer account: %w", err)
	}

	// Decode NEF from base64
	nefBytes, err := base64.StdEncoding.DecodeString(nefBase64)
	if err != nil {
		return nil, fmt.Errorf("decode nef base64: %w", err)
	}

	// Build update parameters - call update on the contract itself
	params := []chain.ContractParam{
		chain.NewByteArrayParam(nefBytes),
		chain.NewByteArrayParam([]byte(manifestJSON)),
	}
	if data != nil {
		params = append(params, chain.NewAnyParam())
	}

	// Simulate update
	invokeResult, err := s.chainClient.InvokeFunctionWithSigners(ctx, contractHash, "update", params, signer.ScriptHash())
	if err != nil {
		return nil, fmt.Errorf("update simulation failed: %w", err)
	}
	if invokeResult.State != "HALT" {
		return nil, fmt.Errorf("update simulation faulted: %s", invokeResult.Exception)
	}

	// Build and sign the transaction inside TEE
	txBuilder := chain.NewTxBuilder(s.chainClient, s.chainClient.NetworkID())
	tx, err := txBuilder.BuildAndSignTx(ctx, invokeResult, signer, transaction.CalledByEntry)
	if err != nil {
		return nil, fmt.Errorf("build update transaction: %w", err)
	}

	txHash, err := txBuilder.BroadcastTx(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("broadcast update: %w", err)
	}

	txHashString := "0x" + txHash.StringLE()

	// Wait for confirmation
	waitCtx, cancel := context.WithTimeout(ctx, chain.DefaultTxWaitTimeout)
	defer cancel()

	appLog, err := s.chainClient.WaitForApplicationLog(waitCtx, txHashString, chain.DefaultPollInterval)
	if err != nil {
		return nil, fmt.Errorf("wait for update execution: %w", err)
	}
	if appLog != nil && len(appLog.Executions) > 0 && appLog.Executions[0].VMState != "HALT" {
		return nil, fmt.Errorf("update failed with state: %s", appLog.Executions[0].VMState)
	}

	// Update account metadata
	s.mu.Lock()
	acc.LastUsedAt = time.Now()
	acc.TxCount++
	if updateErr := s.repo.Update(ctx, acc); updateErr != nil {
		s.Logger().WithContext(ctx).WithError(updateErr).Warn("failed to update account metadata after update")
	}
	s.mu.Unlock()

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"account_id":    accountID,
		"tx_hash":       txHashString,
		"contract_hash": contractHash,
		"gas_consumed":  invokeResult.GasConsumed,
	}).Info("contract updated")

	return &UpdateContractResponse{
		TxHash:       txHashString,
		ContractHash: contractHash,
		GasConsumed:  invokeResult.GasConsumed,
		AccountID:    accountID,
	}, nil
}

// InvokeContract invokes a contract method using a pool account.
// All signing happens inside TEE - private keys never leave the enclave.
func (s *Service) InvokeContract(ctx context.Context, serviceID, accountID, contractHash, method string, params []ContractParam, scope string) (*InvokeContractResponse, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	if s.chainClient == nil {
		return nil, fmt.Errorf("chain client not configured")
	}
	if accountID == "" {
		return nil, fmt.Errorf("account_id required")
	}
	if contractHash == "" {
		return nil, fmt.Errorf("contract_hash required")
	}
	if method == "" {
		return nil, fmt.Errorf("method required")
	}

	s.mu.RLock()
	acc, err := s.repo.GetByID(ctx, accountID)
	if err != nil {
		s.mu.RUnlock()
		return nil, fmt.Errorf("account not found: %w", err)
	}

	if acc.LockedBy != serviceID {
		s.mu.RUnlock()
		return nil, fmt.Errorf("account not locked by service %s", serviceID)
	}
	s.mu.RUnlock()

	// Derive pool account private key inside TEE
	priv, err := s.getPrivateKey(acc)
	if err != nil {
		return nil, fmt.Errorf("derive key: %w", err)
	}

	signer, err := deriveWalletAccount(priv)
	if err != nil {
		return nil, fmt.Errorf("create signer account: %w", err)
	}

	// Convert params to chain.ContractParam
	chainParams := make([]chain.ContractParam, len(params))
	for i, p := range params {
		cp, convErr := convertToChainParam(p)
		if convErr != nil {
			return nil, fmt.Errorf("convert param %d: %w", i, convErr)
		}
		chainParams[i] = cp
	}

	// Determine transaction scope (default to CalledByEntry for safety)
	// Must be determined BEFORE simulation so the correct scope is used
	rpcScope := chain.ScopeCalledByEntry
	txScope := transaction.CalledByEntry
	switch strings.ToLower(scope) {
	case "global":
		rpcScope = chain.ScopeGlobal
		txScope = transaction.Global
	case "customcontracts":
		rpcScope = chain.ScopeCustomContracts
		txScope = transaction.CustomContracts
	case "customgroups":
		rpcScope = chain.ScopeCustomGroups
		txScope = transaction.CustomGroups
	case "none":
		rpcScope = chain.ScopeNone
		txScope = transaction.None
	case "calledbyentry", "":
		rpcScope = chain.ScopeCalledByEntry
		txScope = transaction.CalledByEntry
	}

	// Simulate invocation with the correct scope
	invokeResult, err := s.chainClient.InvokeFunctionWithScope(ctx, contractHash, method, chainParams, signer.ScriptHash(), rpcScope)
	if err != nil {
		return nil, fmt.Errorf("invocation simulation failed: %w", err)
	}
	if invokeResult.State != "HALT" {
		return &InvokeContractResponse{
			State:       invokeResult.State,
			GasConsumed: invokeResult.GasConsumed,
			Exception:   invokeResult.Exception,
			AccountID:   accountID,
		}, fmt.Errorf("invocation simulation faulted: %s", invokeResult.Exception)
	}

	// Build and sign the transaction inside TEE
	txBuilder := chain.NewTxBuilder(s.chainClient, s.chainClient.NetworkID())
	tx, err := txBuilder.BuildAndSignTx(ctx, invokeResult, signer, txScope)
	if err != nil {
		return nil, fmt.Errorf("build invocation transaction: %w", err)
	}

	txHash, err := txBuilder.BroadcastTx(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("broadcast invocation: %w", err)
	}

	txHashString := "0x" + txHash.StringLE()

	// Wait for confirmation
	waitCtx, cancel := context.WithTimeout(ctx, chain.DefaultTxWaitTimeout)
	defer cancel()

	appLog, err := s.chainClient.WaitForApplicationLog(waitCtx, txHashString, chain.DefaultPollInterval)
	if err != nil {
		return nil, fmt.Errorf("wait for invocation execution: %w", err)
	}

	state := "HALT"
	exception := ""
	if appLog != nil && len(appLog.Executions) > 0 {
		state = appLog.Executions[0].VMState
		exception = appLog.Executions[0].Exception
	}

	// Update account metadata
	s.mu.Lock()
	acc.LastUsedAt = time.Now()
	acc.TxCount++
	if updateErr := s.repo.Update(ctx, acc); updateErr != nil {
		s.Logger().WithContext(ctx).WithError(updateErr).Warn("failed to update account metadata after invoke")
	}
	s.mu.Unlock()

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"account_id":    accountID,
		"tx_hash":       txHashString,
		"contract_hash": contractHash,
		"method":        method,
		"scope":         scope,
		"gas_consumed":  invokeResult.GasConsumed,
	}).Info("contract invoked")

	return &InvokeContractResponse{
		TxHash:      txHashString,
		State:       state,
		GasConsumed: invokeResult.GasConsumed,
		Exception:   exception,
		AccountID:   accountID,
	}, nil
}

// SimulateContract simulates a contract invocation without signing or broadcasting.
func (s *Service) SimulateContract(ctx context.Context, serviceID, accountID, contractHash, method string, params []ContractParam) (*SimulateContractResponse, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	if s.chainClient == nil {
		return nil, fmt.Errorf("chain client not configured")
	}
	if accountID == "" {
		return nil, fmt.Errorf("account_id required")
	}
	if contractHash == "" {
		return nil, fmt.Errorf("contract_hash required")
	}
	if method == "" {
		return nil, fmt.Errorf("method required")
	}

	s.mu.RLock()
	acc, err := s.repo.GetByID(ctx, accountID)
	if err != nil {
		s.mu.RUnlock()
		return nil, fmt.Errorf("account not found: %w", err)
	}

	if acc.LockedBy != serviceID {
		s.mu.RUnlock()
		return nil, fmt.Errorf("account not locked by service %s", serviceID)
	}
	s.mu.RUnlock()

	// Derive pool account private key inside TEE (only for getting script hash)
	priv, err := s.getPrivateKey(acc)
	if err != nil {
		return nil, fmt.Errorf("derive key: %w", err)
	}

	signer, err := deriveWalletAccount(priv)
	if err != nil {
		return nil, fmt.Errorf("create signer account: %w", err)
	}

	// Convert params to chain.ContractParam
	chainParams := make([]chain.ContractParam, len(params))
	for i, p := range params {
		cp, convErr := convertToChainParam(p)
		if convErr != nil {
			return nil, fmt.Errorf("convert param %d: %w", i, convErr)
		}
		chainParams[i] = cp
	}

	// Simulate invocation
	invokeResult, err := s.chainClient.InvokeFunctionWithSigners(ctx, contractHash, method, chainParams, signer.ScriptHash())
	if err != nil {
		return nil, fmt.Errorf("simulation failed: %w", err)
	}

	return &SimulateContractResponse{
		State:       invokeResult.State,
		GasConsumed: invokeResult.GasConsumed,
		Exception:   invokeResult.Exception,
	}, nil
}

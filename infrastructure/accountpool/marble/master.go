// Package neoaccounts provides transaction signing for the neoaccounts service.
package neoaccounts

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"strings"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/wallet"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/accountpool/supabase"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	intcrypto "github.com/r3e-network/neo-miniapp-platform/infrastructure/crypto"
)

// getMasterWallet lazily initializes and returns the cached master wallet account
// derived from TEE_PRIVATE_KEY. The wallet is created once and reused across all
// master-key operations (FundAccount, InvokeMaster, DeployMaster).
// Uses double-checked locking so that transient errors (e.g. env not yet
// populated by an init-container) can be retried on the next call.
func (s *Service) getMasterWallet() (*wallet.Account, error) {
	s.masterWalletMu.Lock()
	defer s.masterWalletMu.Unlock()

	if s.masterWallet != nil {
		return s.masterWallet, nil
	}

	teePrivateKey := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if teePrivateKey == "" {
		teePrivateKey = strings.TrimSpace(os.Getenv("TEE_PRIVATE_KEY"))
	}
	if teePrivateKey == "" {
		teePrivateKey = strings.TrimSpace(os.Getenv("TEE_WALLET_PRIVATE_KEY"))
	}
	if teePrivateKey == "" {
		return nil, fmt.Errorf("TEE_PRIVATE_KEY not configured")
	}

	// Zeroize raw key after parsing
	teeKeyBytes := []byte(teePrivateKey)
	defer intcrypto.ZeroBytes(teeKeyBytes)

	var acct *wallet.Account
	var err error
	if teePrivateKey[0] == 'K' || teePrivateKey[0] == 'L' || teePrivateKey[0] == '5' {
		acct, err = chain.AccountFromWIF(teePrivateKey)
	} else {
		hexKey := strings.TrimPrefix(strings.TrimPrefix(teePrivateKey, "0x"), "0X")
		acct, err = chain.AccountFromPrivateKey(hexKey)
	}
	if err != nil {
		return nil, fmt.Errorf("create signer from TEE_PRIVATE_KEY: %w", err)
	}

	// Cache on success only; errors are not cached so callers can retry.
	s.masterWallet = acct
	return acct, nil
}

// FundAccount transfers tokens from the master wallet (TEE_PRIVATE_KEY) to a target address.
// This is used to fund pool accounts with GAS for transaction fees.
// Unlike Transfer(), this uses the master wallet directly, not a pool account.
// After successful transfer, updates the database balance for the target account.
func (s *Service) FundAccount(ctx context.Context, toAddress string, amount int64, tokenHash string) (*FundAccountResponse, error) {
	if s.chainClient == nil {
		return nil, fmt.Errorf("chain client not configured")
	}
	if toAddress == "" {
		return nil, fmt.Errorf("to_address required")
	}
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	walletAccount, err := s.getMasterWallet()
	if err != nil {
		return nil, err
	}

	fromAddress := walletAccount.Address

	// Convert to address to script hash
	toU160, err := address.StringToUint160(strings.TrimSpace(toAddress))
	if err != nil {
		return nil, fmt.Errorf("invalid to address %q: %w", toAddress, err)
	}

	// Use the chain client's TransferGAS method which uses the actor pattern
	txHash, err := s.chainClient.TransferGAS(ctx, walletAccount, toU160, big.NewInt(amount))
	if err != nil {
		return nil, fmt.Errorf("transfer GAS: %w", err)
	}

	txHashString := "0x" + txHash.StringLE()

	// Wait for the funding transaction to be confirmed on-chain
	// This ensures the pool account has GAS before we return
	waitCtx, cancel := context.WithTimeout(ctx, chain.DefaultTxWaitTimeout)
	defer cancel()

	appLog, err := s.chainClient.WaitForApplicationLog(waitCtx, txHashString, chain.DefaultPollInterval)
	if err != nil {
		return nil, fmt.Errorf("wait for funding confirmation (tx: %s): %w", txHashString, err)
	}
	if appLog != nil && len(appLog.Executions) > 0 && appLog.Executions[0].VMState != "HALT" {
		return nil, fmt.Errorf("funding transaction failed (tx: %s): %s", txHashString, appLog.Executions[0].Exception)
	}

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"tx_hash": txHashString,
	}).Info("funding transaction confirmed on-chain")

	// Update database balance for the target pool account.
	// The read-compute-write must be atomic to prevent concurrent FundAccount
	// calls from losing balance updates.
	if s.repo != nil {
		acc, accErr := s.repo.GetByAddress(ctx, toAddress)
		if accErr == nil && acc != nil {
			// Get GAS script hash and decimals
			scriptHash, decimals := supabase.GetDefaultTokenConfig(TokenTypeGAS)

			s.mu.Lock()
			// Get current balance and add the funded amount
			currentBalance := int64(0)
			if existingBal, balErr := s.repo.GetBalance(ctx, acc.ID, TokenTypeGAS); balErr == nil && existingBal != nil {
				currentBalance = existingBal.Amount
			}
			newBalance := currentBalance + amount
			if upsertErr := s.repo.UpsertBalance(ctx, acc.ID, TokenTypeGAS, scriptHash, newBalance, decimals); upsertErr != nil {
				s.mu.Unlock()
				s.Logger().WithContext(ctx).WithError(upsertErr).Warn("failed to update database balance after fund transfer")
			} else {
				s.mu.Unlock()
				s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
					"account_id":  acc.ID,
					"old_balance": currentBalance,
					"new_balance": newBalance,
					"funded":      amount,
				}).Info("database balance updated after fund transfer")
			}
		}
	}

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"from_address": fromAddress,
		"to_address":   toAddress,
		"amount":       amount,
		"tx_hash":      txHashString,
	}).Info("fund transfer completed")

	return &FundAccountResponse{
		TxHash:      txHashString,
		FromAddress: fromAddress,
		ToAddress:   toAddress,
		Amount:      amount,
	}, nil
}

// InvokeMaster invokes a contract method using the master wallet (TEE_PRIVATE_KEY).
// This is used for TEE operations like PriceFeed and RandomnessLog that require
// the caller to be a registered TEE signer in AppRegistry.
// Unlike InvokeContract(), this uses the master wallet directly, not a pool account.
func (s *Service) InvokeMaster(ctx context.Context, contractHash, method string, params []ContractParam, scope string) (*InvokeContractResponse, error) {
	if s.chainClient == nil {
		return nil, fmt.Errorf("chain client not configured")
	}
	if contractHash == "" {
		return nil, fmt.Errorf("contract_hash required")
	}
	if method == "" {
		return nil, fmt.Errorf("method required")
	}

	signer, err := s.getMasterWallet()
	if err != nil {
		return nil, err
	}

	// Convert params to chain.ContractParam
	chainParams := make([]chain.ContractParam, len(params))
	for i, p := range params {
		cp, paramErr := convertToChainParam(p)
		if paramErr != nil {
			return nil, fmt.Errorf("convert param %d: %w", i, paramErr)
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
			AccountID:   "master",
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

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"account":       "master",
		"tx_hash":       txHashString,
		"contract_hash": contractHash,
		"method":        method,
		"scope":         scope,
		"gas_consumed":  invokeResult.GasConsumed,
	}).Info("master contract invoked")

	return &InvokeContractResponse{
		TxHash:      txHashString,
		State:       state,
		GasConsumed: invokeResult.GasConsumed,
		Exception:   exception,
		AccountID:   "master",
	}, nil
}

// DeployMaster deploys a new smart contract using the master wallet (TEE_PRIVATE_KEY).
// This is used for deploying contracts where the master account needs to be the Admin.
// All signing happens inside TEE - private keys never leave the enclave.
func (s *Service) DeployMaster(ctx context.Context, nefBase64, manifestJSON string, data any) (*DeployMasterResponse, error) {
	if s.chainClient == nil {
		return nil, fmt.Errorf("chain client not configured")
	}
	if nefBase64 == "" {
		return nil, fmt.Errorf("nef_base64 required")
	}
	if manifestJSON == "" {
		return nil, fmt.Errorf("manifest_json required")
	}

	signer, err := s.getMasterWallet()
	if err != nil {
		return nil, err
	}

	// Decode NEF from base64
	nefBytes, err := base64.StdEncoding.DecodeString(nefBase64)
	if err != nil {
		return nil, fmt.Errorf("decode nef base64: %w", err)
	}

	// Build deployment parameters
	// ContractManagement.deploy expects: (ByteArray nefFile, ByteArray manifest, Any data)
	// The manifest must be passed as ByteArray (UTF-8 bytes), not String
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

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"account":      "master",
		"gas_estimate": invokeResult.GasConsumed,
	}).Info("deployment simulation passed, building transaction")

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

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"account": "master",
		"tx_hash": txHashString,
	}).Info("deployment transaction broadcast, waiting for confirmation")

	// Wait for confirmation
	waitCtx, cancel := context.WithTimeout(ctx, chain.DefaultTxWaitTimeout)
	defer cancel()

	appLog, err := s.chainClient.WaitForApplicationLog(waitCtx, txHashString, chain.DefaultPollInterval)
	if err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
			"tx_hash": txHashString,
		}).Error("failed to get application log")
		return nil, fmt.Errorf("wait for deployment execution (tx: %s): %w", txHashString, err)
	}

	// Extract contract hash from deployment result
	contractHash := ""
	if appLog != nil && len(appLog.Executions) > 0 {
		exec := appLog.Executions[0]
		if exec.VMState != "HALT" {
			s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
				"tx_hash":   txHashString,
				"vm_state":  exec.VMState,
				"exception": exec.Exception,
			}).Error("deployment transaction failed")
			return nil, fmt.Errorf("deployment failed (tx: %s) with state: %s, exception: %s", txHashString, exec.VMState, exec.Exception)
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

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"account":       "master",
		"tx_hash":       txHashString,
		"contract_hash": contractHash,
		"gas_consumed":  invokeResult.GasConsumed,
	}).Info("contract deployed with master wallet")

	return &DeployMasterResponse{
		TxHash:       txHashString,
		ContractHash: contractHash,
		GasConsumed:  invokeResult.GasConsumed,
		AccountID:    "master",
	}, nil
}

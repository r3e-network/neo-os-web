// Package neoaccounts provides transaction signing for the neoaccounts service.
package neoaccounts

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"

	neoaccountssupabase "github.com/R3E-Network/service_layer/infrastructure/accountpool/supabase"
	"github.com/R3E-Network/service_layer/infrastructure/chain"
	intcrypto "github.com/R3E-Network/service_layer/infrastructure/crypto"
)

// SignTransaction signs a transaction hash with an account's private key.
// The account must be locked by the requesting service.
func (s *Service) SignTransaction(ctx context.Context, serviceID, accountID string, txHash []byte) (*SignTransactionResponse, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()

	acc, err := s.repo.GetByID(ctx, accountID)
	if err != nil {
		return nil, fmt.Errorf("account not found: %w", err)
	}

	if acc.LockedBy != serviceID {
		return nil, fmt.Errorf("account not locked by service %s", serviceID)
	}

	priv, err := s.getPrivateKey(accountID)
	if err != nil {
		return nil, fmt.Errorf("derive key: %w", err)
	}

	signature, err := signHash(priv, txHash)
	if err != nil {
		return nil, fmt.Errorf("sign: %w", err)
	}

	pubBytes := intcrypto.PublicKeyToBytes(&priv.PublicKey)

	return &SignTransactionResponse{
		AccountID: accountID,
		Signature: signature,
		PublicKey: pubBytes,
	}, nil
}

// BatchSign signs multiple transaction hashes.
func (s *Service) BatchSign(ctx context.Context, serviceID string, requests []SignRequest) *BatchSignResponse {
	resp := &BatchSignResponse{
		Signatures: make([]SignTransactionResponse, 0, len(requests)),
		Errors:     make([]string, 0),
	}

	for _, req := range requests {
		sig, err := s.SignTransaction(ctx, serviceID, req.AccountID, req.TxHash)
		if err != nil {
			resp.Errors = append(resp.Errors, fmt.Sprintf("%s: %v", req.AccountID, err))
			continue
		}
		resp.Signatures = append(resp.Signatures, *sig)
	}

	return resp
}

// signHash signs a hash using ECDSA.
func signHash(priv *ecdsa.PrivateKey, hash []byte) ([]byte, error) {
	r, s, err := ecdsa.Sign(rand.Reader, priv, hash)
	if err != nil {
		return nil, err
	}

	rBytes := r.Bytes()
	sBytes := s.Bytes()

	signature := make([]byte, 64)
	copy(signature[32-len(rBytes):32], rBytes)
	copy(signature[64-len(sBytes):64], sBytes)

	return signature, nil
}

// verifySignature verifies an ECDSA signature.
func verifySignature(pub *ecdsa.PublicKey, hash, signature []byte) bool {
	if len(signature) != 64 {
		return false
	}

	r := new(big.Int).SetBytes(signature[:32])
	s := new(big.Int).SetBytes(signature[32:])

	return ecdsa.Verify(pub, hash, r, s)
}

// Transfer transfers tokens from a pool account to a target address.
// The account must be locked by the requesting service.
//
// The transfer is executed as an on-chain NEP-17 `transfer(from,to,amount,data)` invocation
// signed by the pool account's derived private key.
func (s *Service) Transfer(ctx context.Context, serviceID, accountID, toAddress string, amount int64, tokenHash string) (string, error) {
	if s.repo == nil {
		return "", fmt.Errorf("repository not configured")
	}
	if s.chainClient == nil {
		return "", fmt.Errorf("chain client not configured")
	}
	if accountID == "" {
		return "", fmt.Errorf("account_id required")
	}
	if toAddress == "" {
		return "", fmt.Errorf("to_address required")
	}
	if amount <= 0 {
		return "", fmt.Errorf("amount must be positive")
	}

	tokenHash = strings.TrimSpace(tokenHash)
	s.mu.RLock()
	acc, err := s.repo.GetByID(ctx, accountID)
	if err != nil {
		s.mu.RUnlock()
		return "", fmt.Errorf("account not found: %w", err)
	}

	if acc.LockedBy != serviceID {
		s.mu.RUnlock()
		return "", fmt.Errorf("account not locked by service %s", serviceID)
	}

	// Default to GAS if no token hash specified
	if tokenHash == "" {
		tokenHash = neoaccountssupabase.GASScriptHash
	}
	tokenHash = strings.TrimSpace(tokenHash)
	tokenHash = strings.TrimPrefix(strings.TrimPrefix(tokenHash, "0x"), "0X")
	if tokenHash == "" {
		s.mu.RUnlock()
		return "", fmt.Errorf("token_hash required")
	}
	tokenHash = "0x" + tokenHash

	// Copy required account fields while holding the lock; do not hold the lock across RPC calls.
	fromAddress := strings.TrimSpace(acc.Address)
	s.mu.RUnlock()

	// Derive pool account private key and build a neo-go signer account.
	priv, err := s.getPrivateKey(accountID)
	if err != nil {
		return "", fmt.Errorf("derive key: %w", err)
	}

	dBytes := priv.D.Bytes()
	keyBytes := make([]byte, 32)
	copy(keyBytes[32-len(dBytes):], dBytes)
	signer, err := chain.AccountFromPrivateKey(hex.EncodeToString(keyBytes))
	if err != nil {
		return "", fmt.Errorf("create signer account: %w", err)
	}

	// Convert addresses to script-hash strings for RPC params.
	fromU160, err := address.StringToUint160(fromAddress)
	if err != nil {
		return "", fmt.Errorf("invalid from address %q: %w", fromAddress, err)
	}
	toU160, err := address.StringToUint160(strings.TrimSpace(toAddress))
	if err != nil {
		return "", fmt.Errorf("invalid to address %q: %w", toAddress, err)
	}

	params := []chain.ContractParam{
		chain.NewHash160Param("0x" + fromU160.StringLE()),
		chain.NewHash160Param("0x" + toU160.StringLE()),
		chain.NewIntegerParam(big.NewInt(amount)),
		chain.NewAnyParam(),
	}

	// Build and sign the transaction locally.
	invokeResult, err := s.chainClient.InvokeFunctionWithSigners(ctx, tokenHash, "transfer", params, signer.ScriptHash())
	if err != nil {
		return "", fmt.Errorf("transfer simulation failed: %w", err)
	}
	if invokeResult.State != "HALT" {
		return "", fmt.Errorf("transfer simulation faulted: %s", invokeResult.Exception)
	}

	txBuilder := chain.NewTxBuilder(s.chainClient, s.chainClient.NetworkID())
	tx, err := txBuilder.BuildAndSignTx(ctx, invokeResult, signer, transaction.CalledByEntry)
	if err != nil {
		return "", fmt.Errorf("build transfer transaction: %w", err)
	}

	txHash, err := txBuilder.BroadcastTx(ctx, tx)
	if err != nil {
		return "", err
	}

	txHashString := "0x" + txHash.StringLE()

	waitCtx, cancel := context.WithTimeout(ctx, chain.DefaultTxWaitTimeout)
	defer cancel()

	appLog, err := s.chainClient.WaitForApplicationLog(waitCtx, txHashString, chain.DefaultPollInterval)
	if err != nil {
		return txHashString, fmt.Errorf("wait for transfer execution: %w", err)
	}
	if appLog != nil && len(appLog.Executions) > 0 && appLog.Executions[0].VMState != "HALT" {
		return txHashString, fmt.Errorf("transfer failed with state: %s", appLog.Executions[0].VMState)
	}

	// Best-effort account metadata update; the chain tx succeeded regardless.
	s.mu.Lock()
	acc.LastUsedAt = time.Now()
	acc.TxCount++
	if updateErr := s.repo.Update(ctx, acc); updateErr != nil {
		s.Logger().WithContext(ctx).WithError(updateErr).WithFields(map[string]interface{}{
			"account_id": accountID,
			"tx_hash":    txHashString,
		}).Warn("failed to update account metadata after transfer")
	}
	s.mu.Unlock()

	s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
		"account_id": accountID,
		"to_address": toAddress,
		"amount":     amount,
		"token_hash": tokenHash,
		"tx_hash":    txHashString,
	}).Info("transfer completed")

	return txHashString, nil
}

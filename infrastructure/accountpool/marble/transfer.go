// Package neoaccounts provides transaction signing for the neoaccounts service.
package neoaccounts

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/util"
)

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
	if tokenHash != "" {
		const gasHash = "d2a4cff31913016155e38e474a2c06d08be276cf"
		normalized := strings.ToLower(strings.TrimPrefix(strings.TrimPrefix(tokenHash, "0x"), "0X"))
		if normalized != gasHash {
			return "", fmt.Errorf("only GAS transfers are supported, got token hash: %s", tokenHash)
		}
	}
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
	s.mu.RUnlock()

	// Derive pool account private key and build a neo-go wallet account.
	priv, err := s.getPrivateKey(acc)
	if err != nil {
		return "", fmt.Errorf("derive key: %w", err)
	}

	walletAccount, err := deriveWalletAccount(priv)
	if err != nil {
		return "", fmt.Errorf("create signer account: %w", err)
	}

	// Convert to address to script hash
	toU160, err := address.StringToUint160(strings.TrimSpace(toAddress))
	if err != nil {
		return "", fmt.Errorf("invalid to address %q: %w", toAddress, err)
	}

	// Use the chain client's TransferGAS method which uses the actor pattern
	txHash, err := s.chainClient.TransferGAS(ctx, walletAccount, toU160, big.NewInt(amount))
	if err != nil {
		return "", fmt.Errorf("transfer GAS: %w", err)
	}

	txHashString := "0x" + txHash.StringLE()

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
		"tx_hash":    txHashString,
	}).Info("transfer completed")

	return txHashString, nil
}

// TransferWithData transfers GAS from a pool account to a target address with optional data.
// The data parameter is passed to the OnNEP17Payment callback of the receiving contract.
// This is used for payments to contracts like PaymentHub that need to identify the payment source.
func (s *Service) TransferWithData(ctx context.Context, serviceID, accountID, toAddress string, amount int64, data string) (string, error) {
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
	s.mu.RUnlock()

	// Derive pool account private key and build a neo-go wallet account.
	priv, err := s.getPrivateKey(acc)
	if err != nil {
		return "", fmt.Errorf("derive key: %w", err)
	}

	walletAccount, err := deriveWalletAccount(priv)
	if err != nil {
		return "", fmt.Errorf("create signer account: %w", err)
	}

	// Convert to address or script hash to Uint160
	// Support both Neo N3 addresses (starting with 'N') and script hashes (0x... or hex)
	toAddress = strings.TrimSpace(toAddress)
	var toU160 util.Uint160
	if toAddress != "" && toAddress[0] == 'N' {
		// Neo N3 address format
		toU160, err = address.StringToUint160(toAddress)
		if err != nil {
			return "", fmt.Errorf("invalid to address %q: %w", toAddress, err)
		}
	} else {
		// Script hash format (0x... or plain hex)
		hashStr := strings.TrimPrefix(strings.TrimPrefix(toAddress, "0x"), "0X")
		toU160, err = util.Uint160DecodeStringLE(hashStr)
		if err != nil {
			return "", fmt.Errorf("invalid script hash %q: %w", toAddress, err)
		}
	}

	// Use the chain client's TransferGASWithData method which uses the actor pattern
	// The data parameter is passed to the OnNEP17Payment callback
	// IMPORTANT: Pass data as []byte to avoid Neo VM CONVERT errors
	// The C# contract expects ByteString which can be cast to string
	var txHash util.Uint256
	if data != "" {
		// Convert string to []byte for proper Neo VM serialization
		txHash, err = s.chainClient.TransferGASWithData(ctx, walletAccount, toU160, big.NewInt(amount), []byte(data))
	} else {
		txHash, err = s.chainClient.TransferGAS(ctx, walletAccount, toU160, big.NewInt(amount))
	}
	if err != nil {
		return "", fmt.Errorf("transfer GAS: %w", err)
	}

	txHashString := "0x" + txHash.StringLE()

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
		"data":       data,
		"tx_hash":    txHashString,
	}).Info("transfer with data completed")

	return txHashString, nil
}

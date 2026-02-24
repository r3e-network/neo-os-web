// Package neoaccounts provides transaction signing for the neoaccounts service.
package neoaccounts

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"strings"

	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/wallet"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	intcrypto "github.com/r3e-network/neo-miniapp-platform/infrastructure/crypto"
)

// deriveWalletAccount derives a wallet account from an ECDSA private key,
// ensuring all intermediate key material is zeroed after use.
func deriveWalletAccount(priv *ecdsa.PrivateKey) (*wallet.Account, error) {
	dBytes := priv.D.Bytes()
	keyBytes := make([]byte, 32)
	copy(keyBytes[32-len(dBytes):], dBytes)

	// Encode to hex in a mutable []byte buffer so we can zero it
	hexBuf := make([]byte, 64)
	hex.Encode(hexBuf, keyBytes)

	// Zero raw key material immediately after encoding
	intcrypto.ZeroBytes(keyBytes)
	intcrypto.ZeroBytes(dBytes)

	account, err := chain.AccountFromPrivateKey(string(hexBuf))

	// Zero the hex buffer
	intcrypto.ZeroBytes(hexBuf)

	return account, err
}

// SignTransaction signs a transaction hash with an account's private key.
// The account must be locked by the requesting service.
func (s *Service) SignTransaction(ctx context.Context, serviceID, accountID string, txHash []byte) (*SignTransactionResponse, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	if len(txHash) != 32 {
		return nil, fmt.Errorf("tx_hash must be 32 bytes")
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

	priv, err := s.getPrivateKey(acc)
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
			resp.Errors = append(resp.Errors, fmt.Sprintf("%s: signing failed", req.AccountID))
			continue
		}
		resp.Signatures = append(resp.Signatures, *sig)
	}

	return resp
}

// signHash signs a hash using ECDSA with BIP-62 low-s normalization.
// Neo N3 requires low-s signatures to prevent malleability.
func signHash(priv *ecdsa.PrivateKey, hash []byte) ([]byte, error) {
	r, s, err := ecdsa.Sign(rand.Reader, priv, hash)
	if err != nil {
		return nil, err
	}

	// Enforce low-s (BIP-62): if s > N/2, replace with N - s.
	curveN := priv.Curve.Params().N
	halfN := new(big.Int).Rsh(new(big.Int).Set(curveN), 1)
	if s.Cmp(halfN) > 0 {
		s.Sub(curveN, s)
	}

	rBytes := r.Bytes()
	defer intcrypto.ZeroBytes(rBytes)
	sBytes := s.Bytes()
	defer intcrypto.ZeroBytes(sBytes)

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

// convertToChainParam converts a ContractParam to chain.ContractParam.
func convertToChainParam(p ContractParam) (chain.ContractParam, error) {
	switch strings.ToLower(p.Type) {
	case "hash160":
		if s, ok := p.Value.(string); ok {
			// If it looks like a Neo address (starts with N), convert to script hash
			if s != "" && s[0] == 'N' {
				u160, err := address.StringToUint160(s)
				if err == nil {
					// Return as 0x-prefixed little-endian hex string
					return chain.NewHash160Param("0x" + u160.StringLE()), nil
				}
			}
			return chain.NewHash160Param(s), nil
		}
	case "integer":
		switch v := p.Value.(type) {
		case string:
			if i, err := strconv.ParseInt(v, 10, 64); err == nil {
				return chain.NewIntegerParam(big.NewInt(i)), nil
			}
		case float64:
			bf := new(big.Float).SetFloat64(v)
			bi, _ := bf.Int(nil)
			return chain.NewIntegerParam(bi), nil
		case int64:
			return chain.NewIntegerParam(big.NewInt(v)), nil
		case int:
			return chain.NewIntegerParam(big.NewInt(int64(v))), nil
		case json.Number:
			if bi, ok := new(big.Int).SetString(string(v), 10); ok {
				return chain.NewIntegerParam(bi), nil
			}
		}
	case "string":
		if s, ok := p.Value.(string); ok {
			return chain.NewStringParam(s), nil
		}
	case "bytearray":
		if s, ok := p.Value.(string); ok {
			// Try base64 decode first, fall back to hex
			if bytes, err := base64.StdEncoding.DecodeString(s); err == nil {
				return chain.NewByteArrayParam(bytes), nil
			}
			// Try hex decode
			if bytes, err := hex.DecodeString(s); err == nil {
				return chain.NewByteArrayParam(bytes), nil
			}
			// Use as raw bytes
			return chain.NewByteArrayParam([]byte(s)), nil
		}
	case "bool", "boolean":
		switch v := p.Value.(type) {
		case bool:
			return chain.NewBoolParam(v), nil
		case string:
			return chain.NewBoolParam(v == "true" || v == "1"), nil
		}
	case "any":
		return chain.NewAnyParam(), nil
	}
	return chain.ContractParam{}, fmt.Errorf("unsupported parameter type: %s", p.Type)
}

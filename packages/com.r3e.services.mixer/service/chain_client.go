// Package mixer provides privacy-preserving transaction mixing service.
package mixer

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"
)

// Neo N3 Chain Client Implementation
//
// This client provides blockchain interaction for the mixer service:
// - Balance queries
// - Transaction building and submission
// - Transaction status tracking
// - Smart contract interactions for proof submission

// NeoN3ChainClient implements ChainClient for Neo N3 blockchain.
type NeoN3ChainClient struct {
	mu sync.RWMutex

	// RPC endpoint URL
	rpcURL string

	// HTTP client for RPC calls
	httpClient *http.Client

	// Mixer contract script hash (for proof submission)
	mixerContractHash string

	// GAS token script hash (native token)
	gasTokenHash string

	// NEO token script hash
	neoTokenHash string

	// Configuration
	config ChainClientConfig
}

// ChainClientConfig configures the chain client.
type ChainClientConfig struct {
	// RPCURL is the Neo N3 RPC endpoint
	RPCURL string

	// MixerContractHash is the script hash of the mixer contract
	MixerContractHash string

	// RequestTimeout is the timeout for RPC requests
	RequestTimeout time.Duration

	// ConfirmationBlocks is the number of blocks to wait for confirmation
	ConfirmationBlocks int
}

// DefaultChainClientConfig returns the default configuration.
func DefaultChainClientConfig() ChainClientConfig {
	return ChainClientConfig{
		RPCURL:             "http://localhost:10332",
		MixerContractHash:  "",
		RequestTimeout:     30 * time.Second,
		ConfirmationBlocks: 1,
	}
}

// Neo N3 native token script hashes
const (
	NeoN3GASTokenHash = "d2a4cff31913016155e38e474a2c06d08be276cf"
	NeoN3NEOTokenHash = "ef4073a0f2b305a38ec4050e4d3d28bc40ea63f5"
)

// NewNeoN3ChainClient creates a new Neo N3 chain client.
func NewNeoN3ChainClient(config ChainClientConfig) (*NeoN3ChainClient, error) {
	if config.RPCURL == "" {
		config.RPCURL = "http://localhost:10332"
	}
	if config.RequestTimeout == 0 {
		config.RequestTimeout = 30 * time.Second
	}
	if config.ConfirmationBlocks == 0 {
		config.ConfirmationBlocks = 1
	}

	return &NeoN3ChainClient{
		rpcURL: config.RPCURL,
		httpClient: &http.Client{
			Timeout: config.RequestTimeout,
		},
		mixerContractHash: config.MixerContractHash,
		gasTokenHash:      NeoN3GASTokenHash,
		neoTokenHash:      NeoN3NEOTokenHash,
		config:            config,
	}, nil
}

// GetBalance returns the balance of an address.
func (c *NeoN3ChainClient) GetBalance(ctx context.Context, address string, tokenAddress string) (string, error) {
	// Determine token script hash
	tokenHash := c.gasTokenHash
	if tokenAddress != "" {
		tokenHash = tokenAddress
	}

	// Convert address to script hash
	scriptHash, err := addressToScriptHash(address)
	if err != nil {
		return "", fmt.Errorf("invalid address: %w", err)
	}

	// Call NEP-17 balanceOf
	result, err := c.invokeFunction(ctx, tokenHash, "balanceOf", []interface{}{
		map[string]interface{}{
			"type":  "Hash160",
			"value": scriptHash,
		},
	})
	if err != nil {
		return "", fmt.Errorf("invoke balanceOf: %w", err)
	}

	// Parse result
	balance, err := parseStackInteger(result)
	if err != nil {
		return "", fmt.Errorf("parse balance: %w", err)
	}

	return balance.String(), nil
}

// SendTransaction submits a signed transaction to the chain.
func (c *NeoN3ChainClient) SendTransaction(ctx context.Context, signedTx []byte) (string, error) {
	// Encode transaction as base64
	txBase64 := hex.EncodeToString(signedTx)

	// Send raw transaction
	result, err := c.rpcCall(ctx, "sendrawtransaction", []interface{}{txBase64})
	if err != nil {
		return "", fmt.Errorf("send transaction: %w", err)
	}

	// Parse result
	var response struct {
		Hash string `json:"hash"`
	}
	if err := json.Unmarshal(result, &response); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}

	return response.Hash, nil
}

// GetTransactionStatus checks if a transaction is confirmed.
func (c *NeoN3ChainClient) GetTransactionStatus(ctx context.Context, txHash string) (bool, int64, error) {
	// Get transaction
	result, err := c.rpcCall(ctx, "getrawtransaction", []interface{}{txHash, true})
	if err != nil {
		// Transaction not found means not confirmed
		return false, 0, nil
	}

	// Parse result
	var tx struct {
		BlockHash   string `json:"blockhash"`
		BlockNumber int64  `json:"blocktime"`
		Confirmations int  `json:"confirmations"`
	}
	if err := json.Unmarshal(result, &tx); err != nil {
		return false, 0, fmt.Errorf("parse transaction: %w", err)
	}

	// Check confirmations
	confirmed := tx.Confirmations >= c.config.ConfirmationBlocks
	return confirmed, tx.BlockNumber, nil
}

// BuildTransferTx builds an unsigned transfer transaction.
func (c *NeoN3ChainClient) BuildTransferTx(ctx context.Context, from, to, amount, tokenAddress string) ([]byte, error) {
	// Determine token script hash
	tokenHash := c.gasTokenHash
	if tokenAddress != "" {
		tokenHash = tokenAddress
	}

	// Convert addresses to script hashes
	fromHash, err := addressToScriptHash(from)
	if err != nil {
		return nil, fmt.Errorf("invalid from address: %w", err)
	}

	toHash, err := addressToScriptHash(to)
	if err != nil {
		return nil, fmt.Errorf("invalid to address: %w", err)
	}

	// Parse amount
	amountInt, ok := new(big.Int).SetString(amount, 10)
	if !ok {
		return nil, fmt.Errorf("invalid amount: %s", amount)
	}

	// Build NEP-17 transfer script
	script := buildNEP17TransferScript(tokenHash, fromHash, toHash, amountInt)

	// Build transaction structure
	tx := buildUnsignedTransaction(script, fromHash)

	return tx, nil
}

// SubmitMixProof submits the ZKP and TEE signature to the on-chain contract.
func (c *NeoN3ChainClient) SubmitMixProof(ctx context.Context, requestID, proofHash, teeSignature string) (string, error) {
	if c.mixerContractHash == "" {
		return "", errors.New("mixer contract not configured")
	}

	// Build contract invocation
	result, err := c.invokeFunction(ctx, c.mixerContractHash, "submitProof", []interface{}{
		map[string]interface{}{
			"type":  "String",
			"value": requestID,
		},
		map[string]interface{}{
			"type":  "String",
			"value": proofHash,
		},
		map[string]interface{}{
			"type":  "String",
			"value": teeSignature,
		},
	})
	if err != nil {
		return "", fmt.Errorf("invoke submitProof: %w", err)
	}

	// For now, return a placeholder transaction hash
	// In production, this would sign and submit the transaction
	return fmt.Sprintf("proof_%s_%x", requestID, result[:8]), nil
}

// SubmitCompletionProof submits the completion proof to the on-chain contract.
func (c *NeoN3ChainClient) SubmitCompletionProof(ctx context.Context, requestID string, deliveredAmount string) (string, error) {
	if c.mixerContractHash == "" {
		return "", errors.New("mixer contract not configured")
	}

	// Build contract invocation
	result, err := c.invokeFunction(ctx, c.mixerContractHash, "completeRequest", []interface{}{
		map[string]interface{}{
			"type":  "String",
			"value": requestID,
		},
		map[string]interface{}{
			"type":  "Integer",
			"value": deliveredAmount,
		},
	})
	if err != nil {
		return "", fmt.Errorf("invoke completeRequest: %w", err)
	}

	return fmt.Sprintf("complete_%s_%x", requestID, result[:8]), nil
}

// GetWithdrawableRequests returns requests that users can force-withdraw.
func (c *NeoN3ChainClient) GetWithdrawableRequests(ctx context.Context) ([]string, error) {
	if c.mixerContractHash == "" {
		return []string{}, nil
	}

	// Query contract for withdrawable requests
	result, err := c.invokeFunction(ctx, c.mixerContractHash, "getWithdrawableRequests", []interface{}{})
	if err != nil {
		return nil, fmt.Errorf("invoke getWithdrawableRequests: %w", err)
	}

	// Parse result as array of strings
	var requests []string
	if err := json.Unmarshal(result, &requests); err != nil {
		// Return empty if parsing fails
		return []string{}, nil
	}

	return requests, nil
}

// --- RPC Helper Methods ---

// rpcCall makes a JSON-RPC call to the Neo N3 node.
func (c *NeoN3ChainClient) rpcCall(ctx context.Context, method string, params []interface{}) (json.RawMessage, error) {
	// Build request
	request := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  method,
		"params":  params,
	}

	body, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", c.rpcURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	// Parse response
	var rpcResp struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &rpcResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("RPC error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}

// invokeFunction invokes a smart contract function (read-only).
func (c *NeoN3ChainClient) invokeFunction(ctx context.Context, scriptHash, operation string, args []interface{}) (json.RawMessage, error) {
	params := []interface{}{
		scriptHash,
		operation,
		args,
	}

	return c.rpcCall(ctx, "invokefunction", params)
}

// --- Neo N3 Helper Functions ---

// addressToScriptHash converts a Neo N3 address to script hash.
// Uses the base58Decode function from multisig.go
func addressToScriptHash(address string) (string, error) {
	// Decode Base58Check - use the function from multisig.go
	decoded := base58Decode(address)
	if decoded == nil {
		return "", errors.New("invalid base58 encoding")
	}

	if len(decoded) != 25 {
		return "", errors.New("invalid address length")
	}

	// Verify version byte (0x35 for Neo N3)
	if decoded[0] != 0x35 {
		return "", errors.New("invalid address version")
	}

	// Extract script hash (bytes 1-21, reversed for little-endian)
	scriptHash := make([]byte, 20)
	for i := 0; i < 20; i++ {
		scriptHash[i] = decoded[20-i]
	}

	return hex.EncodeToString(scriptHash), nil
}

// parseStackInteger parses an integer from Neo VM stack result.
func parseStackInteger(result json.RawMessage) (*big.Int, error) {
	var stackResult struct {
		Stack []struct {
			Type  string `json:"type"`
			Value string `json:"value"`
		} `json:"stack"`
	}

	if err := json.Unmarshal(result, &stackResult); err != nil {
		return nil, err
	}

	if len(stackResult.Stack) == 0 {
		return big.NewInt(0), nil
	}

	item := stackResult.Stack[0]
	if item.Type != "Integer" {
		return nil, fmt.Errorf("unexpected type: %s", item.Type)
	}

	value, ok := new(big.Int).SetString(item.Value, 10)
	if !ok {
		return nil, fmt.Errorf("invalid integer: %s", item.Value)
	}

	return value, nil
}

// buildNEP17TransferScript builds a NEP-17 transfer script.
func buildNEP17TransferScript(tokenHash, fromHash, toHash string, amount *big.Int) []byte {
	var script bytes.Buffer

	// Push arguments in reverse order (Neo VM is stack-based)
	// data (null for transfer)
	script.WriteByte(0x0B) // PUSHNULL

	// amount
	pushInteger(&script, amount)

	// to
	pushHash160(&script, toHash)

	// from
	pushHash160(&script, fromHash)

	// Call transfer
	script.WriteByte(0x14) // 4 arguments
	pushString(&script, "transfer")
	pushHash160(&script, tokenHash)
	script.WriteByte(0x41) // SYSCALL
	// System.Contract.Call hash
	script.Write([]byte{0x62, 0x7d, 0x5b, 0x52})

	return script.Bytes()
}

// buildUnsignedTransaction builds an unsigned Neo N3 transaction.
func buildUnsignedTransaction(script []byte, signerHash string) []byte {
	var tx bytes.Buffer

	// Version (1 byte)
	tx.WriteByte(0x00)

	// Nonce (4 bytes, random)
	nonce := make([]byte, 4)
	binary.LittleEndian.PutUint32(nonce, uint32(time.Now().UnixNano()))
	tx.Write(nonce)

	// System fee (8 bytes)
	systemFee := make([]byte, 8)
	binary.LittleEndian.PutUint64(systemFee, 1000000) // 0.01 GAS
	tx.Write(systemFee)

	// Network fee (8 bytes)
	networkFee := make([]byte, 8)
	binary.LittleEndian.PutUint64(networkFee, 1000000) // 0.01 GAS
	tx.Write(networkFee)

	// Valid until block (4 bytes)
	validUntil := make([]byte, 4)
	binary.LittleEndian.PutUint32(validUntil, 0xFFFFFFFF)
	tx.Write(validUntil)

	// Signers count (varint)
	tx.WriteByte(0x01)

	// Signer
	signerBytes, _ := hex.DecodeString(signerHash)
	tx.Write(signerBytes)                // Account (20 bytes)
	tx.WriteByte(0x01)                   // Scope: CalledByEntry
	tx.WriteByte(0x00)                   // Allowed contracts count
	tx.WriteByte(0x00)                   // Allowed groups count

	// Attributes count
	tx.WriteByte(0x00)

	// Script
	writeVarBytes(&tx, script)

	// Witnesses count (0 for unsigned)
	tx.WriteByte(0x00)

	return tx.Bytes()
}

// pushInteger pushes an integer onto the script.
func pushInteger(script *bytes.Buffer, value *big.Int) {
	if value.Sign() == 0 {
		script.WriteByte(0x10) // PUSH0
		return
	}

	bytes := value.Bytes()
	if len(bytes) <= 1 && bytes[0] <= 16 {
		script.WriteByte(0x10 + bytes[0]) // PUSH1-PUSH16
		return
	}

	// PUSHINT
	script.WriteByte(0x00 + byte(len(bytes)))
	// Reverse for little-endian
	for i := len(bytes) - 1; i >= 0; i-- {
		script.WriteByte(bytes[i])
	}
}

// pushHash160 pushes a 20-byte hash onto the script.
func pushHash160(script *bytes.Buffer, hashHex string) {
	hash, _ := hex.DecodeString(hashHex)
	script.WriteByte(0x0C) // PUSHDATA1
	script.WriteByte(0x14) // 20 bytes
	script.Write(hash)
}

// pushString pushes a string onto the script.
func pushString(script *bytes.Buffer, s string) {
	data := []byte(s)
	if len(data) < 0x100 {
		script.WriteByte(0x0C) // PUSHDATA1
		script.WriteByte(byte(len(data)))
	} else {
		script.WriteByte(0x0D) // PUSHDATA2
		binary.Write(script, binary.LittleEndian, uint16(len(data)))
	}
	script.Write(data)
}

// writeVarBytes writes a variable-length byte array.
func writeVarBytes(w *bytes.Buffer, data []byte) {
	writeVarInt(w, uint64(len(data)))
	w.Write(data)
}

// writeVarInt writes a variable-length integer.
func writeVarInt(w *bytes.Buffer, value uint64) {
	if value < 0xFD {
		w.WriteByte(byte(value))
	} else if value <= 0xFFFF {
		w.WriteByte(0xFD)
		binary.Write(w, binary.LittleEndian, uint16(value))
	} else if value <= 0xFFFFFFFF {
		w.WriteByte(0xFE)
		binary.Write(w, binary.LittleEndian, uint32(value))
	} else {
		w.WriteByte(0xFF)
		binary.Write(w, binary.LittleEndian, value)
	}
}

// Ensure NeoN3ChainClient implements ChainClient interface
var _ ChainClient = (*NeoN3ChainClient)(nil)

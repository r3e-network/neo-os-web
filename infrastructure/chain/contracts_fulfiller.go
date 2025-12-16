package chain

import (
	"context"
	"fmt"
	"math"
	"math/big"
	"sync"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
)

// =============================================================================
// TEE Fulfillment - Transaction Builder for Callbacks
// =============================================================================

// TEEFulfiller handles TEE callback transactions to the Gateway contract.
// It properly builds, signs, and broadcasts transactions to the Neo N3 blockchain.
type TEEFulfiller struct {
	client      *Client
	gatewayHash string
	signer      TEESigner
	nonce       *nonceState
}

type nonceState struct {
	mu      sync.Mutex
	counter *big.Int
}

// NewTEEFulfiller creates a new TEE fulfiller.
// The privateKeyHex should be a hex-encoded private key (without 0x prefix).
func NewTEEFulfiller(client *Client, gatewayHash, privateKeyHex string) (*TEEFulfiller, error) {
	signer, err := NewLocalTEESignerFromPrivateKeyHex(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("create signer: %w", err)
	}

	return NewTEEFulfillerWithSigner(client, gatewayHash, signer)
}

// NewTEEFulfillerWithSigner creates a fulfiller using the provided TEE signer.
func NewTEEFulfillerWithSigner(client *Client, gatewayHash string, signer TEESigner) (*TEEFulfiller, error) {
	if client == nil {
		return nil, fmt.Errorf("client required")
	}
	if gatewayHash == "" {
		return nil, fmt.Errorf("gateway hash required")
	}
	if signer == nil {
		return nil, fmt.Errorf("signer required")
	}

	return &TEEFulfiller{
		client:      client,
		gatewayHash: gatewayHash,
		signer:      signer,
		nonce:       &nonceState{counter: big.NewInt(0)},
	}, nil
}

// WithClient returns a copy of the fulfiller that uses the provided client while
// keeping the same signer keys and nonce state (safe for retries/failover).
func (t *TEEFulfiller) WithClient(client *Client) *TEEFulfiller {
	if t == nil || client == nil {
		return t
	}

	cloned := *t
	cloned.client = client
	return &cloned
}

func (t *TEEFulfiller) invokeWithWait(ctx context.Context, contractHash, method string, params []ContractParam, wait bool) (*TxResult, error) {
	if t == nil || t.client == nil {
		return nil, fmt.Errorf("tee fulfiller client not configured")
	}
	if t.signer == nil {
		return nil, fmt.Errorf("tee fulfiller signer not configured")
	}

	return t.client.InvokeFunctionWithSignerAndWait(
		ctx,
		contractHash,
		method,
		params,
		t.signer,
		transaction.CalledByEntry,
		wait,
	)
}

// FulfillRequest fulfills a service request via the Gateway contract.
// This is called by TEE after processing a request.
// Returns the transaction hash after waiting for execution (2 minute timeout).
func (t *TEEFulfiller) FulfillRequest(ctx context.Context, requestID *big.Int, result []byte) (string, error) {
	return t.fulfillRequest(ctx, requestID, result, true)
}

// FulfillRequestNoWait fulfills a service request via the Gateway contract and returns
// once the transaction has been broadcast (confirmation is not awaited).
func (t *TEEFulfiller) FulfillRequestNoWait(ctx context.Context, requestID *big.Int, result []byte) (string, error) {
	return t.fulfillRequest(ctx, requestID, result, false)
}

func (t *TEEFulfiller) fulfillRequest(ctx context.Context, requestID *big.Int, result []byte, wait bool) (string, error) {
	nonce := t.nextNonce()

	// Use little-endian encoding to match .NET BigInteger.ToByteArray() in Neo N3 contracts
	message := append(bigIntToLittleEndian(requestID), result...)
	message = append(message, bigIntToLittleEndian(nonce)...)

	signature, err := t.signer.Sign(ctx, message)
	if err != nil {
		return "", fmt.Errorf("sign fulfillment: %w", err)
	}

	params := []ContractParam{
		NewIntegerParam(requestID),
		NewByteArrayParam(result),
		NewIntegerParam(nonce),
		NewByteArrayParam(signature),
	}

	txResult, err := t.invokeWithWait(ctx, t.gatewayHash, "fulfillRequest", params, wait)
	if err != nil {
		return "", err
	}

	return txResult.TxHash, nil
}

// FailRequest marks a request as failed via the Gateway contract.
// Returns the transaction hash after waiting for execution (2 minute timeout).
func (t *TEEFulfiller) FailRequest(ctx context.Context, requestID *big.Int, reason string) (string, error) {
	return t.failRequest(ctx, requestID, reason, true)
}

// FailRequestNoWait marks a request as failed via the Gateway contract and returns
// once the transaction has been broadcast (confirmation is not awaited).
func (t *TEEFulfiller) FailRequestNoWait(ctx context.Context, requestID *big.Int, reason string) (string, error) {
	return t.failRequest(ctx, requestID, reason, false)
}

func (t *TEEFulfiller) failRequest(ctx context.Context, requestID *big.Int, reason string, wait bool) (string, error) {
	nonce := t.nextNonce()

	// Use little-endian encoding to match .NET BigInteger.ToByteArray() in Neo N3 contracts
	message := append(bigIntToLittleEndian(requestID), []byte(reason)...)
	message = append(message, bigIntToLittleEndian(nonce)...)

	signature, err := t.signer.Sign(ctx, message)
	if err != nil {
		return "", fmt.Errorf("sign failure: %w", err)
	}

	params := []ContractParam{
		NewIntegerParam(requestID),
		NewStringParam(reason),
		NewIntegerParam(nonce),
		NewByteArrayParam(signature),
	}

	txResult, err := t.invokeWithWait(ctx, t.gatewayHash, "failRequest", params, wait)
	if err != nil {
		return "", err
	}

	return txResult.TxHash, nil
}

func (t *TEEFulfiller) nextNonce() *big.Int {
	if t == nil {
		return big.NewInt(0)
	}

	if t.nonce == nil {
		t.nonce = &nonceState{counter: big.NewInt(0)}
	}

	t.nonce.mu.Lock()
	defer t.nonce.mu.Unlock()

	t.nonce.counter.Add(t.nonce.counter, big.NewInt(1))
	return new(big.Int).Set(t.nonce.counter)
}

// =============================================================================
// TEE Fulfiller Extensions for NeoFeeds and NeoFlow
// =============================================================================

// UpdatePrice updates a price feed on-chain (NeoFeeds push pattern).
// Returns the transaction hash after waiting for execution (2 minute timeout).
func (t *TEEFulfiller) UpdatePrice(ctx context.Context, neoFeedsHash, feedID string, price *big.Int, timestamp uint64) (string, error) {
	return t.updatePrice(ctx, neoFeedsHash, feedID, price, timestamp, true)
}

// UpdatePriceNoWait updates a price feed on-chain and returns once the transaction has been broadcast.
func (t *TEEFulfiller) UpdatePriceNoWait(ctx context.Context, neoFeedsHash, feedID string, price *big.Int, timestamp uint64) (string, error) {
	return t.updatePrice(ctx, neoFeedsHash, feedID, price, timestamp, false)
}

func (t *TEEFulfiller) updatePrice(ctx context.Context, neoFeedsHash, feedID string, price *big.Int, timestamp uint64, wait bool) (string, error) {
	nonce := t.nextNonce()

	// Use little-endian encoding to match .NET BigInteger.ToByteArray() in Neo N3 contracts
	message := append([]byte(feedID), bigIntToLittleEndian(price)...)
	ts, err := safeInt64FromUint64(timestamp)
	if err != nil {
		return "", err
	}
	message = append(message, bigIntToLittleEndian(big.NewInt(ts))...)
	message = append(message, bigIntToLittleEndian(nonce)...)

	signature, err := t.signer.Sign(ctx, message)
	if err != nil {
		return "", fmt.Errorf("sign price update: %w", err)
	}

	params := []ContractParam{
		NewStringParam(feedID),
		NewIntegerParam(price),
		NewIntegerParam(big.NewInt(ts)),
		NewIntegerParam(nonce),
		NewByteArrayParam(signature),
	}

	txResult, err := t.invokeWithWait(ctx, neoFeedsHash, "updatePrice", params, wait)
	if err != nil {
		return "", err
	}

	return txResult.TxHash, nil
}

// UpdatePrices batch updates multiple price feeds (NeoFeeds push pattern).
// Returns the transaction hash after waiting for execution (2 minute timeout).
func (t *TEEFulfiller) UpdatePrices(ctx context.Context, neoFeedsHash string, feedIDs []string, prices []*big.Int, timestamps []uint64) (string, error) {
	return t.updatePrices(ctx, neoFeedsHash, feedIDs, prices, timestamps, true)
}

// UpdatePricesNoWait batch updates multiple price feeds and returns once the transaction has been broadcast.
func (t *TEEFulfiller) UpdatePricesNoWait(ctx context.Context, neoFeedsHash string, feedIDs []string, prices []*big.Int, timestamps []uint64) (string, error) {
	return t.updatePrices(ctx, neoFeedsHash, feedIDs, prices, timestamps, false)
}

func (t *TEEFulfiller) updatePrices(ctx context.Context, neoFeedsHash string, feedIDs []string, prices []*big.Int, timestamps []uint64, wait bool) (string, error) {
	if len(feedIDs) != len(prices) || len(feedIDs) != len(timestamps) {
		return "", fmt.Errorf("array length mismatch")
	}

	nonce := t.nextNonce()

	// Use little-endian encoding to match .NET BigInteger.ToByteArray() in Neo N3 contracts
	var message []byte
	for i := range feedIDs {
		message = append(message, []byte(feedIDs[i])...)
		message = append(message, bigIntToLittleEndian(prices[i])...)
		ts, err := safeInt64FromUint64(timestamps[i])
		if err != nil {
			return "", err
		}
		message = append(message, bigIntToLittleEndian(big.NewInt(ts))...)
	}
	message = append(message, bigIntToLittleEndian(nonce)...)

	signature, err := t.signer.Sign(ctx, message)
	if err != nil {
		return "", fmt.Errorf("sign batch price update: %w", err)
	}

	feedIDParams := make([]ContractParam, len(feedIDs))
	priceParams := make([]ContractParam, len(prices))
	timestampParams := make([]ContractParam, len(timestamps))

	for i := range feedIDs {
		feedIDParams[i] = NewStringParam(feedIDs[i])
		priceParams[i] = NewIntegerParam(prices[i])
		ts, tsErr := safeInt64FromUint64(timestamps[i])
		if tsErr != nil {
			return "", tsErr
		}
		timestampParams[i] = NewIntegerParam(big.NewInt(ts))
	}

	params := []ContractParam{
		NewArrayParam(feedIDParams),
		NewArrayParam(priceParams),
		NewArrayParam(timestampParams),
		NewIntegerParam(nonce),
		NewByteArrayParam(signature),
	}

	txResult, err := t.invokeWithWait(ctx, neoFeedsHash, "updatePrices", params, wait)
	if err != nil {
		return "", err
	}

	return txResult.TxHash, nil
}

// ExecuteTrigger executes an neoflow trigger (NeoFlow trigger pattern).
// Returns the transaction hash after waiting for execution (2 minute timeout).
func (t *TEEFulfiller) ExecuteTrigger(ctx context.Context, neoflowHash string, triggerID *big.Int, executionData []byte) (string, error) {
	return t.executeTrigger(ctx, neoflowHash, triggerID, executionData, true)
}

// ExecuteTriggerNoWait executes an neoflow trigger and returns once the transaction has been broadcast.
func (t *TEEFulfiller) ExecuteTriggerNoWait(ctx context.Context, neoflowHash string, triggerID *big.Int, executionData []byte) (string, error) {
	return t.executeTrigger(ctx, neoflowHash, triggerID, executionData, false)
}

func (t *TEEFulfiller) executeTrigger(ctx context.Context, neoflowHash string, triggerID *big.Int, executionData []byte, wait bool) (string, error) {
	nonce := t.nextNonce()

	// Use little-endian encoding to match .NET BigInteger.ToByteArray() in Neo N3 contracts
	message := append(bigIntToLittleEndian(triggerID), executionData...)
	message = append(message, bigIntToLittleEndian(nonce)...)

	signature, err := t.signer.Sign(ctx, message)
	if err != nil {
		return "", fmt.Errorf("sign trigger execution: %w", err)
	}

	params := []ContractParam{
		NewIntegerParam(triggerID),
		NewByteArrayParam(executionData),
		NewIntegerParam(nonce),
		NewByteArrayParam(signature),
	}

	txResult, err := t.invokeWithWait(ctx, neoflowHash, "executeTrigger", params, wait)
	if err != nil {
		return "", err
	}

	return txResult.TxHash, nil
}

// =============================================================================
// TEE Master Key Anchoring
// =============================================================================

// SetTEEMasterKey anchors the TEE master key to the Gateway contract.
// This is called during initial setup to register the TEE's master public key.
// Returns the transaction result after waiting for execution.
func (t *TEEFulfiller) SetTEEMasterKey(ctx context.Context, pubKey, pubKeyHash, attestHash []byte) (*TxResult, error) {
	return t.setTEEMasterKey(ctx, pubKey, pubKeyHash, attestHash, true)
}

// SetTEEMasterKeyNoWait anchors the TEE master key and returns once the transaction has been broadcast.
func (t *TEEFulfiller) SetTEEMasterKeyNoWait(ctx context.Context, pubKey, pubKeyHash, attestHash []byte) (*TxResult, error) {
	return t.setTEEMasterKey(ctx, pubKey, pubKeyHash, attestHash, false)
}

func (t *TEEFulfiller) setTEEMasterKey(ctx context.Context, pubKey, pubKeyHash, attestHash []byte, wait bool) (*TxResult, error) {
	nonce := t.nextNonce()

	// Use little-endian encoding to match .NET BigInteger.ToByteArray() in Neo N3 contracts
	nonceLE := bigIntToLittleEndian(nonce)
	message := make([]byte, 0, len(pubKey)+len(pubKeyHash)+len(attestHash)+len(nonceLE))
	message = append(message, pubKey...)
	message = append(message, pubKeyHash...)
	message = append(message, attestHash...)
	message = append(message, nonceLE...)

	signature, err := t.signer.Sign(ctx, message)
	if err != nil {
		return nil, fmt.Errorf("sign master key: %w", err)
	}

	params := []ContractParam{
		NewByteArrayParam(pubKey),
		NewByteArrayParam(pubKeyHash),
		NewByteArrayParam(attestHash),
		NewIntegerParam(nonce),
		NewByteArrayParam(signature),
	}

	txResult, err := t.invokeWithWait(ctx, t.gatewayHash, "setTEEMasterKey", params, wait)
	if err != nil {
		return nil, err
	}

	return txResult, nil
}

// InvokeContract invokes an arbitrary contract method using the fulfiller's signer account.
// This is useful for centralized chain writes from an enclave-managed signer.
func (t *TEEFulfiller) InvokeContract(ctx context.Context, contractHash, method string, params []ContractParam, wait bool) (*TxResult, error) {
	return t.invokeWithWait(ctx, contractHash, method, params, wait)
}

func safeInt64FromUint64(v uint64) (int64, error) {
	if v > uint64(math.MaxInt64) {
		return 0, fmt.Errorf("value %d overflows int64", v)
	}
	return int64(v), nil
}

// bigIntToLittleEndian converts a big.Int to little-endian byte array,
// matching .NET's BigInteger.ToByteArray() format used by Neo N3 contracts.
// This is critical for signature verification compatibility.
func bigIntToLittleEndian(n *big.Int) []byte {
	if n.Sign() == 0 {
		return []byte{0}
	}

	// Get big-endian bytes
	beBytes := n.Bytes()

	// Reverse to little-endian
	leBytes := make([]byte, len(beBytes))
	for i := 0; i < len(beBytes); i++ {
		leBytes[i] = beBytes[len(beBytes)-1-i]
	}

	// .NET BigInteger adds a 0x00 byte if the high bit is set (to indicate positive)
	// For positive numbers, if the high bit of the last byte (most significant in LE) is set,
	// we need to append 0x00
	if n.Sign() > 0 && leBytes[len(leBytes)-1]&0x80 != 0 {
		leBytes = append(leBytes, 0x00)
	}

	return leBytes
}

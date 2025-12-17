package chain

import (
	"context"
	"fmt"
	"math/big"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
)

// PriceFeedRecord mirrors the platform PriceFeed contract record layout.
// Fields are returned by the contract in this order:
// (round_id, price, timestamp, attestation_hash, sourceset_id).
type PriceFeedRecord struct {
	RoundID         *big.Int
	Price           *big.Int
	Timestamp       uint64
	AttestationHash []byte
	SourceSetID     *big.Int
}

// PriceFeedContract is a minimal wrapper for the platform PriceFeed contract.
// It anchors TEE-produced price updates on-chain.
type PriceFeedContract struct {
	client *Client
	hash   string
}

func NewPriceFeedContract(client *Client, hash string) *PriceFeedContract {
	return &PriceFeedContract{
		client: client,
		hash:   hash,
	}
}

func (c *PriceFeedContract) Hash() string {
	if c == nil {
		return ""
	}
	return c.hash
}

// GetLatest returns the latest anchored record for a symbol.
func (c *PriceFeedContract) GetLatest(ctx context.Context, symbol string) (*PriceFeedRecord, error) {
	if c == nil || c.client == nil {
		return nil, fmt.Errorf("pricefeed: client not configured")
	}
	if c.hash == "" {
		return nil, fmt.Errorf("pricefeed: contract hash not configured")
	}
	if symbol == "" {
		return nil, fmt.Errorf("pricefeed: symbol required")
	}

	res, err := c.client.InvokeFunction(ctx, c.hash, "getLatest", []ContractParam{NewStringParam(symbol)})
	if err != nil {
		return nil, err
	}
	if res == nil || len(res.Stack) == 0 {
		return nil, fmt.Errorf("pricefeed: empty stack")
	}

	items, err := ParseArray(res.Stack[0])
	if err != nil {
		return nil, err
	}
	if len(items) < 5 {
		return nil, fmt.Errorf("pricefeed: expected 5 fields, got %d", len(items))
	}

	roundID, err := ParseInteger(items[0])
	if err != nil {
		return nil, fmt.Errorf("pricefeed: parse round_id: %w", err)
	}
	price, err := ParseInteger(items[1])
	if err != nil {
		return nil, fmt.Errorf("pricefeed: parse price: %w", err)
	}
	ts, err := ParseInteger(items[2])
	if err != nil {
		return nil, fmt.Errorf("pricefeed: parse timestamp: %w", err)
	}
	att, err := ParseByteArray(items[3])
	if err != nil {
		return nil, fmt.Errorf("pricefeed: parse attestation_hash: %w", err)
	}
	sourceSetID, err := ParseInteger(items[4])
	if err != nil {
		return nil, fmt.Errorf("pricefeed: parse sourceset_id: %w", err)
	}

	return &PriceFeedRecord{
		RoundID:         roundID,
		Price:           price,
		Timestamp:       ts.Uint64(),
		AttestationHash: att,
		SourceSetID:     sourceSetID,
	}, nil
}

// Update writes a new anchored record for a symbol.
func (c *PriceFeedContract) Update(
	ctx context.Context,
	signer TxSigner,
	symbol string,
	roundID, price *big.Int,
	timestamp uint64,
	attestationHash []byte,
	sourceSetID *big.Int,
	wait bool,
) (*TxResult, error) {
	if c == nil || c.client == nil {
		return nil, fmt.Errorf("pricefeed: client not configured")
	}
	if c.hash == "" {
		return nil, fmt.Errorf("pricefeed: contract hash not configured")
	}
	if signer == nil {
		return nil, fmt.Errorf("pricefeed: signer not configured")
	}
	if symbol == "" {
		return nil, fmt.Errorf("pricefeed: symbol required")
	}
	if roundID == nil || roundID.Sign() <= 0 {
		return nil, fmt.Errorf("pricefeed: roundID required")
	}
	if price == nil || price.Sign() <= 0 {
		return nil, fmt.Errorf("pricefeed: price required")
	}
	if timestamp == 0 {
		return nil, fmt.Errorf("pricefeed: timestamp required")
	}
	if len(attestationHash) == 0 {
		return nil, fmt.Errorf("pricefeed: attestationHash required")
	}
	if sourceSetID == nil {
		sourceSetID = big.NewInt(0)
	}

	params := []ContractParam{
		NewStringParam(symbol),
		NewIntegerParam(roundID),
		NewIntegerParam(price),
		NewIntegerParam(new(big.Int).SetUint64(timestamp)),
		NewByteArrayParam(attestationHash),
		NewIntegerParam(sourceSetID),
	}

	return c.client.InvokeFunctionWithSignerAndWait(
		ctx,
		c.hash,
		"update",
		params,
		signer,
		transaction.CalledByEntry,
		wait,
	)
}

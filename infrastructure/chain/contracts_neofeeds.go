package chain

import (
	"context"
	"math/big"
)

// =============================================================================
// NeoFeeds Contract Interface (Push/Auto-Update Pattern)
// =============================================================================

// NeoFeedsContract provides interaction with the NeoFeedsService contract.
// This contract implements the Push pattern - TEE periodically updates prices.
type NeoFeedsContract struct {
	client       *Client
	contractHash string
	wallet       *Wallet
}

// NewNeoFeedsContract creates a new NeoFeeds contract interface.
func NewNeoFeedsContract(client *Client, contractHash string, wallet *Wallet) *NeoFeedsContract {
	return &NeoFeedsContract{
		client:       client,
		contractHash: contractHash,
		wallet:       wallet,
	}
}

// GetLatestPrice returns the latest price for a feed.
func (d *NeoFeedsContract) GetLatestPrice(ctx context.Context, feedID string) (*PriceData, error) {
	return InvokeStruct(ctx, d.client, d.contractHash, "getLatestPrice", ParsePriceData, NewStringParam(feedID))
}

// GetPrice returns the raw price value for a feed.
func (d *NeoFeedsContract) GetPrice(ctx context.Context, feedID string) (*big.Int, error) {
	return InvokeInt(ctx, d.client, d.contractHash, "getPrice", NewStringParam(feedID))
}

// GetPriceTimestamp returns the timestamp of the latest price update.
func (d *NeoFeedsContract) GetPriceTimestamp(ctx context.Context, feedID string) (uint64, error) {
	ts, err := InvokeInt(ctx, d.client, d.contractHash, "getPriceTimestamp", NewStringParam(feedID))
	if err != nil {
		return 0, err
	}
	return ts.Uint64(), nil
}

// IsPriceFresh checks if the price is within the staleness threshold.
func (d *NeoFeedsContract) IsPriceFresh(ctx context.Context, feedID string) (bool, error) {
	return InvokeBool(ctx, d.client, d.contractHash, "isPriceFresh", NewStringParam(feedID))
}

// GetFeedConfig returns the configuration for a price feed.
func (d *NeoFeedsContract) GetFeedConfig(ctx context.Context, feedID string) (*ContractFeedConfig, error) {
	return InvokeStruct(ctx, d.client, d.contractHash, "getFeedConfig", ParseFeedConfig, NewStringParam(feedID))
}

// IsTEEAccount checks if an account is a registered TEE account.
func (d *NeoFeedsContract) IsTEEAccount(ctx context.Context, account string) (bool, error) {
	return IsTEEAccount(ctx, d.client, d.contractHash, account)
}

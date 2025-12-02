// Package enclave provides TEE-protected data feed operations.
// Price aggregation and validation run inside the enclave.
//
// This package integrates with the Enclave SDK for unified TEE operations.
package enclave

import (
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"math/big"

	"github.com/R3E-Network/service_layer/system/enclave/sdk"
)

// EnclaveDataFeeds handles data feed operations within the TEE.
type EnclaveDataFeeds struct {
	*sdk.BaseEnclave
	feeds map[string]*FeedData
}

// FeedData represents signed feed data.
type FeedData struct {
	FeedID    string
	Value     *big.Int
	Timestamp int64
	Signature []byte
}

// DataFeedsConfig holds configuration for the data feeds enclave.
type DataFeedsConfig struct {
	ServiceID string
	RequestID string
	CallerID  string
	AccountID string
	SealKey   []byte
}

// NewEnclaveDataFeeds creates a new enclave data feeds handler.
func NewEnclaveDataFeeds() (*EnclaveDataFeeds, error) {
	base, err := sdk.NewBaseEnclave("datafeeds")
	if err != nil {
		return nil, err
	}
	return &EnclaveDataFeeds{
		BaseEnclave: base,
		feeds:       make(map[string]*FeedData),
	}, nil
}

// NewEnclaveDataFeedsWithSDK creates a data feeds handler with full SDK integration.
func NewEnclaveDataFeedsWithSDK(cfg *DataFeedsConfig) (*EnclaveDataFeeds, error) {
	baseCfg := &sdk.BaseConfig{
		ServiceID:   cfg.ServiceID,
		ServiceName: "datafeeds",
		RequestID:   cfg.RequestID,
		CallerID:    cfg.CallerID,
		AccountID:   cfg.AccountID,
		SealKey:     cfg.SealKey,
	}

	base, err := sdk.NewBaseEnclaveWithSDK(baseCfg)
	if err != nil {
		return nil, err
	}

	return &EnclaveDataFeeds{
		BaseEnclave: base,
		feeds:       make(map[string]*FeedData),
	}, nil
}

// InitializeWithSDK initializes the data feeds handler with an existing SDK instance.
func (e *EnclaveDataFeeds) InitializeWithSDK(enclaveSDK sdk.EnclaveSDK) error {
	return e.BaseEnclave.InitializeWithSDK(enclaveSDK)
}

// AggregateAndSign aggregates feed values and signs the result.
func (e *EnclaveDataFeeds) AggregateAndSign(feedID string, values []*big.Int, timestamp int64) (*FeedData, error) {
	e.Lock()
	defer e.Unlock()

	if len(values) == 0 {
		return nil, errors.New("no values to aggregate")
	}

	// Calculate median
	aggregated := values[len(values)/2]

	hash := sha256.New()
	hash.Write([]byte(feedID))
	hash.Write(aggregated.Bytes())
	hash.Write(big.NewInt(timestamp).Bytes())

	signingKey := e.GetSigningKey()
	r, s, err := ecdsa.Sign(rand.Reader, signingKey, hash.Sum(nil))
	if err != nil {
		return nil, err
	}

	feed := &FeedData{
		FeedID:    feedID,
		Value:     aggregated,
		Timestamp: timestamp,
		Signature: append(r.Bytes(), s.Bytes()...),
	}
	e.feeds[feedID] = feed
	return feed, nil
}

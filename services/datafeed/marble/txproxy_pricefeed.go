package neofeeds

import (
	"context"
	"fmt"
	"math/big"

	"github.com/google/uuid"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
	txproxytypes "github.com/R3E-Network/service_layer/infrastructure/txproxy/types"
)

func (s *Service) invokePriceFeedUpdate(
	ctx context.Context,
	symbol string,
	roundID, price *big.Int,
	timestamp uint64,
	sourceSetID *big.Int,
	wait bool,
) error {
	if s == nil {
		return fmt.Errorf("neofeeds: service is nil")
	}
	if s.txProxy == nil {
		return fmt.Errorf("neofeeds: txproxy not configured")
	}
	if s.priceFeedAddress == "" {
		return fmt.Errorf("neofeeds: pricefeed address not configured")
	}
	if symbol == "" {
		return fmt.Errorf("neofeeds: symbol required")
	}
	if roundID == nil || roundID.Sign() <= 0 {
		return fmt.Errorf("neofeeds: roundID required")
	}
	if price == nil || price.Sign() <= 0 {
		return fmt.Errorf("neofeeds: price required")
	}
	if timestamp == 0 {
		return fmt.Errorf("neofeeds: timestamp required")
	}
	if len(s.attestationHash) == 0 {
		return fmt.Errorf("neofeeds: attestation hash missing")
	}

	params := priceFeedUpdateParams(symbol, roundID, price, timestamp, s.attestationHash, sourceSetID)
	req := txproxytypes.InvokeRequest{
		RequestID:       "neofeeds:" + uuid.NewString(),
		ContractAddress: s.priceFeedAddress,
		Method:          "update",
		Params:          params,
		Wait:            wait,
	}
	_, err := s.txProxy.Invoke(ctx, &req)
	return err
}

func priceFeedUpdateParams(
	symbol string,
	roundID, price *big.Int,
	timestamp uint64,
	attestationHash []byte,
	sourceSetID *big.Int,
) []chain.ContractParam {
	if sourceSetID == nil {
		sourceSetID = big.NewInt(0)
	}

	ts := new(big.Int).SetUint64(timestamp)

	return []chain.ContractParam{
		chain.NewStringParam(symbol),
		chain.NewIntegerParam(roundID),
		chain.NewIntegerParam(price),
		chain.NewIntegerParam(ts),
		chain.NewByteArrayParam(attestationHash),
		chain.NewIntegerParam(sourceSetID),
	}
}

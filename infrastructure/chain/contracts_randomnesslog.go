package chain

import (
	"context"
	"fmt"
	"math/big"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
)

// RandomnessLogContract is a minimal wrapper for the platform RandomnessLog contract.
// It anchors enclave-generated randomness on-chain along with an attestation hash.
type RandomnessLogContract struct {
	client *Client
	hash   string
}

func NewRandomnessLogContract(client *Client, hash string) *RandomnessLogContract {
	return &RandomnessLogContract{
		client: client,
		hash:   hash,
	}
}

func (c *RandomnessLogContract) Hash() string {
	if c == nil {
		return ""
	}
	return c.hash
}

// Record writes a randomness record to the on-chain RandomnessLog contract.
func (c *RandomnessLogContract) Record(
	ctx context.Context,
	signer TxSigner,
	requestID, randomness, attestationHash []byte,
	timestamp uint64,
	wait bool,
) (*TxResult, error) {
	if c == nil || c.client == nil {
		return nil, fmt.Errorf("randomnesslog: client not configured")
	}
	if c.hash == "" {
		return nil, fmt.Errorf("randomnesslog: contract hash not configured")
	}
	if signer == nil {
		return nil, fmt.Errorf("randomnesslog: signer not configured")
	}
	if len(requestID) == 0 {
		return nil, fmt.Errorf("randomnesslog: requestID required")
	}
	if len(randomness) == 0 {
		return nil, fmt.Errorf("randomnesslog: randomness required")
	}
	if len(attestationHash) == 0 {
		return nil, fmt.Errorf("randomnesslog: attestationHash required")
	}
	if timestamp == 0 {
		return nil, fmt.Errorf("randomnesslog: timestamp required")
	}

	params := []ContractParam{
		NewByteArrayParam(requestID),
		NewByteArrayParam(randomness),
		NewByteArrayParam(attestationHash),
		NewIntegerParam(new(big.Int).SetUint64(timestamp)),
	}

	return c.client.InvokeFunctionWithSignerAndWait(
		ctx,
		c.hash,
		"Record",
		params,
		signer,
		transaction.CalledByEntry,
		wait,
	)
}


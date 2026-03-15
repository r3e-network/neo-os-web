package chain

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
)

// ServiceLayerGatewayContract is a minimal wrapper for the ServiceLayerGateway contract.
// It coordinates on-chain service requests and callbacks to MiniApp contracts.
type ServiceLayerGatewayContract struct {
	client *Client
	hash   string
}

func NewServiceLayerGatewayContract(client *Client, hash string) *ServiceLayerGatewayContract {
	return &ServiceLayerGatewayContract{
		client: client,
		hash:   hash,
	}
}

func (c *ServiceLayerGatewayContract) Hash() string {
	if c == nil {
		return ""
	}
	return c.hash
}

// RequestService submits a service request (primarily for testing; normally called by MiniApp contracts).
func (c *ServiceLayerGatewayContract) RequestService(
	ctx context.Context,
	signer TxSigner,
	appID, serviceType string,
	payload []byte,
	callbackContractHash160, callbackMethod string,
	wait bool,
) (*TxResult, error) {
	if c == nil || c.client == nil {
		return nil, fmt.Errorf("servicegateway: client not configured")
	}
	if c.hash == "" {
		return nil, fmt.Errorf("servicegateway: contract hash not configured")
	}
	if signer == nil {
		return nil, fmt.Errorf("servicegateway: signer not configured")
	}
	if strings.TrimSpace(appID) == "" {
		return nil, fmt.Errorf("servicegateway: appID required")
	}
	if strings.TrimSpace(serviceType) == "" {
		return nil, fmt.Errorf("servicegateway: serviceType required")
	}
	if strings.TrimSpace(callbackContractHash160) == "" {
		return nil, fmt.Errorf("servicegateway: callback contract required")
	}
	if strings.TrimSpace(callbackMethod) == "" {
		return nil, fmt.Errorf("servicegateway: callback method required")
	}

	params := []ContractParam{
		NewStringParam(appID),
		NewStringParam(serviceType),
		NewByteArrayParam(payload),
		NewHash160Param(callbackContractHash160),
		NewStringParam(callbackMethod),
	}

	return c.client.InvokeFunctionWithSignerAndWait(
		ctx,
		c.hash,
		"requestService",
		params,
		signer,
		transaction.CalledByEntry,
		wait,
	)
}

// FulfillRequest finalizes a pending service request and triggers the callback.
func (c *ServiceLayerGatewayContract) FulfillRequest(
	ctx context.Context,
	signer TxSigner,
	requestID *big.Int,
	success bool,
	result []byte,
	errorMessage string,
	wait bool,
) (*TxResult, error) {
	if c == nil || c.client == nil {
		return nil, fmt.Errorf("servicegateway: client not configured")
	}
	if c.hash == "" {
		return nil, fmt.Errorf("servicegateway: contract hash not configured")
	}
	if signer == nil {
		return nil, fmt.Errorf("servicegateway: signer not configured")
	}
	if requestID == nil || requestID.Sign() <= 0 {
		return nil, fmt.Errorf("servicegateway: requestID required")
	}

	params := []ContractParam{
		NewIntegerParam(requestID),
		NewBoolParam(success),
		NewByteArrayParam(result),
		NewStringParam(errorMessage),
	}

	return c.client.InvokeFunctionWithSignerAndWait(
		ctx,
		c.hash,
		"fulfillRequest",
		params,
		signer,
		transaction.CalledByEntry,
		wait,
	)
}

// SetUpdater sets the authorized updater address for fulfillment calls.
func (c *ServiceLayerGatewayContract) SetUpdater(ctx context.Context, signer TxSigner, updaterHash160 string, wait bool) (*TxResult, error) {
	if c == nil || c.client == nil {
		return nil, fmt.Errorf("servicegateway: client not configured")
	}
	if c.hash == "" {
		return nil, fmt.Errorf("servicegateway: contract hash not configured")
	}
	if signer == nil {
		return nil, fmt.Errorf("servicegateway: signer not configured")
	}
	if strings.TrimSpace(updaterHash160) == "" {
		return nil, fmt.Errorf("servicegateway: updater required")
	}

	return c.client.InvokeFunctionWithSignerAndWait(
		ctx,
		c.hash,
		"setUpdater",
		[]ContractParam{NewHash160Param(updaterHash160)},
		signer,
		transaction.CalledByEntry,
		wait,
	)
}

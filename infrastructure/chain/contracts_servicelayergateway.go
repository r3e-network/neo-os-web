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
	client  *Client
	address string
}

func NewServiceLayerGatewayContract(client *Client, contractAddress string) *ServiceLayerGatewayContract {
	return &ServiceLayerGatewayContract{
		client:  client,
		address: contractAddress,
	}
}

func (c *ServiceLayerGatewayContract) Address() string {
	if c == nil {
		return ""
	}
	return c.address
}

// RequestService submits a service request (primarily for testing; normally called by MiniApp contracts).
func (c *ServiceLayerGatewayContract) RequestService(
	ctx context.Context,
	signer TxSigner,
	appID, serviceType string,
	payload []byte,
	callbackContractAddress, callbackMethod string,
	wait bool,
) (*TxResult, error) {
	if c == nil || c.client == nil {
		return nil, fmt.Errorf("servicegateway: client not configured")
	}
	if c.address == "" {
		return nil, fmt.Errorf("servicegateway: contract address not configured")
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
	if strings.TrimSpace(callbackContractAddress) == "" {
		return nil, fmt.Errorf("servicegateway: callback contract required")
	}
	if strings.TrimSpace(callbackMethod) == "" {
		return nil, fmt.Errorf("servicegateway: callback method required")
	}

	params := []ContractParam{
		NewStringParam(appID),
		NewStringParam(serviceType),
		NewByteArrayParam(payload),
		NewHash160Param(callbackContractAddress),
		NewStringParam(callbackMethod),
	}

	return c.client.InvokeFunctionWithSignerAndWait(
		ctx,
		c.address,
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
	if c.address == "" {
		return nil, fmt.Errorf("servicegateway: contract address not configured")
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
		c.address,
		"fulfillRequest",
		params,
		signer,
		transaction.CalledByEntry,
		wait,
	)
}

// SetUpdater sets the authorized updater address for fulfillment calls.
func (c *ServiceLayerGatewayContract) SetUpdater(ctx context.Context, signer TxSigner, updaterAddress string, wait bool) (*TxResult, error) {
	if c == nil || c.client == nil {
		return nil, fmt.Errorf("servicegateway: client not configured")
	}
	if c.address == "" {
		return nil, fmt.Errorf("servicegateway: contract address not configured")
	}
	if signer == nil {
		return nil, fmt.Errorf("servicegateway: signer not configured")
	}
	if strings.TrimSpace(updaterAddress) == "" {
		return nil, fmt.Errorf("servicegateway: updater required")
	}

	return c.client.InvokeFunctionWithSignerAndWait(
		ctx,
		c.address,
		"setUpdater",
		[]ContractParam{NewHash160Param(updaterAddress)},
		signer,
		transaction.CalledByEntry,
		wait,
	)
}

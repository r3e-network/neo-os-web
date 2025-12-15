// Package service provides shared service infrastructure.
package service

import (
	"context"
	"encoding/hex"
	"fmt"
	"math/big"

	gsclient "github.com/R3E-Network/service_layer/services/globalsigner/client"
	txclient "github.com/R3E-Network/service_layer/services/txsubmitter/client"
)

// =============================================================================
// Base TxSubmitter Adapter
// =============================================================================

// BaseTxAdapter provides common TxSubmitter client operations.
// Services can embed this to avoid duplicating client nil checks and error handling.
type BaseTxAdapter struct {
	TxClient *txclient.Client
}

// FulfillRequest submits a fulfill request via TxSubmitter.
func (a *BaseTxAdapter) FulfillRequest(ctx context.Context, requestID *big.Int, resultBytes []byte) (string, error) {
	if a.TxClient == nil {
		return "", fmt.Errorf("txsubmitter client not configured")
	}

	resp, err := a.TxClient.FulfillRequest(ctx, requestID.String(), hex.EncodeToString(resultBytes))
	if err != nil {
		return "", fmt.Errorf("fulfill request: %w", err)
	}

	if resp.Error != "" {
		return "", fmt.Errorf("txsubmitter error: %s", resp.Error)
	}

	return resp.TxHash, nil
}

// FailRequest submits a fail request via TxSubmitter.
func (a *BaseTxAdapter) FailRequest(ctx context.Context, requestID *big.Int, errorMsg string) (string, error) {
	if a.TxClient == nil {
		return "", fmt.Errorf("txsubmitter client not configured")
	}

	resp, err := a.TxClient.FailRequest(ctx, requestID.String(), errorMsg)
	if err != nil {
		return "", fmt.Errorf("fail request: %w", err)
	}

	if resp.Error != "" {
		return "", fmt.Errorf("txsubmitter error: %s", resp.Error)
	}

	return resp.TxHash, nil
}

// IsConfigured returns true if the TxSubmitter client is configured.
func (a *BaseTxAdapter) IsConfigured() bool {
	return a.TxClient != nil
}

// =============================================================================
// Base GlobalSigner Adapter
// =============================================================================

// BaseSignerAdapter provides common GlobalSigner client operations.
type BaseSignerAdapter struct {
	GSClient *gsclient.Client
}

// Sign signs data with a domain prefix using GlobalSigner.
func (a *BaseSignerAdapter) Sign(ctx context.Context, domain string, data []byte) ([]byte, string, error) {
	if a.GSClient == nil {
		return nil, "", fmt.Errorf("globalsigner client not configured")
	}

	resp, err := a.GSClient.Sign(ctx, &gsclient.SignRequest{
		Domain: domain,
		Data:   hex.EncodeToString(data),
	})
	if err != nil {
		return nil, "", fmt.Errorf("sign: %w", err)
	}

	sig, err := hex.DecodeString(resp.Signature)
	if err != nil {
		return nil, "", fmt.Errorf("decode signature: %w", err)
	}

	return sig, resp.KeyVersion, nil
}

// GetPublicKey gets the current signer public key.
func (a *BaseSignerAdapter) GetPublicKey(ctx context.Context) (string, string, error) {
	if a.GSClient == nil {
		return "", "", fmt.Errorf("globalsigner client not configured")
	}

	att, err := a.GSClient.GetAttestation(ctx)
	if err != nil {
		return "", "", fmt.Errorf("get attestation: %w", err)
	}

	return att.PubKeyHex, att.KeyVersion, nil
}

// IsConfigured returns true if the GlobalSigner client is configured.
func (a *BaseSignerAdapter) IsConfigured() bool {
	return a.GSClient != nil
}

// =============================================================================
// Combined Service Adapter
// =============================================================================

// ServiceAdapter combines TxSubmitter and GlobalSigner adapters.
// Services that need both can embed this instead of creating their own.
type ServiceAdapter struct {
	BaseTxAdapter
	BaseSignerAdapter
}

// NewServiceAdapter creates a new combined adapter.
func NewServiceAdapter(txClient *txclient.Client, gsClient *gsclient.Client) *ServiceAdapter {
	return &ServiceAdapter{
		BaseTxAdapter:     BaseTxAdapter{TxClient: txClient},
		BaseSignerAdapter: BaseSignerAdapter{GSClient: gsClient},
	}
}

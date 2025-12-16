// Package neovaultmarble provides privacy-preserving transaction mixing service.
package neovaultmarble

import (
	"context"
	"encoding/hex"
	"fmt"

	commonservice "github.com/R3E-Network/service_layer/services/common/service"
	gsclient "github.com/R3E-Network/service_layer/services/globalsigner/client"
	txclient "github.com/R3E-Network/service_layer/services/txsubmitter/client"
)

// =============================================================================
// TxSubmitter + GlobalSigner Adapter
// =============================================================================

// ServiceAdapter wraps TxSubmitter and GlobalSigner clients for NeoVault operations.
// This replaces direct TEEFulfiller and masterKey usage.
type ServiceAdapter struct {
	commonservice.BaseTxAdapter
	commonservice.BaseSignerAdapter
}

// NewServiceAdapter creates a new adapter for NeoVault.
func NewServiceAdapter(txClient *txclient.Client, gsClient *gsclient.Client) *ServiceAdapter {
	return &ServiceAdapter{
		BaseTxAdapter:     commonservice.BaseTxAdapter{TxClient: txClient},
		BaseSignerAdapter: commonservice.BaseSignerAdapter{GSClient: gsClient},
	}
}

// =============================================================================
// GlobalSigner Integration (Proof Signing)
// =============================================================================

// SignRequestProof signs a request proof using GlobalSigner.
// This replaces local masterKey signing.
func (a *ServiceAdapter) SignRequestProof(ctx context.Context, requestHash []byte) ([]byte, string, error) {
	return a.BaseSignerAdapter.Sign(ctx, "neovault:request", requestHash)
}

// SignCompletionProof signs a completion proof using GlobalSigner.
func (a *ServiceAdapter) SignCompletionProof(ctx context.Context, completionHash []byte) ([]byte, string, error) {
	return a.BaseSignerAdapter.Sign(ctx, "neovault:completion", completionHash)
}

// GetSignerPublicKey gets the current signer public key for verification.
func (a *ServiceAdapter) GetSignerPublicKey(ctx context.Context) (string, string, error) {
	return a.BaseSignerAdapter.GetPublicKey(ctx)
}

// =============================================================================
// TxSubmitter Integration (Chain Operations)
// =============================================================================

// ResolveDispute submits a dispute resolution via TxSubmitter.
func (a *ServiceAdapter) ResolveDispute(ctx context.Context, requestHash []byte, completionProof []byte) (string, error) {
	if a.TxClient == nil {
		return "", fmt.Errorf("txsubmitter client not configured")
	}

	resp, err := a.TxClient.ResolveDispute(ctx, hex.EncodeToString(requestHash), hex.EncodeToString(completionProof))
	if err != nil {
		return "", fmt.Errorf("resolve dispute: %w", err)
	}

	if resp.Error != "" {
		return "", fmt.Errorf("txsubmitter error: %s", resp.Error)
	}

	return resp.TxHash, nil
}

// =============================================================================
// Service Integration
// =============================================================================

// SetServiceAdapter sets the service adapter for chain and signing operations.
func (s *Service) SetServiceAdapter(adapter *ServiceAdapter) {
	s.serviceAdapter = adapter
}

// SetTxSubmitterClient sets the TxSubmitter client.
func (s *Service) SetTxSubmitterClient(client *txclient.Client) {
	if s.serviceAdapter == nil {
		s.serviceAdapter = &ServiceAdapter{}
	}
	s.serviceAdapter.TxClient = client
}

// SetGlobalSignerClient sets the GlobalSigner client.
func (s *Service) SetGlobalSignerClient(client *gsclient.Client) {
	if s.serviceAdapter == nil {
		s.serviceAdapter = &ServiceAdapter{}
	}
	s.serviceAdapter.GSClient = client
}

// signRequestProofViaGlobalSigner signs using GlobalSigner instead of local key.
func (s *Service) signRequestProofViaGlobalSigner(ctx context.Context, requestHash []byte) ([]byte, string, error) {
	if s.serviceAdapter == nil || s.serviceAdapter.GSClient == nil {
		// Fallback to local signing
		return s.signWithMasterKey(requestHash)
	}
	return s.serviceAdapter.SignRequestProof(ctx, requestHash)
}

// signCompletionProofViaGlobalSigner signs using GlobalSigner instead of local key.
func (s *Service) signCompletionProofViaGlobalSigner(ctx context.Context, completionHash []byte) ([]byte, string, error) {
	if s.serviceAdapter == nil || s.serviceAdapter.GSClient == nil {
		// Fallback to local signing
		return s.signWithMasterKey(completionHash)
	}
	return s.serviceAdapter.SignCompletionProof(ctx, completionHash)
}

// signWithMasterKey is the legacy local signing method.
func (s *Service) signWithMasterKey(data []byte) ([]byte, string, error) {
	if len(s.masterKey) == 0 {
		return nil, "", fmt.Errorf("master key not configured")
	}
	// Legacy signing implementation would go here
	return nil, "local", fmt.Errorf("legacy signing not implemented - use GlobalSigner")
}

// Package service provides shared service infrastructure.
package service

import (
	"context"
	"encoding/hex"
	"fmt"

	gsclient "github.com/R3E-Network/service_layer/infrastructure/globalsigner/client"
)

// =============================================================================
// Base GlobalSigner Adapter
// =============================================================================

// BaseSignerAdapter provides common GlobalSigner client operations.
type BaseSignerAdapter struct {
	GSClient *gsclient.Client
}

// Sign signs data with a domain prefix using GlobalSigner.
func (a *BaseSignerAdapter) Sign(ctx context.Context, domain string, data []byte) (signature []byte, keyVersion string, err error) {
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
func (a *BaseSignerAdapter) GetPublicKey(ctx context.Context) (pubKeyHex, keyVersion string, err error) {
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

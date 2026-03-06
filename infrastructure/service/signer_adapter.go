// Package service provides shared service infrastructure.
package service

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"

	gsclient "github.com/r3e-network/neo-miniapp-platform/infrastructure/globalsigner/client"
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
		return nil, "", wrapGlobalSignerAdapterError("sign", err)
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
		return "", "", wrapGlobalSignerAdapterError("get attestation", err)
	}

	return att.PubKeyHex, att.KeyVersion, nil
}

// IsConfigured returns true if the GlobalSigner client is configured.
func (a *BaseSignerAdapter) IsConfigured() bool {
	return a.GSClient != nil
}

func wrapGlobalSignerAdapterError(operation string, err error) error {
	if err == nil {
		return nil
	}

	statusCode, ok := globalSignerAdapterStatusCode(err)
	if !ok {
		return fmt.Errorf("%s: %w", operation, err)
	}

	switch {
	case statusCode == http.StatusNotFound:
		return fmt.Errorf("%s endpoint not found: %w", operation, err)
	case statusCode >= http.StatusBadRequest && statusCode < http.StatusInternalServerError:
		return fmt.Errorf("%s request rejected: %w", operation, err)
	case statusCode >= http.StatusInternalServerError:
		return fmt.Errorf("%s service unavailable: %w", operation, err)
	default:
		return fmt.Errorf("%s: %w", operation, err)
	}
}

func globalSignerAdapterStatusCode(err error) (int, bool) {
	var httpErr *gsclient.HTTPError
	if !errors.As(err, &httpErr) {
		return 0, false
	}
	return httpErr.StatusCode, true
}

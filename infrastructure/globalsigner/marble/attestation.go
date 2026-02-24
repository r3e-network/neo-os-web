package globalsigner

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/edgelesssys/ego/enclave"
)

// buildAttestation generates an attestation for a key version.
func (s *Service) buildAttestation(ctx context.Context, version, pubKeyHex, pubKeyHash string) (*MasterKeyAttestation, error) {
	if strings.TrimSpace(version) == "" {
		return nil, fmt.Errorf("key version is required")
	}
	if strings.TrimSpace(pubKeyHex) == "" || strings.TrimSpace(pubKeyHash) == "" {
		return nil, fmt.Errorf("key version %s missing attestation metadata", version)
	}

	att := &MasterKeyAttestation{
		KeyVersion: version,
		PubKeyHex:  pubKeyHex,
		PubKeyHash: pubKeyHash,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		Simulated:  !s.Marble().IsEnclave(),
	}

	// Generate SGX quote if in enclave mode
	if s.Marble().IsEnclave() {
		quote, report, err := s.generateQuote(pubKeyHash)
		if err != nil {
			if s.requireQuote {
				return nil, fmt.Errorf("generate SGX quote: %w", err)
			}
			s.Logger().Warn(ctx, "Failed to generate SGX quote", map[string]interface{}{
				"error":       err.Error(),
				"key_version": version,
			})
		} else {
			att.Quote = quote
			att.MRENCLAVE = report.MRENCLAVE
			att.MRSIGNER = report.MRSIGNER
			att.ProdID = report.ProdID
			att.ISVSVN = report.ISVSVN
		}
	}

	return att, nil
}

// SGXReport holds parsed SGX report fields.
type SGXReport struct {
	MRENCLAVE string
	MRSIGNER  string
	ProdID    uint16
	ISVSVN    uint16
}

// generateQuote generates an SGX quote with the given report data.
// Returns error in simulation mode; uses EGo's enclave.GetRemoteReport in SGX hardware mode.
func (s *Service) generateQuote(reportData string) (string, *SGXReport, error) {
	payload := strings.TrimSpace(reportData)
	payload = strings.TrimPrefix(payload, "0x")
	payload = strings.TrimPrefix(payload, "0X")

	userData := []byte(payload)
	if decoded, err := hex.DecodeString(payload); err == nil && len(decoded) > 0 {
		userData = decoded
	}

	if len(userData) > 64 {
		userData = userData[:64]
	}
	if len(userData) < 64 {
		padded := make([]byte, 64)
		copy(padded, userData)
		userData = padded
	}

	quote, err := enclave.GetRemoteReport(userData)
	if err != nil {
		return "", nil, err
	}
	report, err := enclave.VerifyRemoteReport(quote)
	if err != nil {
		return "", nil, err
	}

	out := &SGXReport{
		MRENCLAVE: base64.StdEncoding.EncodeToString(report.UniqueID),
		MRSIGNER:  base64.StdEncoding.EncodeToString(report.SignerID),
	}
	if len(report.ProductID) >= 2 {
		out.ProdID = uint16(report.ProductID[1])<<8 | uint16(report.ProductID[0])
	}
	if report.SecurityVersion <= math.MaxUint16 {
		out.ISVSVN = uint16(report.SecurityVersion)
	}

	return base64.StdEncoding.EncodeToString(quote), out, nil
}

// GetAttestation returns the attestation for the active key.
func (s *Service) GetAttestation(ctx context.Context) (*MasterKeyAttestation, error) {
	version := s.ActiveVersion()
	if version == "" {
		return nil, fmt.Errorf("no active key version")
	}
	s.mu.RLock()
	entry, ok := s.keys[version]
	if !ok {
		s.mu.RUnlock()
		return nil, fmt.Errorf("key version not found: %s", version)
	}
	pubKeyHex := entry.version.PubKeyHex
	pubKeyHash := entry.version.PubKeyHash
	s.mu.RUnlock()

	return s.buildAttestation(ctx, version, pubKeyHex, pubKeyHash)
}

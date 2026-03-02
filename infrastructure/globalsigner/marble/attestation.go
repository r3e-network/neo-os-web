package globalsigner

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// buildAttestation generates a TEE attestation for a key version.
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

	if !s.Marble().IsEnclave() {
		return att, nil
	}

	report, err := s.Marble().Attest([]byte(pubKeyHash))
	if err != nil {
		if s.requireAttestation {
			return nil, fmt.Errorf("build attestation evidence: %w", err)
		}
		s.Logger().Warn(ctx, "Failed to build attestation evidence", map[string]interface{}{
			"error":       err.Error(),
			"key_version": version,
		})
		return att, nil
	}

	att.Provider = report.Provider
	att.EvidenceFormat = report.Format
	att.Evidence = report.Document
	att.ModuleID = report.ModuleID
	if len(report.PCRs) > 0 {
		att.PCRs = make(map[string]string, len(report.PCRs))
		for k, v := range report.PCRs {
			att.PCRs[k] = v
		}
	}

	// Deprecated compatibility fields for older consumers.
	if report.Quote != "" || report.MRENCLAVE != "" || report.MRSIGNER != "" || report.ProdID != 0 || report.ISVSVN != 0 {
		att.Quote = report.Quote
		att.MRENCLAVE = report.MRENCLAVE
		att.MRSIGNER = report.MRSIGNER
		att.ProdID = report.ProdID
		att.ISVSVN = report.ISVSVN
	}

	return att, nil
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

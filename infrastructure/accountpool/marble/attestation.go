package neoaccounts

import (
	"time"
)

func (s *Service) buildMasterKeyAttestation() MasterKeyAttestation {
	summary := s.masterKeySummary()
	att := MasterKeyAttestation{
		Hash:      summary.Hash,
		PubKey:    summary.PubKeyHex,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Source:    "neoaccounts",
		Simulated: !s.Marble().IsEnclave(),
	}

	// Only produce attestation evidence when running inside a TEE backend.
	if !s.Marble().IsEnclave() {
		return att
	}

	report, err := s.Marble().Attest([]byte(summary.Hash))
	if err != nil {
		return att
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

	// Deprecated compatibility fields for older clients.
	if report.Quote != "" || report.MRENCLAVE != "" || report.MRSIGNER != "" || report.ProdID != 0 || report.ISVSVN != 0 {
		att.Quote = report.Quote
		att.MRENCLAVE = report.MRENCLAVE
		att.MRSIGNER = report.MRSIGNER
		att.ProdID = report.ProdID
		att.ISVSVN = report.ISVSVN
	}

	return att
}

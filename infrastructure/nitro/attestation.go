package nitro

import (
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"strconv"
	"strings"
	"time"
)

// TEEProvider identifies the active confidential-computing backend.
type TEEProvider string

const (
	TEEProviderNitro TEEProvider = "nitro"
)

// AttestationReport is a provider-neutral attestation payload.
// Legacy quote-shaped fields are retained for backward compatibility with existing clients.
type AttestationReport struct {
	Provider  string            `json:"provider,omitempty"`
	Format    string            `json:"format,omitempty"`
	Document  string            `json:"document,omitempty"`
	ModuleID  string            `json:"module_id,omitempty"`
	PCRs      map[string]string `json:"pcrs,omitempty"`
	Claims    map[string]string `json:"claims,omitempty"`
	Timestamp string            `json:"timestamp,omitempty"`

	// Deprecated compatibility fields.
	Quote     string `json:"quote,omitempty"`
	MRENCLAVE string `json:"mrenclave,omitempty"`
	MRSIGNER  string `json:"mrsigner,omitempty"`
	ProdID    uint16 `json:"prod_id,omitempty"`
	ISVSVN    uint16 `json:"isvsvn,omitempty"`
}

func (r *AttestationReport) clone() *AttestationReport {
	if r == nil {
		return nil
	}
	out := *r
	if len(r.PCRs) > 0 {
		out.PCRs = make(map[string]string, len(r.PCRs))
		for k, v := range r.PCRs {
			out.PCRs[k] = v
		}
	}
	if len(r.Claims) > 0 {
		out.Claims = make(map[string]string, len(r.Claims))
		for k, v := range r.Claims {
			out.Claims[k] = v
		}
	}
	return &out
}

//nolint:unparam // detectTEEProvider may support more providers in the future
func detectTEEProvider() TEEProvider {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("TEE_BACKEND"))) {
	case "nitro", "aws-nitro", "aws_nitro":
		return TEEProviderNitro
	}

	if strings.TrimSpace(os.Getenv("NITRO_ATTESTATION_DOCUMENT_B64")) != "" {
		return TEEProviderNitro
	}

	return TEEProviderNitro
}

func detectInitialReport(provider TEEProvider) *AttestationReport {
	switch provider {
	case TEEProviderNitro:
		report := &AttestationReport{
			Provider: string(TEEProviderNitro),
			Format:   "aws_nitro_attestation_document",
			Document: strings.TrimSpace(os.Getenv("NITRO_ATTESTATION_DOCUMENT_B64")),
			ModuleID: strings.TrimSpace(os.Getenv("NITRO_MODULE_ID")),
			PCRs:     loadNitroPCRs(),
		}
		return report
	default:
		return nil
	}
}

func loadNitroPCRs() map[string]string {
	out := make(map[string]string)
	for i := 0; i <= 31; i++ {
		key := fmt.Sprintf("NITRO_PCR%d", i)
		if v := strings.TrimSpace(os.Getenv(key)); v != "" {
			out[strconv.Itoa(i)] = v
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func normalizeReportData(userData []byte) []byte {
	if len(userData) > 64 {
		userData = userData[:64]
	}
	if len(userData) == 64 {
		out := make([]byte, 64)
		copy(out, userData)
		return out
	}
	out := make([]byte, 64)
	copy(out, userData)
	return out
}

// Provider returns the configured TEE provider for this nitro.
func (m *Nitro) Provider() TEEProvider {
	if m == nil {
		return TEEProviderNitro
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.provider
}

// IsTEE returns true when TEE runtime signals are present.
//
// This is intentionally stricter than checking only TEE_BACKEND so local
// developer flows can select a backend without triggering strict enclave-only
// guards when no enclave runtime is actually available.
func (m *Nitro) IsTEE() bool {
	if m == nil {
		return false
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	switch m.provider {
	case TEEProviderNitro:
		if m.report != nil && strings.TrimSpace(m.report.Document) != "" {
			return true
		}
		// Nitro enclaves expose /dev/nsm.
		if _, err := os.Stat("/dev/nsm"); err == nil {
			return true
		} else if !errors.Is(err, fs.ErrNotExist) {
			// Be conservative for unusual filesystem errors.
			return true
		}
		return false
	default:
		return false
	}
}

// Attest returns provider-specific attestation evidence bound to caller data.
func (m *Nitro) Attest(userData []byte) (*AttestationReport, error) {
	if m == nil {
		return nil, fmt.Errorf("nitro is nil")
	}

	m.mu.RLock()
	provider := m.provider
	base := m.report.clone()
	m.mu.RUnlock()

	if base == nil {
		return nil, fmt.Errorf("nitro attestation evidence is not available")
	}

	if base.Timestamp == "" {
		base.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	normalized := normalizeReportData(userData)
	if len(normalized) > 0 {
		if base.Claims == nil {
			base.Claims = make(map[string]string)
		}
		base.Claims["report_data_hex"] = hex.EncodeToString(normalized)
		if provider == TEEProviderNitro {
			base.Claims["user_data_hex"] = base.Claims["report_data_hex"]
		}
	}

	if provider == TEEProviderNitro {
		if nsmReport, nsmErr := attestNitroWithNSM(normalized); nsmErr == nil && nsmReport != nil {
			base.Provider = nsmReport.Provider
			base.Format = nsmReport.Format
			base.Document = nsmReport.Document
			base.ModuleID = nsmReport.ModuleID
			base.PCRs = nsmReport.PCRs
			if nsmReport.Timestamp != "" {
				base.Timestamp = nsmReport.Timestamp
			}
			if base.Claims == nil {
				base.Claims = make(map[string]string)
			}
			base.Claims["nitro_source"] = "nsm"
		} else if nsmErr != nil {
			if base.Claims == nil {
				base.Claims = make(map[string]string)
			}
			base.Claims["nitro_source"] = "env"
			base.Claims["nitro_nsm_error"] = nsmErr.Error()
		}
		if strings.TrimSpace(base.Document) == "" {
			return nil, fmt.Errorf("nitro attestation document is not available")
		}
	}

	return base, nil
}

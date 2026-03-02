package marble

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
	TEEProviderSimulation TEEProvider = "sim"
	TEEProviderSGX        TEEProvider = "sgx"
	TEEProviderNitro      TEEProvider = "nitro"
)

// AttestationReport is a provider-neutral attestation payload with legacy SGX fields.
// It is intentionally permissive to preserve backward compatibility while supporting Nitro.
type AttestationReport struct {
	Provider  string            `json:"provider,omitempty"`
	Format    string            `json:"format,omitempty"`
	Document  string            `json:"document,omitempty"`
	ModuleID  string            `json:"module_id,omitempty"`
	PCRs      map[string]string `json:"pcrs,omitempty"`
	Claims    map[string]string `json:"claims,omitempty"`
	Timestamp string            `json:"timestamp,omitempty"`

	// Legacy SGX fields kept for existing clients.
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

func detectTEEProvider() TEEProvider {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("TEE_BACKEND"))) {
	case "nitro", "aws-nitro", "aws_nitro":
		return TEEProviderNitro
	case "sgx":
		return TEEProviderSGX
	case "sim", "simulation", "none", "disabled":
		return TEEProviderSimulation
	}

	if strings.TrimSpace(os.Getenv("NITRO_ATTESTATION_DOCUMENT_B64")) != "" {
		return TEEProviderNitro
	}

	if strings.TrimSpace(os.Getenv("OE_SIMULATION")) == "0" || strings.TrimSpace(os.Getenv("SGX_QUOTE_B64")) != "" {
		return TEEProviderSGX
	}

	return TEEProviderSimulation
}

func detectInitialReport(provider TEEProvider) *AttestationReport {
	switch provider {
	case TEEProviderSGX:
		report := &AttestationReport{
			Provider: string(TEEProviderSGX),
			Format:   "sgx_quote",
		}
		report.Quote = strings.TrimSpace(os.Getenv("SGX_QUOTE_B64"))
		if report.Quote == "" {
			report.Quote = strings.TrimSpace(os.Getenv("SGX_QUOTE"))
		}
		report.Document = report.Quote
		report.MRENCLAVE = strings.TrimSpace(os.Getenv("SGX_MRENCLAVE"))
		report.MRSIGNER = strings.TrimSpace(os.Getenv("SGX_MRSIGNER"))
		report.ProdID = parseUint16Env("SGX_PROD_ID")
		report.ISVSVN = parseUint16Env("SGX_ISVSVN")
		return report
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

func parseUint16Env(key string) uint16 {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return 0
	}
	parsed, err := strconv.ParseUint(raw, 10, 16)
	if err != nil {
		return 0
	}
	return uint16(parsed)
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

// Provider returns the configured TEE provider for this marble.
func (m *Marble) Provider() TEEProvider {
	if m == nil {
		return TEEProviderSimulation
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
func (m *Marble) IsTEE() bool {
	if m == nil {
		return false
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	switch m.provider {
	case TEEProviderSimulation:
		return false
	case TEEProviderSGX:
		if strings.TrimSpace(os.Getenv("OE_SIMULATION")) == "0" {
			return true
		}
		if m.report == nil {
			return false
		}
		return strings.TrimSpace(m.report.Document) != "" ||
			strings.TrimSpace(m.report.Quote) != "" ||
			strings.TrimSpace(m.report.MRENCLAVE) != "" ||
			strings.TrimSpace(m.report.MRSIGNER) != ""
	case TEEProviderNitro:
		if m.report != nil && strings.TrimSpace(m.report.Document) != "" {
			return true
		}
		// Nitro enclaves expose /dev/nsm.
		if _, err := os.Stat("/dev/nsm"); err == nil {
			return true
		} else if err != nil && !errors.Is(err, fs.ErrNotExist) {
			// Be conservative for unusual filesystem errors.
			return true
		}
		return false
	default:
		return false
	}
}

// Attest returns provider-specific attestation evidence bound to caller data.
func (m *Marble) Attest(userData []byte) (*AttestationReport, error) {
	if m == nil {
		return nil, fmt.Errorf("marble is nil")
	}

	m.mu.RLock()
	provider := m.provider
	base := m.report.clone()
	m.mu.RUnlock()

	if provider == TEEProviderSimulation || base == nil {
		return nil, fmt.Errorf("attestation unavailable in simulation mode")
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

	switch provider {
	case TEEProviderSGX:
		if strings.TrimSpace(base.Quote) == "" && strings.TrimSpace(base.Document) == "" {
			return nil, fmt.Errorf("sgx quote is not available")
		}
		if base.Document == "" {
			base.Document = base.Quote
		}
	case TEEProviderNitro:
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

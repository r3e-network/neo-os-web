package confidential

import (
	"testing"
	"time"
)

func TestEnclaveStatus(t *testing.T) {
	tests := []struct {
		status EnclaveStatus
		want   string
	}{
		{EnclaveStatusInactive, "inactive"},
		{EnclaveStatusActive, "active"},
		{EnclaveStatusRevoked, "revoked"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("EnclaveStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestEnclaveFields(t *testing.T) {
	now := time.Now()
	enclave := Enclave{
		ID:          "enc-1",
		AccountID:   "acct-1",
		Name:        "TEE Runner 1",
		Endpoint:    "https://enclave.example.com",
		Attestation: "attestation-report",
		Status:      EnclaveStatusActive,
		Metadata:    map[string]string{"region": "us-east"},
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if enclave.ID != "enc-1" {
		t.Errorf("ID = %q, want 'enc-1'", enclave.ID)
	}
	if enclave.Status != EnclaveStatusActive {
		t.Errorf("Status = %q, want 'active'", enclave.Status)
	}
	if enclave.Endpoint == "" {
		t.Error("Endpoint should not be empty")
	}
}

func TestSealedKeyFields(t *testing.T) {
	now := time.Now()
	key := SealedKey{
		ID:        "key-1",
		AccountID: "acct-1",
		EnclaveID: "enc-1",
		Name:      "Signing Key",
		Blob:      []byte("encrypted-key-data"),
		Metadata:  map[string]string{"algorithm": "secp256k1"},
		CreatedAt: now,
	}

	if key.ID != "key-1" {
		t.Errorf("ID = %q, want 'key-1'", key.ID)
	}
	if key.EnclaveID != "enc-1" {
		t.Errorf("EnclaveID = %q, want 'enc-1'", key.EnclaveID)
	}
	if len(key.Blob) == 0 {
		t.Error("Blob should not be empty")
	}
}

func TestAttestationFields(t *testing.T) {
	now := time.Now()
	validUntil := now.Add(24 * time.Hour)
	attest := Attestation{
		ID:         "attest-1",
		AccountID:  "acct-1",
		EnclaveID:  "enc-1",
		Report:     "attestation-report-data",
		ValidUntil: &validUntil,
		Status:     "valid",
		Metadata:   map[string]string{"type": "sgx"},
		CreatedAt:  now,
	}

	if attest.ID != "attest-1" {
		t.Errorf("ID = %q, want 'attest-1'", attest.ID)
	}
	if attest.Report == "" {
		t.Error("Report should not be empty")
	}
	if attest.ValidUntil == nil {
		t.Error("ValidUntil should not be nil")
	}
}

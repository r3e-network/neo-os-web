package types

import (
	"testing"
	"time"
)

func TestConstants(t *testing.T) {
	if ServiceID != "globalsigner" {
		t.Errorf("ServiceID = %q, want %q", ServiceID, "globalsigner")
	}
	if ServiceName != "GlobalSigner Service" {
		t.Errorf("ServiceName = %q, want %q", ServiceName, "GlobalSigner Service")
	}
	if Version != "1.0.0" {
		t.Errorf("Version = %q, want %q", Version, "1.0.0")
	}
	if DefaultRotationPeriod != 30*24*time.Hour {
		t.Errorf("DefaultRotationPeriod = %v, want 30 days", DefaultRotationPeriod)
	}
	if DefaultOverlapPeriod != 7*24*time.Hour {
		t.Errorf("DefaultOverlapPeriod = %v, want 7 days", DefaultOverlapPeriod)
	}
}

func TestKeyStatus(t *testing.T) {
	tests := []struct {
		status   KeyStatus
		expected string
	}{
		{KeyStatusPending, "pending"},
		{KeyStatusActive, "active"},
		{KeyStatusOverlapping, "overlapping"},
		{KeyStatusRevoked, "revoked"},
	}

	for _, tt := range tests {
		if string(tt.status) != tt.expected {
			t.Errorf("KeyStatus = %q, want %q", tt.status, tt.expected)
		}
	}
}

func TestDefaultRotationConfig(t *testing.T) {
	cfg := DefaultRotationConfig()
	if cfg == nil {
		t.Fatal("DefaultRotationConfig() returned nil")
	}

	if cfg.RotationPeriod != DefaultRotationPeriod {
		t.Errorf("RotationPeriod = %v, want %v", cfg.RotationPeriod, DefaultRotationPeriod)
	}
	if cfg.OverlapPeriod != DefaultOverlapPeriod {
		t.Errorf("OverlapPeriod = %v, want %v", cfg.OverlapPeriod, DefaultOverlapPeriod)
	}
	if !cfg.AutoRotate {
		t.Error("AutoRotate should be true by default")
	}
	if !cfg.RequireOnChainAnchor {
		t.Error("RequireOnChainAnchor should be true by default")
	}
}

func TestKeyVersionStruct(t *testing.T) {
	now := time.Now()
	kv := KeyVersion{
		Version:    "v2025-01",
		Status:     KeyStatusActive,
		PubKeyHex:  "02abc123",
		PubKeyHash: "hash123",
		CreatedAt:  now,
	}

	if kv.Version != "v2025-01" {
		t.Errorf("Version = %q, want %q", kv.Version, "v2025-01")
	}
	if kv.Status != KeyStatusActive {
		t.Errorf("Status = %q, want %q", kv.Status, KeyStatusActive)
	}
	if kv.ActivatedAt != nil {
		t.Error("ActivatedAt should be nil")
	}
}

func TestRotationConfigStruct(t *testing.T) {
	cfg := RotationConfig{
		RotationPeriod:       24 * time.Hour,
		OverlapPeriod:        6 * time.Hour,
		AutoRotate:           false,
		RequireOnChainAnchor: false,
	}

	if cfg.RotationPeriod != 24*time.Hour {
		t.Errorf("RotationPeriod = %v, want 24h", cfg.RotationPeriod)
	}
	if cfg.AutoRotate {
		t.Error("AutoRotate should be false")
	}
}

func TestMasterKeyAttestationStruct(t *testing.T) {
	att := MasterKeyAttestation{
		KeyVersion: "v1",
		PubKeyHex:  "02abc",
		PubKeyHash: "hash",
		Timestamp:  "2025-01-01T00:00:00Z",
		Simulated:  true,
	}

	if att.KeyVersion != "v1" {
		t.Errorf("KeyVersion = %q, want %q", att.KeyVersion, "v1")
	}
	if !att.Simulated {
		t.Error("Simulated should be true")
	}
}

func TestSignRequestStruct(t *testing.T) {
	req := SignRequest{
		Domain:     "neocompute",
		Data:       "deadbeef",
		KeyVersion: "v1",
	}

	if req.Domain != "neocompute" {
		t.Errorf("Domain = %q, want %q", req.Domain, "neocompute")
	}
}

func TestSignRawRequestStruct(t *testing.T) {
	req := SignRawRequest{
		Data:       "deadbeef",
		KeyVersion: "v1",
	}

	if req.Data != "deadbeef" {
		t.Errorf("Data = %q, want %q", req.Data, "deadbeef")
	}
}

func TestSignResponseStruct(t *testing.T) {
	resp := SignResponse{
		Signature:  "sig123",
		KeyVersion: "v1",
		PubKeyHex:  "02abc",
	}

	if resp.Signature != "sig123" {
		t.Errorf("Signature = %q, want %q", resp.Signature, "sig123")
	}
}

func TestDeriveRequestStruct(t *testing.T) {
	req := DeriveRequest{
		Domain:     "neoaccounts",
		Path:       "user/123",
		KeyVersion: "v1",
	}

	if req.Domain != "neoaccounts" {
		t.Errorf("Domain = %q, want %q", req.Domain, "neoaccounts")
	}
	if req.Path != "user/123" {
		t.Errorf("Path = %q, want %q", req.Path, "user/123")
	}
}

func TestDeriveResponseStruct(t *testing.T) {
	resp := DeriveResponse{
		PubKeyHex:  "02abc",
		KeyVersion: "v1",
	}

	if resp.PubKeyHex != "02abc" {
		t.Errorf("PubKeyHex = %q, want %q", resp.PubKeyHex, "02abc")
	}
}

func TestRotateRequestStruct(t *testing.T) {
	req := RotateRequest{Force: true}
	if !req.Force {
		t.Error("Force should be true")
	}
}

func TestRotateResponseStruct(t *testing.T) {
	now := time.Now()
	resp := RotateResponse{
		OldVersion:    "v1",
		NewVersion:    "v2",
		OverlapEndsAt: &now,
		RotatedAt:     now,
		Rotated:       true,
	}

	if resp.OldVersion != "v1" {
		t.Errorf("OldVersion = %q, want %q", resp.OldVersion, "v1")
	}
	if !resp.Rotated {
		t.Error("Rotated should be true")
	}
}

func TestStatusResponseStruct(t *testing.T) {
	resp := StatusResponse{
		Service:          ServiceID,
		Version:          Version,
		Healthy:          true,
		ActiveKeyVersion: "v1",
		Uptime:           "1h30m",
		IsEnclave:        true,
	}

	if resp.Service != ServiceID {
		t.Errorf("Service = %q, want %q", resp.Service, ServiceID)
	}
	if !resp.Healthy {
		t.Error("Healthy should be true")
	}
	if !resp.IsEnclave {
		t.Error("IsEnclave should be true")
	}
}

func TestAttestationArtifactStruct(t *testing.T) {
	now := time.Now()
	art := AttestationArtifact{
		ID:              1,
		KeyID:           "key-1",
		ArtifactType:    "sgx_quote",
		ArtifactData:    []byte("data"),
		PubKeyHash:      "hash",
		AttestationHash: "att-hash",
		CreatedAt:       now,
	}

	if art.ID != 1 {
		t.Errorf("ID = %d, want 1", art.ID)
	}
	if art.ArtifactType != "sgx_quote" {
		t.Errorf("ArtifactType = %q, want %q", art.ArtifactType, "sgx_quote")
	}
}

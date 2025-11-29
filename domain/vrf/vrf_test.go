package vrf

import (
	"testing"
	"time"
)

func TestKeyStatus(t *testing.T) {
	tests := []struct {
		status KeyStatus
		want   string
	}{
		{KeyStatusInactive, "inactive"},
		{KeyStatusPendingApproval, "pending_approval"},
		{KeyStatusActive, "active"},
		{KeyStatusRevoked, "revoked"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("KeyStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestKeyFields(t *testing.T) {
	now := time.Now()
	key := Key{
		ID:            "key-1",
		AccountID:     "acct-1",
		PublicKey:     "0x1234",
		Label:         "Test Key",
		Status:        KeyStatusActive,
		WalletAddress: "0xabc",
		Attestation:   "attestation-data",
		Metadata:      map[string]string{"env": "prod"},
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if key.ID != "key-1" {
		t.Errorf("ID = %q, want 'key-1'", key.ID)
	}
	if key.Status != KeyStatusActive {
		t.Errorf("Status = %q, want 'active'", key.Status)
	}
	if key.Metadata["env"] != "prod" {
		t.Errorf("Metadata[env] = %q, want 'prod'", key.Metadata["env"])
	}
	if !key.CreatedAt.Equal(now) {
		t.Error("CreatedAt should be preserved")
	}
}

func TestRequestStatus(t *testing.T) {
	tests := []struct {
		status RequestStatus
		want   string
	}{
		{RequestStatusPending, "pending"},
		{RequestStatusFulfilled, "fulfilled"},
		{RequestStatusFailed, "failed"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("RequestStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestRequestFields(t *testing.T) {
	now := time.Now()
	req := Request{
		ID:          "req-1",
		AccountID:   "acct-1",
		KeyID:       "key-1",
		Consumer:    "consumer-addr",
		Seed:        "0xseed",
		Status:      RequestStatusFulfilled,
		Result:      "0xresult",
		Metadata:    map[string]string{"chain": "neo"},
		CreatedAt:   now,
		UpdatedAt:   now,
		FulfilledAt: now.Add(time.Minute),
	}

	if req.ID != "req-1" {
		t.Errorf("ID = %q, want 'req-1'", req.ID)
	}
	if req.Status != RequestStatusFulfilled {
		t.Errorf("Status = %q, want 'fulfilled'", req.Status)
	}
	if req.Result != "0xresult" {
		t.Errorf("Result = %q, want '0xresult'", req.Result)
	}
	if req.Metadata["chain"] != "neo" {
		t.Errorf("Metadata[chain] = %q, want 'neo'", req.Metadata["chain"])
	}
}

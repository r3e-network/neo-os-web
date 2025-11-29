package datalink

import (
	"testing"
	"time"
)

func TestChannelStatus(t *testing.T) {
	tests := []struct {
		status ChannelStatus
		want   string
	}{
		{ChannelStatusInactive, "inactive"},
		{ChannelStatusActive, "active"},
		{ChannelStatusSuspended, "suspended"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("ChannelStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestDeliveryStatus(t *testing.T) {
	tests := []struct {
		status DeliveryStatus
		want   string
	}{
		{DeliveryStatusPending, "pending"},
		{DeliveryStatusDispatched, "dispatched"},
		{DeliveryStatusSucceeded, "succeeded"},
		{DeliveryStatusFailed, "failed"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("DeliveryStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestChannelFields(t *testing.T) {
	now := time.Now()
	channel := Channel{
		ID:        "ch-1",
		AccountID: "acct-1",
		Name:      "API Channel",
		Endpoint:  "https://api.example.com/webhook",
		AuthToken: "secret-token",
		SignerSet: []string{"0xsigner1"},
		Status:    ChannelStatusActive,
		Metadata:  map[string]string{"env": "prod"},
		CreatedAt: now,
		UpdatedAt: now,
	}

	if channel.ID != "ch-1" {
		t.Errorf("ID = %q, want 'ch-1'", channel.ID)
	}
	if channel.Status != ChannelStatusActive {
		t.Errorf("Status = %q, want 'active'", channel.Status)
	}
	if channel.Endpoint == "" {
		t.Error("Endpoint should not be empty")
	}
}

func TestDeliveryFields(t *testing.T) {
	now := time.Now()
	delivery := Delivery{
		ID:        "del-1",
		AccountID: "acct-1",
		ChannelID: "ch-1",
		Payload:   map[string]any{"data": "test"},
		Attempts:  3,
		Status:    DeliveryStatusSucceeded,
		Metadata:  map[string]string{"source": "function"},
		CreatedAt: now,
		UpdatedAt: now,
	}

	if delivery.ID != "del-1" {
		t.Errorf("ID = %q, want 'del-1'", delivery.ID)
	}
	if delivery.Attempts != 3 {
		t.Errorf("Attempts = %d, want 3", delivery.Attempts)
	}
	if delivery.Status != DeliveryStatusSucceeded {
		t.Errorf("Status = %q, want 'succeeded'", delivery.Status)
	}
}

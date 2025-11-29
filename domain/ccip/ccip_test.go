package ccip

import (
	"testing"
	"time"
)

func TestMessageStatus(t *testing.T) {
	tests := []struct {
		status MessageStatus
		want   string
	}{
		{MessageStatusPending, "pending"},
		{MessageStatusDispatching, "dispatching"},
		{MessageStatusDelivered, "delivered"},
		{MessageStatusFailed, "failed"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("MessageStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestLaneFields(t *testing.T) {
	now := time.Now()
	lane := Lane{
		ID:             "lane-1",
		AccountID:      "acct-1",
		Name:           "ETH-NEO",
		SourceChain:    "ethereum",
		DestChain:      "neo",
		SignerSet:      []string{"0xsigner1", "0xsigner2"},
		AllowedTokens:  []string{"USDT", "WETH"},
		DeliveryPolicy: map[string]any{"max_gas": 1000000},
		Metadata:       map[string]string{"env": "prod"},
		Tags:           []string{"mainnet"},
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if lane.ID != "lane-1" {
		t.Errorf("ID = %q, want 'lane-1'", lane.ID)
	}
	if lane.SourceChain != "ethereum" {
		t.Errorf("SourceChain = %q, want 'ethereum'", lane.SourceChain)
	}
	if len(lane.SignerSet) != 2 {
		t.Errorf("SignerSet len = %d, want 2", len(lane.SignerSet))
	}
	if len(lane.AllowedTokens) != 2 {
		t.Errorf("AllowedTokens len = %d, want 2", len(lane.AllowedTokens))
	}
}

func TestTokenTransfer(t *testing.T) {
	transfer := TokenTransfer{
		Token:     "USDT",
		Amount:    "1000000",
		Recipient: "0xrecipient",
	}

	if transfer.Token != "USDT" {
		t.Errorf("Token = %q, want 'USDT'", transfer.Token)
	}
	if transfer.Amount != "1000000" {
		t.Errorf("Amount = %q, want '1000000'", transfer.Amount)
	}
}

func TestMessageFields(t *testing.T) {
	now := time.Now()
	delivered := now.Add(time.Minute)
	msg := Message{
		ID:        "msg-1",
		AccountID: "acct-1",
		LaneID:    "lane-1",
		Status:    MessageStatusDelivered,
		Payload:   map[string]any{"data": "test"},
		TokenTransfers: []TokenTransfer{
			{Token: "USDT", Amount: "1000", Recipient: "0xabc"},
		},
		Trace:       []string{"step1", "step2"},
		Metadata:    map[string]string{"source": "api"},
		Tags:        []string{"urgent"},
		CreatedAt:   now,
		UpdatedAt:   now,
		DeliveredAt: &delivered,
	}

	if msg.ID != "msg-1" {
		t.Errorf("ID = %q, want 'msg-1'", msg.ID)
	}
	if msg.Status != MessageStatusDelivered {
		t.Errorf("Status = %q, want 'delivered'", msg.Status)
	}
	if len(msg.TokenTransfers) != 1 {
		t.Errorf("TokenTransfers len = %d, want 1", len(msg.TokenTransfers))
	}
	if msg.DeliveredAt == nil {
		t.Error("DeliveredAt should not be nil")
	}
}

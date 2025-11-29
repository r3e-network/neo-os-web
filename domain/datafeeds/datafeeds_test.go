package datafeeds

import (
	"testing"
	"time"
)

func TestUpdateStatus(t *testing.T) {
	tests := []struct {
		status UpdateStatus
		want   string
	}{
		{UpdateStatusPending, "pending"},
		{UpdateStatusAccepted, "accepted"},
		{UpdateStatusRejected, "rejected"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("UpdateStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestFeedFields(t *testing.T) {
	now := time.Now()
	feed := Feed{
		ID:           "feed-1",
		AccountID:    "acct-1",
		Pair:         "BTC/USD",
		Description:  "Bitcoin price feed",
		Decimals:     8,
		Heartbeat:    time.Hour,
		ThresholdPPM: 5000,
		SignerSet:    []string{"0xsigner1", "0xsigner2"},
		Threshold:    2,
		Aggregation:  "median",
		Metadata:     map[string]string{"source": "chainlink"},
		Tags:         []string{"mainnet", "btc"},
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if feed.ID != "feed-1" {
		t.Errorf("ID = %q, want 'feed-1'", feed.ID)
	}
	if feed.Pair != "BTC/USD" {
		t.Errorf("Pair = %q, want 'BTC/USD'", feed.Pair)
	}
	if feed.Decimals != 8 {
		t.Errorf("Decimals = %d, want 8", feed.Decimals)
	}
	if feed.ThresholdPPM != 5000 {
		t.Errorf("ThresholdPPM = %d, want 5000", feed.ThresholdPPM)
	}
	if len(feed.SignerSet) != 2 {
		t.Errorf("SignerSet len = %d, want 2", len(feed.SignerSet))
	}
}

func TestUpdateFields(t *testing.T) {
	now := time.Now()
	update := Update{
		ID:        "upd-1",
		AccountID: "acct-1",
		FeedID:    "feed-1",
		RoundID:   12345,
		Price:     "50000.00000000",
		Signer:    "0xsigner1",
		Timestamp: now,
		Signature: "0xsig",
		Status:    UpdateStatusAccepted,
		Metadata:  map[string]string{"block": "1000000"},
		CreatedAt: now,
		UpdatedAt: now,
	}

	if update.ID != "upd-1" {
		t.Errorf("ID = %q, want 'upd-1'", update.ID)
	}
	if update.RoundID != 12345 {
		t.Errorf("RoundID = %d, want 12345", update.RoundID)
	}
	if update.Status != UpdateStatusAccepted {
		t.Errorf("Status = %q, want 'accepted'", update.Status)
	}
}

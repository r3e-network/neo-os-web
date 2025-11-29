package datastreams

import (
	"testing"
	"time"
)

func TestStreamStatus(t *testing.T) {
	tests := []struct {
		status StreamStatus
		want   string
	}{
		{StreamStatusInactive, "inactive"},
		{StreamStatusActive, "active"},
		{StreamStatusPaused, "paused"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("StreamStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestFrameStatus(t *testing.T) {
	tests := []struct {
		status FrameStatus
		want   string
	}{
		{FrameStatusOK, "ok"},
		{FrameStatusLate, "late"},
		{FrameStatusError, "error"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("FrameStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestStreamFields(t *testing.T) {
	now := time.Now()
	stream := Stream{
		ID:          "stream-1",
		AccountID:   "acct-1",
		Name:        "BTC Price Stream",
		Symbol:      "BTCUSD",
		Description: "Real-time BTC price",
		Frequency:   "1s",
		SLAms:       100,
		Status:      StreamStatusActive,
		Metadata:    map[string]string{"tier": "premium"},
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if stream.ID != "stream-1" {
		t.Errorf("ID = %q, want 'stream-1'", stream.ID)
	}
	if stream.Symbol != "BTCUSD" {
		t.Errorf("Symbol = %q, want 'BTCUSD'", stream.Symbol)
	}
	if stream.SLAms != 100 {
		t.Errorf("SLAms = %d, want 100", stream.SLAms)
	}
	if stream.Status != StreamStatusActive {
		t.Errorf("Status = %q, want 'active'", stream.Status)
	}
}

func TestFrameFields(t *testing.T) {
	now := time.Now()
	frame := Frame{
		ID:        "frame-1",
		AccountID: "acct-1",
		StreamID:  "stream-1",
		Sequence:  12345,
		Payload:   map[string]any{"price": "50000.00"},
		LatencyMS: 50,
		Status:    FrameStatusOK,
		Metadata:  map[string]string{"source": "exchange"},
		CreatedAt: now,
	}

	if frame.ID != "frame-1" {
		t.Errorf("ID = %q, want 'frame-1'", frame.ID)
	}
	if frame.Sequence != 12345 {
		t.Errorf("Sequence = %d, want 12345", frame.Sequence)
	}
	if frame.LatencyMS != 50 {
		t.Errorf("LatencyMS = %d, want 50", frame.LatencyMS)
	}
	if frame.Status != FrameStatusOK {
		t.Errorf("Status = %q, want 'ok'", frame.Status)
	}
}

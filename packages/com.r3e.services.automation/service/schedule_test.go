package automation

import (
	"testing"
	"time"
)

func TestNextRunFromSpec_Every(t *testing.T) {
	now := time.Date(2025, 2, 10, 10, 0, 0, 0, time.UTC)
	next, err := nextRunFromSpec("@every 15m", now)
	if err != nil {
		t.Fatalf("next run: %v", err)
	}
	expected := now.Add(15 * time.Minute)
	if !next.Equal(expected) {
		t.Fatalf("expected %v, got %v", expected, next)
	}
}

func TestNextRunFromSpec_Cron(t *testing.T) {
	now := time.Date(2025, 2, 10, 10, 23, 0, 0, time.UTC)
	next, err := nextRunFromSpec("0 0 * * *", now)
	if err != nil {
		t.Fatalf("next run: %v", err)
	}
	expected := time.Date(2025, 2, 11, 0, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Fatalf("expected %v, got %v", expected, next)
	}
}

func TestNextRunFromSpec_DayOfWeekOr(t *testing.T) {
	// Schedule every Friday at 15:30.
	now := time.Date(2025, 2, 10, 14, 0, 0, 0, time.UTC) // Monday
	next, err := nextRunFromSpec("30 15 * * 5", now)
	if err != nil {
		t.Fatalf("next run: %v", err)
	}
	expected := time.Date(2025, 2, 14, 15, 30, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Fatalf("expected %v, got %v", expected, next)
	}
}

func TestNextRunFromSpec_Invalid(t *testing.T) {
	if _, err := nextRunFromSpec("bad spec", time.Now()); err == nil {
		t.Fatalf("expected error for invalid spec")
	}
	if _, err := nextRunFromSpec("@every -1m", time.Now()); err == nil {
		t.Fatalf("expected error for negative duration")
	}
}

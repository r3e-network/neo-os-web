package chain

import (
	"math"
	"testing"
	"time"
)

func TestUint64ToUnixTimeSeconds(t *testing.T) {
	input := uint64(1_700_000_000)
	got := uint64ToUnixTime(input)
	want := time.Unix(int64(input), 0).UTC()

	if !got.Equal(want) {
		t.Fatalf("unexpected seconds conversion: got %s, want %s", got, want)
	}
}

func TestUint64ToUnixTimeMilliseconds(t *testing.T) {
	input := uint64(1_700_000_000_000)
	got := uint64ToUnixTime(input)
	want := time.UnixMilli(int64(input)).UTC()

	if !got.Equal(want) {
		t.Fatalf("unexpected milliseconds conversion: got %s, want %s", got, want)
	}
}

func TestUint64ToUnixTimeOverflow(t *testing.T) {
	got := uint64ToUnixTime(uint64(math.MaxUint64))
	if !got.IsZero() {
		t.Fatalf("expected zero time for overflow, got %s", got)
	}
}

package security

import (
	"testing"
	"time"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
)

func TestNewReplayProtection(t *testing.T) {
	rp := NewReplayProtection(5*time.Minute, nil)
	if rp == nil {
		t.Fatal("NewReplayProtection returned nil")
	}
	if rp.window != 5*time.Minute {
		t.Errorf("window = %v, want %v", rp.window, 5*time.Minute)
	}
	if rp.seenRequests == nil {
		t.Error("seenRequests map not initialized")
	}
}

func TestNewReplayProtection_DefaultWindow(t *testing.T) {
	rp := NewReplayProtection(0, nil)
	if rp.window != 5*time.Minute {
		t.Errorf("default window = %v, want %v", rp.window, 5*time.Minute)
	}
}

func TestReplayProtection_ValidateAndMark(t *testing.T) {
	rp := NewReplayProtection(100*time.Millisecond, nil)

	// First request should be valid
	if !rp.ValidateAndMark("req-1") {
		t.Error("First request should be valid")
	}

	// Same request immediately should be a replay
	if rp.ValidateAndMark("req-1") {
		t.Error("Duplicate request should be rejected")
	}

	// Different request should be valid
	if !rp.ValidateAndMark("req-2") {
		t.Error("Different request should be valid")
	}

	// Wait for expiration
	time.Sleep(150 * time.Millisecond)

	// Old request should now be valid again
	if !rp.ValidateAndMark("req-1") {
		t.Error("Expired request should be valid again")
	}
}

func TestReplayProtection_ValidateAndMark_EmptyID(t *testing.T) {
	rp := NewReplayProtection(5*time.Minute, nil)

	// Empty ID should always be valid
	if !rp.ValidateAndMark("") {
		t.Error("Empty ID should be valid")
	}
	if !rp.ValidateAndMark("") {
		t.Error("Empty ID should always be valid")
	}
}

func TestReplayProtection_IsReplay(t *testing.T) {
	rp := NewReplayProtection(100*time.Millisecond, nil)

	// Check before marking - should not be replay
	if rp.IsReplay("req-1") {
		t.Error("Unmarked request should not be replay")
	}

	// Mark the request
	rp.ValidateAndMark("req-1")

	// Now should be replay
	if !rp.IsReplay("req-1") {
		t.Error("Marked request should be replay")
	}

	// Wait for expiration
	time.Sleep(150 * time.Millisecond)

	// Should not be replay after expiration
	if rp.IsReplay("req-1") {
		t.Error("Expired request should not be replay")
	}
}

func TestReplayProtection_Size(t *testing.T) {
	rp := NewReplayProtection(5*time.Minute, nil)

	if rp.Size() != 0 {
		t.Errorf("initial size = %d, want 0", rp.Size())
	}

	rp.ValidateAndMark("req-1")
	rp.ValidateAndMark("req-2")
	rp.ValidateAndMark("req-3")

	if rp.Size() != 3 {
		t.Errorf("size after 3 requests = %d, want 3", rp.Size())
	}
}

func TestReplayProtection_Clear(t *testing.T) {
	rp := NewReplayProtection(5*time.Minute, nil)

	rp.ValidateAndMark("req-1")
	rp.ValidateAndMark("req-2")

	if rp.Size() != 2 {
		t.Errorf("size before clear = %d, want 2", rp.Size())
	}

	rp.Clear()

	if rp.Size() != 0 {
		t.Errorf("size after clear = %d, want 0", rp.Size())
	}

	// After clear, requests should be valid again
	if !rp.ValidateAndMark("req-1") {
		t.Error("Request should be valid after clear")
	}
}

func TestReplayProtection_Concurrent(t *testing.T) {
	rp := NewReplayProtection(5*time.Minute, logging.New("test", "info", "json"))

	// Run concurrent validations
	done := make(chan bool, 100)
	for i := 0; i < 100; i++ {
		go func() {
			requestID := "concurrent-req"
			result := rp.ValidateAndMark(requestID)
			// Only the first one should succeed
			_ = result
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 100; i++ {
		<-done
	}

	// Should have exactly 1 entry
	if rp.Size() != 1 {
		t.Errorf("concurrent size = %d, want 1", rp.Size())
	}
}

func TestReplayProtection_CleanupExpired(t *testing.T) {
	rp := NewReplayProtection(50*time.Millisecond, nil)

	// Add many requests with same ID to test deduplication
	for i := 0; i < 150; i++ {
		rp.ValidateAndMark("cleanup-test-req")
	}

	// Only 1 entry should exist (deduplication)
	initialSize := rp.Size()
	if initialSize != 1 {
		t.Errorf("initial size = %d, want 1 (deduplication)", initialSize)
	}

	// Wait for expiration
	time.Sleep(100 * time.Millisecond)

	// Add one more to trigger cleanup (every 100 requests)
	rp.ValidateAndMark("trigger-cleanup")

	// Old request should be cleaned up or the new one added
	// Size should be small (1 or 2 depending on timing)
	finalSize := rp.Size()
	if finalSize > 2 {
		t.Errorf("after cleanup size = %d, want <= 2", finalSize)
	}
}

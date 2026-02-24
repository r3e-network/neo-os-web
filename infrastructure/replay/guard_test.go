package replay

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestMarkSeenInMemory(t *testing.T) {
	g := New("test-svc", 5*time.Minute)

	if !g.MarkSeen(context.Background(), "req-1") {
		t.Fatal("first call should return true (new request)")
	}
	if g.MarkSeen(context.Background(), "req-1") {
		t.Fatal("second call should return false (duplicate)")
	}
}

func TestMarkSeenEmptyID(t *testing.T) {
	g := New("test-svc", 5*time.Minute)

	if g.MarkSeen(context.Background(), "") {
		t.Fatal("empty request ID should return false")
	}
	if g.MarkSeen(context.Background(), "   ") {
		t.Fatal("whitespace-only request ID should return false")
	}
}

func TestCleanupExpired(t *testing.T) {
	g := New("test-svc", 1*time.Millisecond)

	g.MarkSeen(context.Background(), "expire-me")
	time.Sleep(5 * time.Millisecond)

	g.Cleanup(context.Background())

	// After expiry + cleanup, the same ID should be accepted again.
	if !g.MarkSeen(context.Background(), "expire-me") {
		t.Fatal("expired request should be accepted again after cleanup")
	}
}

func TestCapAt100K(t *testing.T) {
	g := New("test-svc", 1*time.Hour)

	// Fill to capacity.
	for i := 0; i < 100_000; i++ {
		g.markSeenInMemory(fmt.Sprintf("req-%d", i))
	}

	// Next insert triggers cap logic; should still succeed.
	if !g.markSeenInMemory("overflow") {
		t.Fatal("insert after cap should succeed (hard reset)")
	}

	g.mu.Lock()
	n := len(g.seen)
	g.mu.Unlock()

	// After hard reset the map should be small (just the new entry).
	if n > 1024+1 {
		t.Fatalf("expected map reset to small size, got %d", n)
	}
}

// mockDB implements DBChecker for testing.
type mockDB struct {
	mu   sync.Mutex
	seen map[string]bool
	err  error
}

func (m *mockDB) MarkRequestSeen(_ context.Context, serviceID, requestID string, _ int) (bool, error) {
	if m.err != nil {
		return false, m.err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	key := serviceID + ":" + requestID
	if m.seen[key] {
		return false, nil
	}
	m.seen[key] = true
	return true, nil
}

func (m *mockDB) CleanupSeenRequests(_ context.Context, _ string) (int, error) {
	return 0, m.err
}

func TestMarkSeenWithDB(t *testing.T) {
	db := &mockDB{seen: make(map[string]bool)}
	g := New("test-svc", 5*time.Minute, WithDB(db))

	if !g.MarkSeen(context.Background(), "db-req") {
		t.Fatal("first DB call should return true")
	}
	if g.MarkSeen(context.Background(), "db-req") {
		t.Fatal("second DB call should return false (duplicate)")
	}
}

func TestMarkSeenDBErrorFallsBackToMemory(t *testing.T) {
	var logged bool
	db := &mockDB{seen: make(map[string]bool), err: fmt.Errorf("db down")}
	g := New("test-svc", 5*time.Minute,
		WithDB(db),
		WithLogger(func(_ string, _ error) { logged = true }),
	)

	// DB error → reject (conservative) but log warning.
	if g.MarkSeen(context.Background(), "fail-req") {
		t.Fatal("should return false on DB error")
	}
	if !logged {
		t.Fatal("expected logger to be called on DB error")
	}
}

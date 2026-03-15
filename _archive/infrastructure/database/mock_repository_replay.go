package database

import (
	"context"
	"time"
)

// =============================================================================
// Replay Protection Operations (implements ReplayRepository)
// =============================================================================

// mockReplayEntry tracks a seen request in the mock.
type mockReplayEntry struct {
	expiresAt time.Time
}

func (m *MockRepository) replayStore() map[string]mockReplayEntry {
	// Guarded by m.mu externally; this is a helper accessor.
	if m.seenRequests == nil {
		m.seenRequests = make(map[string]mockReplayEntry)
	}
	return m.seenRequests
}

func (m *MockRepository) MarkRequestSeen(ctx context.Context, serviceID, requestID string, windowSeconds int) (bool, error) {
	if err := m.checkError(); err != nil {
		return false, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	key := serviceID + ":" + requestID
	store := m.replayStore()

	if entry, ok := store[key]; ok && time.Now().Before(entry.expiresAt) {
		return false, nil // replay
	}

	store[key] = mockReplayEntry{
		expiresAt: time.Now().Add(time.Duration(windowSeconds) * time.Second),
	}
	return true, nil
}

func (m *MockRepository) DeleteSeenRequest(ctx context.Context, serviceID, requestID string) error {
	if err := m.checkError(); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	key := serviceID + ":" + requestID
	delete(m.replayStore(), key)
	return nil
}

func (m *MockRepository) CleanupSeenRequests(ctx context.Context, serviceID string) (int, error) {
	if err := m.checkError(); err != nil {
		return 0, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	store := m.replayStore()
	now := time.Now()
	count := 0
	for key, entry := range store {
		if now.After(entry.expiresAt) {
			if serviceID == "" || len(key) > len(serviceID) && key[:len(serviceID)+1] == serviceID+":" {
				delete(store, key)
				count++
			}
		}
	}
	return count, nil
}

package datalink

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/pkg/testutil"
	"github.com/google/uuid"
)

// MemoryStore is an in-memory implementation of Store for testing.
type MemoryStore struct {
	mu         sync.RWMutex
	channels   map[string]Channel
	deliveries map[string]Delivery
}

// NewMemoryStore creates a new in-memory store for testing.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		channels:   make(map[string]Channel),
		deliveries: make(map[string]Delivery),
	}
}

// CreateChannel creates a new channel.
func (s *MemoryStore) CreateChannel(ctx context.Context, ch Channel) (Channel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ch.ID == "" {
		ch.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	ch.CreatedAt = now
	ch.UpdatedAt = now
	if ch.Status == "" {
		ch.Status = ChannelStatusInactive
	}

	s.channels[ch.ID] = ch
	return ch, nil
}

// UpdateChannel updates an existing channel.
func (s *MemoryStore) UpdateChannel(ctx context.Context, ch Channel) (Channel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, ok := s.channels[ch.ID]
	if !ok {
		return Channel{}, fmt.Errorf("channel not found: %s", ch.ID)
	}

	ch.CreatedAt = existing.CreatedAt
	ch.UpdatedAt = time.Now().UTC()
	s.channels[ch.ID] = ch
	return ch, nil
}

// GetChannel retrieves a channel by ID.
func (s *MemoryStore) GetChannel(ctx context.Context, id string) (Channel, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ch, ok := s.channels[id]
	if !ok {
		return Channel{}, fmt.Errorf("channel not found: %s", id)
	}
	return ch, nil
}

// ListChannels returns all channels for an account.
func (s *MemoryStore) ListChannels(ctx context.Context, accountID string) ([]Channel, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []Channel
	for _, ch := range s.channels {
		if ch.AccountID == accountID {
			result = append(result, ch)
		}
	}
	return result, nil
}

// CreateDelivery creates a new delivery.
func (s *MemoryStore) CreateDelivery(ctx context.Context, del Delivery) (Delivery, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if del.ID == "" {
		del.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	del.CreatedAt = now
	del.UpdatedAt = now
	if del.Status == "" {
		del.Status = DeliveryStatusPending
	}

	s.deliveries[del.ID] = del
	return del, nil
}

// GetDelivery retrieves a delivery by ID.
func (s *MemoryStore) GetDelivery(ctx context.Context, id string) (Delivery, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	del, ok := s.deliveries[id]
	if !ok {
		return Delivery{}, fmt.Errorf("delivery not found: %s", id)
	}
	return del, nil
}

// ListDeliveries returns deliveries for an account.
func (s *MemoryStore) ListDeliveries(ctx context.Context, accountID string, limit int) ([]Delivery, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []Delivery
	for _, del := range s.deliveries {
		if del.AccountID == accountID {
			result = append(result, del)
			if limit > 0 && len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

// Compile-time check that MemoryStore implements Store.
var _ Store = (*MemoryStore)(nil)

// Re-export centralized mocks for convenience.
type MockAccountChecker = testutil.MockAccountChecker
type MockWalletChecker = testutil.MockWalletChecker

// NewMockAccountChecker creates a new mock account checker.
var NewMockAccountChecker = testutil.NewMockAccountChecker

// NewMockWalletChecker creates a new mock wallet checker.
var NewMockWalletChecker = testutil.NewMockWalletChecker

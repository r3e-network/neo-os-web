package state

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

var ErrNotFound = errors.New("key not found")

type PersistenceBackend interface {
	Save(ctx context.Context, key string, data []byte) error
	Load(ctx context.Context, key string) ([]byte, error)
	Delete(ctx context.Context, key string) error
	List(ctx context.Context, prefix string) ([]string, error)
	Close(ctx context.Context) error
}

type MemoryBackend struct {
	mu    sync.RWMutex
	data  map[string][]byte
	timer *time.Timer
	done  chan struct{}
}

func NewMemoryBackend(cleanupInterval time.Duration) *MemoryBackend {
	mb := &MemoryBackend{
		data: make(map[string][]byte),
		done: make(chan struct{}),
	}
	if cleanupInterval > 0 {
		mb.timer = time.NewTimer(cleanupInterval)
		go mb.cleanupLoop(cleanupInterval)
	}
	return mb
}

func (m *MemoryBackend) cleanupLoop(interval time.Duration) {
	for {
		select {
		case <-m.timer.C:
			m.mu.Lock()
			_ = m.data
			m.mu.Unlock()
			m.timer.Reset(interval)
		case <-m.done:
			m.timer.Stop()
			return
		}
	}
}

func (m *MemoryBackend) Save(ctx context.Context, key string, data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = data
	return nil
}

func (m *MemoryBackend) Load(ctx context.Context, key string) ([]byte, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	data, ok := m.data[key]
	if !ok {
		return nil, ErrNotFound
	}
	return data, nil
}

func (m *MemoryBackend) Delete(ctx context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.data, key)
	return nil
}

func (m *MemoryBackend) List(ctx context.Context, prefix string) ([]string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	keys := make([]string, 0, len(m.data))
	for k := range m.data {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			keys = append(keys, k)
		}
	}
	return keys, nil
}

func (m *MemoryBackend) Close(ctx context.Context) error {
	close(m.done)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data = make(map[string][]byte)
	return nil
}

type PersistentState struct {
	mu        sync.RWMutex
	backend   PersistenceBackend
	keyPrefix string
	maxSize   int
	onChange  []func(key string, oldValue, newValue []byte)
}

type Config struct {
	Backend       PersistenceBackend
	KeyPrefix     string
	MaxSize       int
	OnChangeHooks []func(key string, oldValue, newValue []byte)
}

func DefaultConfig() Config {
	return Config{
		Backend:       NewMemoryBackend(5 * time.Minute),
		KeyPrefix:     "state:",
		MaxSize:       1024 * 1024,
		OnChangeHooks: nil,
	}
}

func NewPersistentState(cfg Config) (*PersistentState, error) {
	if cfg.Backend == nil {
		return nil, errors.New("backend is required")
	}
	if cfg.KeyPrefix == "" {
		cfg.KeyPrefix = "state:"
	}
	if cfg.MaxSize <= 0 {
		cfg.MaxSize = 1024 * 1024
	}
	return &PersistentState{
		backend:   cfg.Backend,
		keyPrefix: cfg.KeyPrefix,
		maxSize:   cfg.MaxSize,
		onChange:  cfg.OnChangeHooks,
	}, nil
}

func (s *PersistentState) Save(ctx context.Context, key string, data []byte) error {
	if len(data) > s.maxSize {
		return fmt.Errorf("data size %d exceeds max size %d", len(data), s.maxSize)
	}

	fullKey := s.keyPrefix + key
	var oldValue []byte

	s.mu.Lock()
	defer s.mu.Unlock()

	if oldVal, err := s.backend.Load(ctx, fullKey); err == nil {
		oldValue = oldVal
	}

	if err := s.backend.Save(ctx, fullKey, data); err != nil {
		return fmt.Errorf("save failed: %w", err)
	}

	for _, hook := range s.onChange {
		go hook(key, oldValue, data)
	}

	return nil
}

func (s *PersistentState) Load(ctx context.Context, key string) ([]byte, error) {
	fullKey := s.keyPrefix + key
	return s.backend.Load(ctx, fullKey)
}

func (s *PersistentState) Delete(ctx context.Context, key string) error {
	fullKey := s.keyPrefix + key
	return s.backend.Delete(ctx, fullKey)
}

func (s *PersistentState) List(ctx context.Context, prefix string) ([]string, error) {
	fullPrefix := s.keyPrefix + prefix
	return s.backend.List(ctx, fullPrefix)
}

func (s *PersistentState) SaveIfAbsent(ctx context.Context, key string, data []byte) (bool, error) {
	fullKey := s.keyPrefix + key

	s.mu.RLock()
	exists, err := s.backend.Load(ctx, fullKey)
	s.mu.RUnlock()

	if err == nil && exists != nil {
		return false, nil
	}
	if err != nil && !errors.Is(err, ErrNotFound) {
		return false, err
	}

	return true, s.Save(ctx, key, data)
}

func (s *PersistentState) CompareAndSwap(ctx context.Context, key string, oldData, newData []byte) (bool, error) {
	fullKey := s.keyPrefix + key

	s.mu.Lock()
	defer s.mu.Unlock()

	currentData, err := s.backend.Load(ctx, fullKey)
	if err != nil {
		return false, err
	}

	if string(currentData) != string(oldData) {
		return false, nil
	}

	if err := s.backend.Save(ctx, fullKey, newData); err != nil {
		return false, err
	}

	for _, hook := range s.onChange {
		go hook(key, oldData, newData)
	}

	return true, nil
}

func (s *PersistentState) OnChange(fn func(key string, oldValue, newValue []byte)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onChange = append(s.onChange, fn)
}

func (s *PersistentState) Close(ctx context.Context) error {
	return s.backend.Close(ctx)
}

type Snapshot struct {
	Timestamp time.Time
	Data      map[string][]byte
}

func (s *PersistentState) Snapshot(ctx context.Context) (*Snapshot, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	keys, err := s.backend.List(ctx, s.keyPrefix)
	if err != nil {
		return nil, err
	}

	snapshot := &Snapshot{
		Timestamp: time.Now(),
		Data:      make(map[string][]byte),
	}

	for _, key := range keys {
		data, err := s.backend.Load(ctx, key)
		if err != nil {
			continue
		}
		relKey := key[len(s.keyPrefix):]
		snapshot.Data[relKey] = data
	}

	return snapshot, nil
}

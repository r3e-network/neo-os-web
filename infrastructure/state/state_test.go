package state

import (
	"context"
	"testing"
	"time"
)

func TestMemoryBackend_SaveLoad(t *testing.T) {
	ctx := context.Background()
	backend := NewMemoryBackend(0)

	err := backend.Save(ctx, "key1", []byte("value1"))
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	data, err := backend.Load(ctx, "key1")
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if string(data) != "value1" {
		t.Fatalf("expected 'value1', got '%s'", string(data))
	}
}

func TestMemoryBackend_Delete(t *testing.T) {
	ctx := context.Background()
	backend := NewMemoryBackend(0)

	_ = backend.Save(ctx, "key1", []byte("value1"))
	err := backend.Delete(ctx, "key1")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	_, err = backend.Load(ctx, "key1")
	if err == nil {
		t.Fatal("expected error after delete, got nil")
	}
}

func TestMemoryBackend_List(t *testing.T) {
	ctx := context.Background()
	backend := NewMemoryBackend(0)

	_ = backend.Save(ctx, "prefix:key1", []byte("value1"))
	_ = backend.Save(ctx, "prefix:key2", []byte("value2"))
	_ = backend.Save(ctx, "other:key3", []byte("value3"))

	keys, err := backend.List(ctx, "prefix:")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}

	if len(keys) != 2 {
		t.Fatalf("expected 2 keys, got %d", len(keys))
	}
}

func TestMemoryBackend_Close(t *testing.T) {
	ctx := context.Background()
	backend := NewMemoryBackend(time.Hour)

	err := backend.Close(ctx)
	if err != nil {
		t.Fatalf("Close failed: %v", err)
	}
}

func TestPersistentState_SaveLoad(t *testing.T) {
	ctx := context.Background()
	backend := NewMemoryBackend(0)
	cfg := Config{
		Backend:   backend,
		KeyPrefix: "test:",
		MaxSize:   1024,
	}

	state, err := NewPersistentState(cfg)
	if err != nil {
		t.Fatalf("NewPersistentState failed: %v", err)
	}

	err = state.Save(ctx, "mykey", []byte("myvalue"))
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	data, err := state.Load(ctx, "mykey")
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if string(data) != "myvalue" {
		t.Fatalf("expected 'myvalue', got '%s'", string(data))
	}
}

func TestPersistentState_CompareAndSwap(t *testing.T) {
	ctx := context.Background()
	backend := NewMemoryBackend(0)
	cfg := Config{
		Backend:   backend,
		KeyPrefix: "test:",
	}

	state, _ := NewPersistentState(cfg)
	_ = state.Save(ctx, "key", []byte("old"))

	swapped, err := state.CompareAndSwap(ctx, "key", []byte("old"), []byte("new"))
	if err != nil {
		t.Fatalf("CompareAndSwap failed: %v", err)
	}
	if !swapped {
		t.Fatal("CompareAndSwap should have succeeded")
	}

	data, _ := state.Load(ctx, "key")
	if string(data) != "new" {
		t.Fatalf("expected 'new', got '%s'", string(data))
	}
}

func TestPersistentState_SaveIfAbsent(t *testing.T) {
	ctx := context.Background()
	backend := NewMemoryBackend(0)
	cfg := Config{
		Backend:   backend,
		KeyPrefix: "test:",
	}

	state, _ := NewPersistentState(cfg)

	inserted, err := state.SaveIfAbsent(ctx, "key", []byte("value1"))
	if err != nil {
		t.Fatalf("SaveIfAbsent failed: %v", err)
	}
	if !inserted {
		t.Fatal("first SaveIfAbsent should return true")
	}

	inserted, err = state.SaveIfAbsent(ctx, "key", []byte("value2"))
	if err != nil {
		t.Fatalf("SaveIfAbsent failed: %v", err)
	}
	if inserted {
		t.Fatal("second SaveIfAbsent should return false")
	}

	data, _ := state.Load(ctx, "key")
	if string(data) != "value1" {
		t.Fatalf("expected 'value1', got '%s'", string(data))
	}
}

func TestPersistentState_Snapshot(t *testing.T) {
	ctx := context.Background()
	backend := NewMemoryBackend(0)
	cfg := Config{
		Backend:   backend,
		KeyPrefix: "test:",
	}

	state, _ := NewPersistentState(cfg)
	_ = state.Save(ctx, "key1", []byte("value1"))
	_ = state.Save(ctx, "key2", []byte("value2"))

	snapshot, err := state.Snapshot(ctx)
	if err != nil {
		t.Fatalf("Snapshot failed: %v", err)
	}

	if len(snapshot.Data) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(snapshot.Data))
	}

	if snapshot.Timestamp.IsZero() {
		t.Fatal("snapshot timestamp should not be zero")
	}
}

func TestPersistentState_OnChange(t *testing.T) {
	ctx := context.Background()
	backend := NewMemoryBackend(0)
	cfg := Config{
		Backend:   backend,
		KeyPrefix: "test:",
	}

	state, _ := NewPersistentState(cfg)

	called := make(chan bool, 1)
	state.OnChange(func(key string, oldValue, newValue []byte) {
		called <- true
	})

	_ = state.Save(ctx, "key", []byte("value"))

	select {
	case <-called:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("OnChange hook was not called within timeout")
	}
}

func TestPersistentState_Close(t *testing.T) {
	ctx := context.Background()
	backend := NewMemoryBackend(0)
	cfg := Config{
		Backend:   backend,
		KeyPrefix: "test:",
	}

	state, _ := NewPersistentState(cfg)
	err := state.Close(ctx)
	if err != nil {
		t.Fatalf("Close failed: %v", err)
	}
}

func TestPersistentState_MaxSize(t *testing.T) {
	ctx := context.Background()
	backend := NewMemoryBackend(0)
	cfg := Config{
		Backend:   backend,
		KeyPrefix: "test:",
		MaxSize:   10,
	}

	state, _ := NewPersistentState(cfg)

	err := state.Save(ctx, "key", []byte("12345678901"))
	if err == nil {
		t.Fatal("expected error for oversized data")
	}
}

package service

import (
	"sync"
	"testing"
	"time"
)

func TestNewStatsCollector(t *testing.T) {
	sc := NewStatsCollector()
	if sc == nil {
		t.Fatal("NewStatsCollector returned nil")
	}
	if sc.stats == nil {
		t.Error("stats map not initialized")
	}
	if len(sc.stats) != 0 {
		t.Errorf("initial stats not empty: %v", sc.stats)
	}
}

func TestStatsCollector_Add(t *testing.T) {
	sc := NewStatsCollector()
	sc.Add("key1", "value1").Add("key2", 42).Add("key3", true)

	stats := sc.Build()

	if stats["key1"] != "value1" {
		t.Errorf("key1 = %v, want value1", stats["key1"])
	}
	if stats["key2"] != 42 {
		t.Errorf("key2 = %v, want 42", stats["key2"])
	}
	if stats["key3"] != true {
		t.Errorf("key3 = %v, want true", stats["key3"])
	}
}

func TestStatsCollector_AddIf(t *testing.T) {
	sc := NewStatsCollector()
	sc.AddIf(true, "present", "value")
	sc.AddIf(false, "absent", "value")

	stats := sc.Build()

	if stats["present"] != "value" {
		t.Errorf("present = %v, want value", stats["present"])
	}
	if _, exists := stats["absent"]; exists {
		t.Error("absent key should not exist")
	}
}

func TestStatsCollector_AddNonNil(t *testing.T) {
	sc := NewStatsCollector()
	sc.AddNonNil("nil_key", nil)
	sc.AddNonNil("non_nil_key", "value")

	stats := sc.Build()

	if _, exists := stats["nil_key"]; exists {
		t.Error("nil_key should not exist")
	}
	if stats["non_nil_key"] != "value" {
		t.Errorf("non_nil_key = %v, want value", stats["non_nil_key"])
	}
}

func TestStatsCollector_AddMap(t *testing.T) {
	sc := NewStatsCollector()
	sc.Add("existing", "value")
	sc.AddMap(map[string]any{
		"key1": "val1",
		"key2": 123,
	})

	stats := sc.Build()

	if stats["existing"] != "value" {
		t.Error("existing key should be preserved")
	}
	if stats["key1"] != "val1" {
		t.Errorf("key1 = %v, want val1", stats["key1"])
	}
	if stats["key2"] != 123 {
		t.Errorf("key2 = %v, want 123", stats["key2"])
	}
}

func TestStatsCollector_WithRLock(t *testing.T) {
	var mu sync.RWMutex
	mu.Lock() // Start with write lock held

	done := make(chan bool)
	go func() {
		sc := NewStatsCollector().WithRLock(&mu)
		sc.Add("key", "value")
		stats := sc.Build()
		if stats["key"] != "value" {
			t.Error("value not set correctly")
		}
		done <- true
	}()

	// Give the goroutine time to try acquiring read lock
	select {
	case <-done:
		t.Error("Should not complete while write lock is held")
	default:
	}

	// Release write lock, allowing read lock to proceed
	mu.Unlock()

	<-done
}

func TestStatsCollector_Build_ReleasesLock(t *testing.T) {
	var mu sync.RWMutex
	sc := NewStatsCollector().WithRLock(&mu)
	sc.Add("key", "value")

	// First build should release lock
	sc.Build()

	// Should be able to acquire write lock now
	done := make(chan bool)
	locked := false
	go func() {
		mu.Lock()
		locked = true
		mu.Unlock()
		done <- true
	}()

	select {
	case <-done:
		// Good, lock was released
		if !locked {
			t.Error("Lock goroutine did not acquire the lock")
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("Lock was not released after Build()")
	}
}

func TestStatsCollector_Chaining(t *testing.T) {
	sc := NewStatsCollector()

	// Test method chaining
	result := sc.
		Add("a", 1).
		AddIf(true, "b", 2).
		AddIf(false, "c", 3).
		AddNonNil("d", "value").
		AddNonNil("e", nil).
		Build()

	expected := map[string]any{
		"a": 1,
		"b": 2,
		"d": "value",
	}

	if len(result) != len(expected) {
		t.Errorf("result has %d keys, want %d", len(result), len(expected))
	}

	for k, v := range expected {
		if result[k] != v {
			t.Errorf("%s = %v, want %v", k, result[k], v)
		}
	}
}

func TestStatsCollector_Concurrent(t *testing.T) {
	sc := NewStatsCollector()

	// Multiple goroutines adding different keys
	done := make(chan bool, 3)
	for i := 0; i < 3; i++ {
		go func(id int) {
			sc.Add("key", id)
			done <- true
		}(i)
	}

	for i := 0; i < 3; i++ {
		<-done
	}

	stats := sc.Build()
	// The value will be from the last goroutine to write
	if _, exists := stats["key"]; !exists {
		t.Error("key should exist")
	}
}

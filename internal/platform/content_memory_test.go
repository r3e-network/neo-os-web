package platform

import (
	"context"
	"testing"
	"time"
)

func TestMemoryContentDriver_StoreAndRetrieve(t *testing.T) {
	d := NewMemoryContentDriver()
	ctx := context.Background()

	content := []byte("hello world")
	hash, err := d.Store(ctx, content)
	if err != nil {
		t.Fatalf("Store failed: %v", err)
	}
	if hash == "" {
		t.Fatal("Expected non-empty hash")
	}

	// Retrieve should return same content
	retrieved, err := d.Retrieve(ctx, hash)
	if err != nil {
		t.Fatalf("Retrieve failed: %v", err)
	}
	if string(retrieved) != string(content) {
		t.Errorf("Content mismatch: got %q, want %q", retrieved, content)
	}
}

func TestMemoryContentDriver_Deduplication(t *testing.T) {
	d := NewMemoryContentDriver()
	ctx := context.Background()

	content := []byte("duplicate content")

	hash1, err := d.Store(ctx, content)
	if err != nil {
		t.Fatalf("First Store failed: %v", err)
	}

	hash2, err := d.Store(ctx, content)
	if err != nil {
		t.Fatalf("Second Store failed: %v", err)
	}

	if hash1 != hash2 {
		t.Errorf("Expected same hash for same content: %s != %s", hash1, hash2)
	}

	// Check ref count increased
	meta, err := d.GetMetadata(ctx, hash1)
	if err != nil {
		t.Fatalf("GetMetadata failed: %v", err)
	}
	if meta.RefCount != 2 {
		t.Errorf("Expected RefCount=2, got %d", meta.RefCount)
	}
}

func TestMemoryContentDriver_Exists(t *testing.T) {
	d := NewMemoryContentDriver()
	ctx := context.Background()

	// Non-existent content
	exists, err := d.Exists(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("Exists failed: %v", err)
	}
	if exists {
		t.Error("Expected content to not exist")
	}

	// Store and check again
	hash, _ := d.Store(ctx, []byte("test"))
	exists, err = d.Exists(ctx, hash)
	if err != nil {
		t.Fatalf("Exists failed: %v", err)
	}
	if !exists {
		t.Error("Expected content to exist")
	}
}

func TestMemoryContentDriver_Delete(t *testing.T) {
	d := NewMemoryContentDriver()
	ctx := context.Background()

	content := []byte("to delete")
	hash, _ := d.Store(ctx, content)

	// Delete should succeed
	if err := d.Delete(ctx, hash); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	// Content should no longer exist
	exists, _ := d.Exists(ctx, hash)
	if exists {
		t.Error("Expected content to be deleted")
	}

	// Delete again should be idempotent
	if err := d.Delete(ctx, hash); err != nil {
		t.Errorf("Second delete should be idempotent: %v", err)
	}
}

func TestMemoryContentDriver_DeleteWithRefCount(t *testing.T) {
	d := NewMemoryContentDriver()
	ctx := context.Background()

	content := []byte("shared content")

	// Store twice to increase ref count
	hash, _ := d.Store(ctx, content)
	d.Store(ctx, content)

	// First delete should decrement ref count but not remove
	if err := d.Delete(ctx, hash); err != nil {
		t.Fatalf("First delete failed: %v", err)
	}

	exists, _ := d.Exists(ctx, hash)
	if !exists {
		t.Error("Content should still exist with refcount > 0")
	}

	// Second delete should remove
	if err := d.Delete(ctx, hash); err != nil {
		t.Fatalf("Second delete failed: %v", err)
	}

	exists, _ = d.Exists(ctx, hash)
	if exists {
		t.Error("Content should be deleted when refcount reaches 0")
	}
}

func TestMemoryContentDriver_StoreWithMetadata(t *testing.T) {
	d := NewMemoryContentDriver()
	ctx := context.Background()

	content := []byte("content with metadata")
	expires := time.Now().Add(24 * time.Hour)
	meta := ContentMetadata{
		ContentType: "text/plain",
		ExpiresAt:   &expires,
		Labels: map[string]string{
			"source": "test",
			"type":   "example",
		},
	}

	hash, err := d.StoreWithMetadata(ctx, content, meta)
	if err != nil {
		t.Fatalf("StoreWithMetadata failed: %v", err)
	}

	retrieved, err := d.GetMetadata(ctx, hash)
	if err != nil {
		t.Fatalf("GetMetadata failed: %v", err)
	}

	if retrieved.ContentType != "text/plain" {
		t.Errorf("ContentType mismatch: got %q", retrieved.ContentType)
	}
	if retrieved.ExpiresAt == nil {
		t.Error("ExpiresAt should be set")
	}
	if retrieved.Labels["source"] != "test" {
		t.Errorf("Label 'source' mismatch: got %q", retrieved.Labels["source"])
	}
	if retrieved.Size != int64(len(content)) {
		t.Errorf("Size mismatch: got %d, want %d", retrieved.Size, len(content))
	}
}

func TestMemoryContentDriver_NotFound(t *testing.T) {
	d := NewMemoryContentDriver()
	ctx := context.Background()

	// Retrieve non-existent
	_, err := d.Retrieve(ctx, "nonexistent")
	if _, ok := err.(ErrContentNotFound); !ok {
		t.Errorf("Expected ErrContentNotFound, got %T: %v", err, err)
	}

	// GetMetadata non-existent
	_, err = d.GetMetadata(ctx, "nonexistent")
	if _, ok := err.(ErrContentNotFound); !ok {
		t.Errorf("Expected ErrContentNotFound, got %T: %v", err, err)
	}
}

func TestMemoryContentDriver_Stats(t *testing.T) {
	d := NewMemoryContentDriver()
	ctx := context.Background()

	// Initial stats
	stats := d.Stats()
	if stats.ItemCount != 0 {
		t.Errorf("Expected 0 items, got %d", stats.ItemCount)
	}

	// Add content
	d.Store(ctx, []byte("content1"))
	d.Store(ctx, []byte("content2"))
	d.Store(ctx, []byte("content1")) // Duplicate

	stats = d.Stats()
	if stats.ItemCount != 2 {
		t.Errorf("Expected 2 items (deduplicated), got %d", stats.ItemCount)
	}
	expectedSize := int64(len("content1") + len("content2"))
	if stats.TotalSize != expectedSize {
		t.Errorf("Expected total size %d, got %d", expectedSize, stats.TotalSize)
	}
}

func TestMemoryContentDriver_Clear(t *testing.T) {
	d := NewMemoryContentDriver()
	ctx := context.Background()

	d.Store(ctx, []byte("test1"))
	d.Store(ctx, []byte("test2"))

	d.Clear()

	stats := d.Stats()
	if stats.ItemCount != 0 {
		t.Errorf("Expected 0 items after clear, got %d", stats.ItemCount)
	}
}

func TestMemoryContentDriver_ContentIsolation(t *testing.T) {
	d := NewMemoryContentDriver()
	ctx := context.Background()

	// Store and retrieve should return independent copies
	original := []byte("original content")
	hash, _ := d.Store(ctx, original)

	retrieved, _ := d.Retrieve(ctx, hash)

	// Mutate the original
	original[0] = 'X'

	// Retrieved should be unchanged
	retrieved2, _ := d.Retrieve(ctx, hash)
	if retrieved2[0] == 'X' {
		t.Error("Content should be isolated from original mutations")
	}

	// Mutate retrieved
	retrieved[0] = 'Y'

	// Stored content should be unchanged
	retrieved3, _ := d.Retrieve(ctx, hash)
	if retrieved3[0] == 'Y' {
		t.Error("Content should be isolated from retrieval mutations")
	}
}

func TestNoopContentDriver(t *testing.T) {
	d := NewNoopContentDriver()
	ctx := context.Background()

	if d.Name() != "noop-content" {
		t.Errorf("Expected name 'noop-content', got %q", d.Name())
	}

	// Basic lifecycle
	if err := d.Start(ctx); err != nil {
		t.Errorf("Start failed: %v", err)
	}
	if err := d.Ping(ctx); err != nil {
		t.Errorf("Ping failed: %v", err)
	}
	if err := d.Stop(ctx); err != nil {
		t.Errorf("Stop failed: %v", err)
	}

	// Store should return ErrNotImplemented
	_, err := d.Store(ctx, []byte("test"))
	if err != ErrNotImplemented {
		t.Errorf("Expected ErrNotImplemented from Store, got %v", err)
	}

	// Retrieve should return ErrContentNotFound
	_, err = d.Retrieve(ctx, "somehash")
	if _, ok := err.(ErrContentNotFound); !ok {
		t.Errorf("Expected ErrContentNotFound from Retrieve, got %T", err)
	}

	// Exists should return false
	exists, err := d.Exists(ctx, "somehash")
	if err != nil || exists {
		t.Errorf("Expected (false, nil), got (%v, %v)", exists, err)
	}

	// Delete should be idempotent (no error)
	if err := d.Delete(ctx, "somehash"); err != nil {
		t.Errorf("Delete should be idempotent: %v", err)
	}
}

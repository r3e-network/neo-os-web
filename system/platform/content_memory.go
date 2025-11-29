// Package platform provides driver interfaces and implementations.
package platform

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

// MemoryContentDriver is an in-memory implementation of ContentDriver.
// Suitable for testing and development environments.
// NOT suitable for production use - content is lost on restart.
type MemoryContentDriver struct {
	name     string
	mu       sync.RWMutex
	content  map[string][]byte
	metadata map[string]*ContentMetadata
}

// NewMemoryContentDriver creates a new in-memory content driver.
func NewMemoryContentDriver() *MemoryContentDriver {
	return &MemoryContentDriver{
		name:     "memory-content",
		content:  make(map[string][]byte),
		metadata: make(map[string]*ContentMetadata),
	}
}

func (d *MemoryContentDriver) Name() string                    { return d.name }
func (d *MemoryContentDriver) Start(ctx context.Context) error { return nil }
func (d *MemoryContentDriver) Stop(ctx context.Context) error  { return nil }
func (d *MemoryContentDriver) Ping(ctx context.Context) error  { return nil }

// Store saves content and returns its SHA256 hash.
func (d *MemoryContentDriver) Store(ctx context.Context, content []byte) (string, error) {
	hash := computeHash(content)

	d.mu.Lock()
	defer d.mu.Unlock()

	// Check if content already exists (deduplication)
	if existing, ok := d.metadata[hash]; ok {
		existing.RefCount++
		return hash, nil
	}

	// Store new content
	d.content[hash] = copyBytes(content)
	d.metadata[hash] = &ContentMetadata{
		Hash:      hash,
		Size:      int64(len(content)),
		CreatedAt: time.Now().UTC(),
		RefCount:  1,
	}

	return hash, nil
}

// Retrieve fetches content by its hash.
func (d *MemoryContentDriver) Retrieve(ctx context.Context, hash string) ([]byte, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	content, ok := d.content[hash]
	if !ok {
		return nil, ErrContentNotFound{Hash: hash}
	}

	return copyBytes(content), nil
}

// Exists checks if content with the given hash exists.
func (d *MemoryContentDriver) Exists(ctx context.Context, hash string) (bool, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	_, ok := d.content[hash]
	return ok, nil
}

// Delete removes content by hash.
func (d *MemoryContentDriver) Delete(ctx context.Context, hash string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	meta, ok := d.metadata[hash]
	if !ok {
		return nil // Idempotent
	}

	meta.RefCount--
	if meta.RefCount <= 0 {
		delete(d.content, hash)
		delete(d.metadata, hash)
	}

	return nil
}

// StoreWithMetadata stores content with associated metadata.
func (d *MemoryContentDriver) StoreWithMetadata(ctx context.Context, content []byte, meta ContentMetadata) (string, error) {
	hash := computeHash(content)

	d.mu.Lock()
	defer d.mu.Unlock()

	// Check if content already exists
	if existing, ok := d.metadata[hash]; ok {
		existing.RefCount++
		// Merge labels if provided
		if len(meta.Labels) > 0 {
			if existing.Labels == nil {
				existing.Labels = make(map[string]string)
			}
			for k, v := range meta.Labels {
				existing.Labels[k] = v
			}
		}
		return hash, nil
	}

	// Create new metadata
	stored := &ContentMetadata{
		Hash:        hash,
		Size:        int64(len(content)),
		ContentType: meta.ContentType,
		CreatedAt:   time.Now().UTC(),
		ExpiresAt:   meta.ExpiresAt,
		RefCount:    1,
	}
	if len(meta.Labels) > 0 {
		stored.Labels = make(map[string]string)
		for k, v := range meta.Labels {
			stored.Labels[k] = v
		}
	}

	d.content[hash] = copyBytes(content)
	d.metadata[hash] = stored

	return hash, nil
}

// GetMetadata retrieves metadata for a content hash.
func (d *MemoryContentDriver) GetMetadata(ctx context.Context, hash string) (*ContentMetadata, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	meta, ok := d.metadata[hash]
	if !ok {
		return nil, ErrContentNotFound{Hash: hash}
	}

	// Return a copy to prevent mutation
	result := &ContentMetadata{
		Hash:        meta.Hash,
		Size:        meta.Size,
		ContentType: meta.ContentType,
		CreatedAt:   meta.CreatedAt,
		RefCount:    meta.RefCount,
	}
	if meta.ExpiresAt != nil {
		exp := *meta.ExpiresAt
		result.ExpiresAt = &exp
	}
	if len(meta.Labels) > 0 {
		result.Labels = make(map[string]string)
		for k, v := range meta.Labels {
			result.Labels[k] = v
		}
	}

	return result, nil
}

// Stats returns statistics about the content store.
func (d *MemoryContentDriver) Stats() ContentStoreStats {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var totalSize int64
	for _, content := range d.content {
		totalSize += int64(len(content))
	}

	return ContentStoreStats{
		ItemCount: len(d.content),
		TotalSize: totalSize,
	}
}

// Clear removes all content (for testing).
func (d *MemoryContentDriver) Clear() {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.content = make(map[string][]byte)
	d.metadata = make(map[string]*ContentMetadata)
}

// ContentStoreStats holds statistics about content storage.
type ContentStoreStats struct {
	ItemCount int   `json:"item_count"`
	TotalSize int64 `json:"total_size"`
}

// computeHash computes SHA256 hash of content.
func computeHash(content []byte) string {
	h := sha256.Sum256(content)
	return hex.EncodeToString(h[:])
}

// copyBytes creates a copy of byte slice.
func copyBytes(b []byte) []byte {
	if b == nil {
		return nil
	}
	result := make([]byte, len(b))
	copy(result, b)
	return result
}

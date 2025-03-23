package tee

import (
	"testing"
)

func TestBasicMemoryLimiter(t *testing.T) {
	// Create a memory limiter with a 10MB limit
	limiter := NewBasicMemoryLimiter(10)

	// Verify initial state
	if limiter.CurrentUsage() != 0 {
		t.Errorf("Initial usage should be 0, got %d", limiter.CurrentUsage())
	}

	if limiter.Limit() != 10*1024*1024 {
		t.Errorf("Limit should be 10MB (10485760 bytes), got %d", limiter.Limit())
	}

	// Allocate memory within the limit
	err := limiter.Allocate(5 * 1024 * 1024) // 5MB
	if err != nil {
		t.Errorf("Allocation within limit should succeed: %v", err)
	}

	// Verify current usage
	if limiter.CurrentUsage() != 5*1024*1024 {
		t.Errorf("Current usage should be 5MB, got %d", limiter.CurrentUsage())
	}

	// Allocate more memory within the limit
	err = limiter.Allocate(4 * 1024 * 1024) // 4MB
	if err != nil {
		t.Errorf("Allocation within limit should succeed: %v", err)
	}

	// Verify current usage
	if limiter.CurrentUsage() != 9*1024*1024 {
		t.Errorf("Current usage should be 9MB, got %d", limiter.CurrentUsage())
	}

	// Try to allocate more than the limit
	err = limiter.Allocate(2 * 1024 * 1024) // 2MB, would exceed 10MB limit
	if err == nil {
		t.Error("Allocation exceeding limit should fail")
	}

	// Verify current usage is unchanged
	if limiter.CurrentUsage() != 9*1024*1024 {
		t.Errorf("Current usage should still be 9MB, got %d", limiter.CurrentUsage())
	}

	// Release some memory
	limiter.Release(3 * 1024 * 1024) // 3MB

	// Verify current usage
	if limiter.CurrentUsage() != 6*1024*1024 {
		t.Errorf("Current usage should be 6MB after release, got %d", limiter.CurrentUsage())
	}

	// Try allocation again after release
	err = limiter.Allocate(2 * 1024 * 1024) // 2MB
	if err != nil {
		t.Errorf("Allocation within limit should succeed after release: %v", err)
	}

	// Verify current usage
	if limiter.CurrentUsage() != 8*1024*1024 {
		t.Errorf("Current usage should be 8MB, got %d", limiter.CurrentUsage())
	}

	// Reset the limiter
	limiter.Reset()

	// Verify usage is reset to 0
	if limiter.CurrentUsage() != 0 {
		t.Errorf("Usage should be 0 after reset, got %d", limiter.CurrentUsage())
	}
}

func TestMemoryLimitedArrayBufferAllocator(t *testing.T) {
	// Create a memory limiter with a 1MB limit
	limiter := NewBasicMemoryLimiter(1)

	// Create an array buffer allocator with the limiter
	allocator := NewMemoryLimitedArrayBufferAllocator(limiter)

	// Allocate a buffer within the limit
	buffer, err := allocator.Allocate(512 * 1024) // 512KB
	if err != nil {
		t.Errorf("Allocation within limit should succeed: %v", err)
	}

	// Verify buffer size
	if len(buffer) != 512*1024 {
		t.Errorf("Buffer size should be 512KB, got %d", len(buffer))
	}

	// Verify limiter usage
	if limiter.CurrentUsage() != 512*1024 {
		t.Errorf("Limiter usage should be 512KB, got %d", limiter.CurrentUsage())
	}

	// Try to allocate more than the limit
	_, err = allocator.Allocate(768 * 1024) // 768KB, would exceed 1MB limit
	if err == nil {
		t.Error("Allocation exceeding limit should fail")
	}

	// Free the buffer
	allocator.Free(buffer)

	// Verify limiter usage after free
	if limiter.CurrentUsage() != 0 {
		t.Errorf("Limiter usage should be 0 after free, got %d", limiter.CurrentUsage())
	}

	// Try allocation again after free
	buffer, err = allocator.Allocate(768 * 1024) // 768KB
	if err != nil {
		t.Errorf("Allocation within limit should succeed after free: %v", err)
	}

	// Verify buffer size
	if len(buffer) != 768*1024 {
		t.Errorf("Buffer size should be 768KB, got %d", len(buffer))
	}
}

package tee

import (
	"fmt"
	"sync"
)

// MemoryLimiter provides an interface for tracking and limiting memory usage
type MemoryLimiter interface {
	// Allocate requests memory allocation and returns error if limit exceeded
	Allocate(size int) error

	// Release notifies the limiter that memory has been freed
	Release(size int)

	// CurrentUsage returns the current memory usage in bytes
	CurrentUsage() int64

	// Limit returns the maximum allowed memory usage in bytes
	Limit() int64

	// Reset resets the memory usage counter
	Reset()
}

// BasicMemoryLimiter implements the MemoryLimiter interface
type BasicMemoryLimiter struct {
	allocated int64
	limit     int64
	mu        sync.Mutex
}

// NewBasicMemoryLimiter creates a new memory limiter with the specified limit in MB
func NewBasicMemoryLimiter(limitMB int64) *BasicMemoryLimiter {
	return &BasicMemoryLimiter{
		allocated: 0,
		limit:     limitMB * 1024 * 1024, // Convert to bytes
	}
}

// Allocate checks if the allocation would exceed the limit
func (l *BasicMemoryLimiter) Allocate(size int) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.allocated+int64(size) > l.limit {
		return fmt.Errorf("memory limit exceeded: would use %d bytes, limit is %d bytes",
			l.allocated+int64(size), l.limit)
	}

	l.allocated += int64(size)
	return nil
}

// Release decrements the allocated memory counter
func (l *BasicMemoryLimiter) Release(size int) {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.allocated -= int64(size)
	if l.allocated < 0 {
		// This shouldn't happen, but prevent negative values
		l.allocated = 0
	}
}

// CurrentUsage returns the current memory usage
func (l *BasicMemoryLimiter) CurrentUsage() int64 {
	l.mu.Lock()
	defer l.mu.Unlock()

	return l.allocated
}

// Limit returns the memory limit
func (l *BasicMemoryLimiter) Limit() int64 {
	return l.limit
}

// Reset resets the memory usage counter
func (l *BasicMemoryLimiter) Reset() {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.allocated = 0
}

// MemoryLimitedArrayBufferAllocator implements Goja's ArrayBufferAllocator interface
type MemoryLimitedArrayBufferAllocator struct {
	limiter MemoryLimiter
}

// NewMemoryLimitedArrayBufferAllocator creates a new array buffer allocator with memory limits
func NewMemoryLimitedArrayBufferAllocator(limiter MemoryLimiter) *MemoryLimitedArrayBufferAllocator {
	return &MemoryLimitedArrayBufferAllocator{
		limiter: limiter,
	}
}

// Allocate attempts to allocate memory, checking against the limit
func (a *MemoryLimitedArrayBufferAllocator) Allocate(size int) ([]byte, error) {
	if err := a.limiter.Allocate(size); err != nil {
		return nil, err
	}

	return make([]byte, size), nil
}

// Free releases allocated memory
func (a *MemoryLimitedArrayBufferAllocator) Free(buf []byte) {
	a.limiter.Release(len(buf))
}

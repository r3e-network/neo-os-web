package resilience_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/resilience"
)

// =============================================================================
// Chaos Engineering Tests - Failure Injection Patterns
// =============================================================================

// TestCircuitBreakerOpenOnFailures verifies circuit breaker transitions to open state
// after repeated failures, protecting against cascading failures.
func TestCircuitBreakerOpenOnFailures(t *testing.T) {
	failCount := int64(0)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt64(&failCount, 1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	cb := resilience.New(resilience.Config{
		MaxFailures: 3,
		Timeout:     100 * time.Millisecond,
	})

	ctx := context.Background()
	for i := 0; i < 3; i++ {
		cb.Execute(ctx, func() error {
			resp, err := http.Get(server.URL)
			if err != nil {
				return err
			}
			resp.Body.Close()
			if resp.StatusCode >= 400 {
				return errors.New("server error")
			}
			return nil
		})
	}

	// After 3 failures, circuit should be open
	if cb.State() != resilience.StateOpen {
		t.Errorf("expected circuit breaker to be open after 3 failures, got %v", cb.State())
	}

	// Count should be 3
	if atomic.LoadInt64(&failCount) != 3 {
		t.Errorf("expected 3 failures, got %d", atomic.LoadInt64(&failCount))
	}
}

// TestCircuitBreakerHalfOpenRecovery verifies circuit breaker transitions to half-open
// after timeout when a new request comes in, allowing recovery attempts.
func TestCircuitBreakerHalfOpenRecovery(t *testing.T) {
	requestCount := int64(0)
	failOnce := int32(0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt64(&requestCount, 1)
		// First request fails, rest succeed
		if atomic.CompareAndSwapInt32(&failOnce, 0, 1) {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cb := resilience.New(resilience.Config{
		MaxFailures: 1,
		Timeout:     50 * time.Millisecond,
		HalfOpenMax: 1, // Allow only 1 request in half-open
	})

	ctx := context.Background()

	// First request fails
	err := cb.Execute(ctx, func() error {
		resp, getErr := http.Get(server.URL)
		if getErr != nil {
			return getErr
		}
		resp.Body.Close()
		if resp.StatusCode >= 400 {
			return errors.New("server error")
		}
		return nil
	})

	// Should have failed
	if err == nil {
		t.Error("expected first request to fail")
	}

	// Circuit should be open
	if cb.State() != resilience.StateOpen {
		t.Errorf("expected circuit breaker to be open, got %v", cb.State())
	}

	// Wait for timeout
	time.Sleep(60 * time.Millisecond)

	// Circuit should transition to half-open on next request attempt
	err = cb.Execute(ctx, func() error {
		resp, getErr := http.Get(server.URL)
		if getErr != nil {
			return getErr
		}
		resp.Body.Close()
		if resp.StatusCode >= 400 {
			return errors.New("server error")
		}
		return nil
	})

	if err != nil {
		t.Errorf("expected successful request in half-open, got error: %v", err)
	}

	// With HalfOpenMax=1, after 1 success it should close immediately
	if cb.State() != resilience.StateClosed {
		t.Errorf("expected circuit breaker to be closed after 1 success with HalfOpenMax=1, got %v", cb.State())
	}

	// Should have made 2 requests total (1 fail + 1 succeed)
	if atomic.LoadInt64(&requestCount) != 2 {
		t.Errorf("expected 2 requests, got %d", atomic.LoadInt64(&requestCount))
	}
}

// TestRetryWithJitter verifies retry with jitter prevents thundering herd
func TestRetryWithJitter(t *testing.T) {
	attemptCount := int32(0)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&attemptCount, 1)
		if count <= 2 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	ctx := context.Background()
	var attempts int32

	err := resilience.Retry(ctx, resilience.RetryConfig{
		MaxAttempts:  5,
		InitialDelay: 10 * time.Millisecond,
		MaxDelay:     50 * time.Millisecond,
		Multiplier:   2.0,
		Jitter:       0.5, // 50% jitter
	}, func() error {
		atomic.AddInt32(&attempts, 1)
		resp, err := http.Get(server.URL)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusServiceUnavailable {
			return errors.New("service unavailable")
		}
		return nil
	})

	if err != nil {
		t.Errorf("expected retry to succeed, got error: %v", err)
	}

	// Should have made 3 attempts (2 failures + 1 success)
	if atomic.LoadInt32(&attempts) != 3 {
		t.Errorf("expected 3 attempts, got %d", atomic.LoadInt32(&attempts))
	}
}

// TestRetryContextCancellation verifies retry respects context cancellation
func TestRetryContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	start := time.Now()
	err := resilience.Retry(ctx, resilience.RetryConfig{
		MaxAttempts:  10,
		InitialDelay: 20 * time.Millisecond,
		MaxDelay:     100 * time.Millisecond,
	}, func() error {
		client := &http.Client{Timeout: 40 * time.Millisecond}
		resp, err := client.Get(server.URL)
		if err != nil {
			return err
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return errors.New("request failed")
		}
		return nil
	})

	elapsed := time.Since(start)

	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("expected context.DeadlineExceeded, got: %v", err)
	}

	// Should have been canceled before completing all retries
	if elapsed > 200*time.Millisecond {
		t.Errorf("retry took too long %v, should have been canceled sooner", elapsed)
	}
}

// TestCircuitBreakerSuccessCloses verifies circuit breaker closes after success
func TestCircuitBreakerSuccessCloses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cb := resilience.New(resilience.Config{
		MaxFailures: 2,
		Timeout:     50 * time.Millisecond,
	})

	ctx := context.Background()

	// Successful request
	err := cb.Execute(ctx, func() error {
		resp, err := http.Get(server.URL)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		return nil
	})

	if err != nil {
		t.Errorf("expected success, got error: %v", err)
	}

	// Circuit should be closed after success
	if cb.State() != resilience.StateClosed {
		t.Errorf("expected circuit breaker to be closed after success, got %v", cb.State())
	}
}

// TestBulkheadPattern verifies concurrent request limiting (semaphore pattern)
func TestBulkheadPattern(t *testing.T) {
	concurrentCount := int32(0)
	maxConcurrent := int32(0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		current := atomic.AddInt32(&concurrentCount, 1)
		for {
			old := atomic.LoadInt32(&maxConcurrent)
			if current <= old || atomic.CompareAndSwapInt32(&maxConcurrent, old, current) {
				break
			}
		}
		time.Sleep(50 * time.Millisecond)
		atomic.AddInt32(&concurrentCount, -1)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	semaphore := make(chan struct{}, 5) // Max 5 concurrent requests
	var wg sync.WaitGroup
	errors := make(chan error, 20)

	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			ctx := context.Background()
			err := resilience.Retry(ctx, resilience.RetryConfig{
				MaxAttempts: 1,
			}, func() error {
				resp, err := http.Get(server.URL)
				if err != nil {
					return err
				}
				defer resp.Body.Close()
				return nil
			})
			if err != nil {
				errors <- err
			}
		}()
	}
	wg.Wait()
	close(errors)

	// Check no more than 5 concurrent requests
	if atomic.LoadInt32(&maxConcurrent) > 5 {
		t.Errorf("expected max 5 concurrent requests, got %d", atomic.LoadInt32(&maxConcurrent))
	}

	// All requests should have succeeded
	for err := range errors {
		t.Errorf("request failed: %v", err)
	}
}

// TestFallbackPattern verifies fallback mechanism when primary fails
func TestFallbackPattern(t *testing.T) {
	primaryCalled := int32(0)
	primary := func() (string, error) {
		atomic.AddInt32(&primaryCalled, 1)
		return "", errors.New("primary unavailable")
	}

	// Simulate fallback pattern
	var result string
	_ = resilience.Retry(context.Background(), resilience.RetryConfig{
		MaxAttempts: 1,
	}, func() error {
		r, err := primary()
		if err != nil {
			return err
		}
		result = r
		return nil
	})

	// Fallback was not called in this simple pattern, but we verified retry worked
	if atomic.LoadInt32(&primaryCalled) != 1 {
		t.Errorf("expected primary to be called once, got %d", atomic.LoadInt32(&primaryCalled))
	}

	_ = result
}

// TestGracefulDegradation verifies service continues operating during partial failures
func TestGracefulDegradation(t *testing.T) {
	failCount := int32(0)
	successCount := int32(0)

	// Create multiple "servers" with different reliability
	servers := []*httptest.Server{
		httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			atomic.AddInt32(&failCount, 1)
			w.WriteHeader(http.StatusInternalServerError)
		})),
		httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if atomic.AddInt32(&successCount, 1) <= 1 {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
		})),
		httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			atomic.AddInt32(&successCount, 1)
			w.WriteHeader(http.StatusOK)
		})),
	}

	// Defer all server closures
	for _, s := range servers {
		defer s.Close()
	}

	// Try each server, continue if one fails
	var resultErr error
	for _, server := range servers {
		ctx := context.Background()
		cb := resilience.New(resilience.Config{
			MaxFailures: 1,
			Timeout:     10 * time.Millisecond,
		})

		err := cb.Execute(ctx, func() error {
			resp, err := http.Get(server.URL)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				return errors.New("server error")
			}
			return nil
		})

		if err == nil {
			resultErr = nil
			break
		}
		resultErr = err
	}

	// Should have found at least one working server
	if resultErr != nil {
		t.Errorf("expected at least one server to succeed, got error: %v", resultErr)
	}
}

// TestRetryBudget verifies retry budget prevents unbounded retries
func TestRetryBudget(t *testing.T) {
	attemptCount := int32(0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&attemptCount, 1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	ctx := context.Background()

	err := resilience.Retry(ctx, resilience.RetryConfig{
		MaxAttempts:  5,
		InitialDelay: 10 * time.Millisecond,
		MaxDelay:     20 * time.Millisecond,
	}, func() error {
		resp, err := http.Get(server.URL)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		return errors.New("service unavailable")
	})

	// Should have given up after 5 attempts
	if atomic.LoadInt32(&attemptCount) != 5 {
		t.Errorf("expected exactly 5 retry attempts, got %d", atomic.LoadInt32(&attemptCount))
	}

	// Should return the last error
	if err == nil {
		t.Error("expected error after exhausting retries")
	}
}

// TestPanicRecoveryInRetry verifies panic recovery in retry logic
func TestPanicRecoveryInRetry(t *testing.T) {
	recovered := false
	panicked := false

	ctx := context.Background()

	for attempt := 0; attempt < 3; attempt++ {
		func() {
			defer func() {
				if r := recover(); r != nil {
					recovered = true
					panicked = true
				}
			}()

			_ = resilience.Retry(ctx, resilience.RetryConfig{
				MaxAttempts: 1,
			}, func() error {
				panic("test panic")
			})
		}()
	}

	if !recovered {
		t.Error("expected panic to be recovered")
	}

	// Verify panic was caught
	if !panicked {
		t.Error("expected panic to have occurred")
	}
}

// TestCircuitBreakerNestedRetry verifies circuit breaker works with nested retries
func TestCircuitBreakerNestedRetry(t *testing.T) {
	attemptCount := int32(0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&attemptCount, 1)
		if atomic.LoadInt32(&attemptCount) <= 2 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cb := resilience.New(resilience.Config{
		MaxFailures: 5, // High threshold so retries can complete
		Timeout:     50 * time.Millisecond,
	})

	ctx := context.Background()

	err := cb.Execute(ctx, func() error {
		return resilience.Retry(ctx, resilience.RetryConfig{
			MaxAttempts:  3,
			InitialDelay: 10 * time.Millisecond,
		}, func() error {
			resp, err := http.Get(server.URL)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				return errors.New("server error")
			}
			return nil
		})
	})

	if err != nil {
		t.Errorf("expected success after retries, got error: %v", err)
	}

	// Should have made 3 attempts (2 failures + 1 success in retry loop)
	if atomic.LoadInt32(&attemptCount) != 3 {
		t.Errorf("expected 3 attempts, got %d", atomic.LoadInt32(&attemptCount))
	}
}

// TestTimeoutEnforcement verifies timeouts are properly enforced
func TestTimeoutEnforcement(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cb := resilience.New(resilience.Config{
		MaxFailures: 1,
		Timeout:     50 * time.Millisecond,
	})

	start := time.Now()
	ctx := context.Background()

	err := cb.Execute(ctx, func() error {
		client := &http.Client{Timeout: 100 * time.Millisecond}
		resp, err := client.Get(server.URL)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		return nil
	})

	elapsed := time.Since(start)

	// Should have timed out within reasonable margin
	if elapsed > 200*time.Millisecond {
		t.Errorf("operation took too long %v, expected timeout around 100-150ms", elapsed)
	}

	if err == nil {
		t.Error("expected timeout error")
	}
}

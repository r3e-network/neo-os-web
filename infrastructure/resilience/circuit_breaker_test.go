package resilience

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestCircuitBreaker_ClosedState(t *testing.T) {
	cb := New(DefaultConfig())

	err := cb.Execute(context.Background(), func() error {
		return nil
	})

	if err != nil {
		t.Errorf("expected nil, got %v", err)
	}
	if cb.State() != StateClosed {
		t.Errorf("expected closed, got %v", cb.State())
	}
}

func TestCircuitBreaker_OpensAfterFailures(t *testing.T) {
	cb := New(Config{MaxFailures: 3, Timeout: time.Second})
	testErr := errors.New("test error")

	for i := 0; i < 3; i++ {
		cb.Execute(context.Background(), func() error {
			return testErr
		})
	}

	if cb.State() != StateOpen {
		t.Errorf("expected open, got %v", cb.State())
	}
}

func TestCircuitBreaker_HalfOpenAfterTimeout(t *testing.T) {
	cb := New(Config{MaxFailures: 1, Timeout: 10 * time.Millisecond, HalfOpenMax: 2})

	cb.Execute(context.Background(), func() error {
		return errors.New("fail")
	})

	time.Sleep(20 * time.Millisecond)

	// Need HalfOpenMax successes to close
	for i := 0; i < 2; i++ {
		cb.Execute(context.Background(), func() error {
			return nil
		})
	}

	if cb.State() != StateClosed {
		t.Errorf("expected closed after successes, got %v", cb.State())
	}
}

func TestCircuitBreaker_RejectsWhenOpen(t *testing.T) {
	cb := New(Config{MaxFailures: 1, Timeout: time.Hour})

	cb.Execute(context.Background(), func() error {
		return errors.New("fail")
	})

	err := cb.Execute(context.Background(), func() error {
		return nil
	})

	if err != ErrCircuitOpen {
		t.Errorf("expected ErrCircuitOpen, got %v", err)
	}
}

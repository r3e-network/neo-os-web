package resilience

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestRetry_Success(t *testing.T) {
	cfg := RetryConfig{MaxAttempts: 3, InitialDelay: time.Millisecond}

	err := Retry(context.Background(), cfg, func() error {
		return nil
	})

	if err != nil {
		t.Errorf("expected nil, got %v", err)
	}
}

func TestRetry_EventualSuccess(t *testing.T) {
	cfg := RetryConfig{MaxAttempts: 3, InitialDelay: time.Millisecond}
	attempts := 0

	err := Retry(context.Background(), cfg, func() error {
		attempts++
		if attempts < 3 {
			return errors.New("fail")
		}
		return nil
	})

	if err != nil {
		t.Errorf("expected nil, got %v", err)
	}
	if attempts != 3 {
		t.Errorf("expected 3 attempts, got %d", attempts)
	}
}

func TestRetry_AllFail(t *testing.T) {
	cfg := RetryConfig{MaxAttempts: 2, InitialDelay: time.Millisecond}
	testErr := errors.New("always fail")

	err := Retry(context.Background(), cfg, func() error {
		return testErr
	})

	if err != testErr {
		t.Errorf("expected testErr, got %v", err)
	}
}

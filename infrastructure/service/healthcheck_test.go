package service

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestNewDeepHealthCheckerDefaultTimeout(t *testing.T) {
	hc := NewDeepHealthChecker(0)
	if hc == nil {
		t.Fatal("NewDeepHealthChecker returned nil")
	}
	if hc.timeout != 10*time.Second {
		t.Errorf("timeout = %v, want 10s", hc.timeout)
	}
}

func TestDeepHealthCheckerAllHealthy(t *testing.T) {
	hc := NewDeepHealthChecker(5 * time.Second)
	hc.Register("db", func(ctx context.Context) *ComponentHealth {
		return &ComponentHealth{Status: "healthy"}
	})

	result := hc.Check(context.Background(), "test-svc", "1.0", false, time.Minute)
	if result.Status != "healthy" {
		t.Errorf("Status = %q, want healthy", result.Status)
	}
	if len(result.Components) != 1 {
		t.Errorf("Components count = %d, want 1", len(result.Components))
	}
}

func TestDeepHealthCheckerUnhealthyAggregation(t *testing.T) {
	hc := NewDeepHealthChecker(5 * time.Second)
	hc.Register("ok", func(ctx context.Context) *ComponentHealth {
		return &ComponentHealth{Status: "healthy"}
	})
	hc.Register("bad", func(ctx context.Context) *ComponentHealth {
		return &ComponentHealth{Status: "unhealthy", Message: "down"}
	})

	result := hc.Check(context.Background(), "svc", "1.0", false, 0)
	if result.Status != "unhealthy" {
		t.Errorf("Status = %q, want unhealthy", result.Status)
	}
}

func TestDeepHealthCheckerDegradedAggregation(t *testing.T) {
	hc := NewDeepHealthChecker(5 * time.Second)
	hc.Register("ok", func(ctx context.Context) *ComponentHealth {
		return &ComponentHealth{Status: "healthy"}
	})
	hc.Register("slow", func(ctx context.Context) *ComponentHealth {
		return &ComponentHealth{Status: "degraded"}
	})

	result := hc.Check(context.Background(), "svc", "1.0", false, 0)
	if result.Status != "degraded" {
		t.Errorf("Status = %q, want degraded", result.Status)
	}
}

func TestDeepHealthCheckerNilCheckResult(t *testing.T) {
	hc := NewDeepHealthChecker(5 * time.Second)
	hc.Register("nil-check", func(ctx context.Context) *ComponentHealth {
		return nil // should be handled gracefully
	})

	result := hc.Check(context.Background(), "svc", "1.0", false, 0)
	if len(result.Components) != 1 {
		t.Fatalf("Components = %d, want 1", len(result.Components))
	}
	if result.Components[0].Name != "nil-check" {
		t.Errorf("Name = %q, want nil-check", result.Components[0].Name)
	}
}

func TestDeepHealthCheckerLastResult(t *testing.T) {
	hc := NewDeepHealthChecker(5 * time.Second)
	if hc.LastResult() != nil {
		t.Error("LastResult should be nil before first Check")
	}

	hc.Check(context.Background(), "svc", "1.0", false, 0)
	if hc.LastResult() == nil {
		t.Error("LastResult should be non-nil after Check")
	}
}

func TestDatabaseHealthCheck(t *testing.T) {
	// Healthy ping
	check := DatabaseHealthCheck("db", func(ctx context.Context) error {
		return nil
	})
	result := check(context.Background())
	if result.Status != "healthy" {
		t.Errorf("healthy ping: Status = %q", result.Status)
	}

	// Unhealthy ping
	check = DatabaseHealthCheck("db", func(ctx context.Context) error {
		return fmt.Errorf("connection refused")
	})
	result = check(context.Background())
	if result.Status != "unhealthy" {
		t.Errorf("unhealthy ping: Status = %q", result.Status)
	}
}

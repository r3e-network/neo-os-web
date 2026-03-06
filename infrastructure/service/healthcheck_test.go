package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
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

func TestHTTPHealthCheckClassifiesStatusAndIncludesDetails(t *testing.T) {
	t.Run("healthy 200", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		check := HTTPHealthCheck("upstream", server.URL, time.Second)
		result := check(context.Background())
		if result.Status != "healthy" {
			t.Fatalf("status = %q, want healthy", result.Status)
		}
	})

	t.Run("degraded 3xx does not follow redirects", func(t *testing.T) {
		var redirectedHits int32
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			atomic.AddInt32(&redirectedHits, 1)
			w.WriteHeader(http.StatusOK)
		}))
		defer target.Close()

		redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, target.URL, http.StatusFound)
		}))
		defer redirector.Close()

		check := HTTPHealthCheck("upstream", redirector.URL, time.Second)
		result := check(context.Background())
		if result.Status != "degraded" {
			t.Fatalf("status = %q, want degraded", result.Status)
		}
		if !strings.Contains(result.Message, "302 Found") {
			t.Fatalf("message = %q, want redirect status text", result.Message)
		}
		if hits := atomic.LoadInt32(&redirectedHits); hits != 0 {
			t.Fatalf("redirect target should not be called, got %d hit(s)", hits)
		}
	})

	t.Run("degraded 4xx includes status text and body", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, "route missing")
		}))
		defer server.Close()

		check := HTTPHealthCheck("upstream", server.URL, time.Second)
		result := check(context.Background())
		if result.Status != "degraded" {
			t.Fatalf("status = %q, want degraded", result.Status)
		}
		if !strings.Contains(result.Message, "404 Not Found") {
			t.Fatalf("message = %q, want status text", result.Message)
		}
		if !strings.Contains(result.Message, "route missing") {
			t.Fatalf("message = %q, want response body", result.Message)
		}
	})

	t.Run("unhealthy 5xx includes status text and body", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = io.WriteString(w, "backend unavailable")
		}))
		defer server.Close()

		check := HTTPHealthCheck("upstream", server.URL, time.Second)
		result := check(context.Background())
		if result.Status != "unhealthy" {
			t.Fatalf("status = %q, want unhealthy", result.Status)
		}
		if !strings.Contains(result.Message, "503 Service Unavailable") {
			t.Fatalf("message = %q, want status text", result.Message)
		}
		if !strings.Contains(result.Message, "backend unavailable") {
			t.Fatalf("message = %q, want response body", result.Message)
		}
	})
}

func TestReadHealthCheckBodyNilReader(t *testing.T) {
	t.Parallel()

	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("readHealthCheckBody should not panic for nil body: %v", r)
		}
	}()

	_, _, err := readHealthCheckBody(nil, 4<<10)
	if err == nil {
		t.Fatal("expected error for nil body")
	}
}

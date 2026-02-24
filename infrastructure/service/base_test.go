package service

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/marble"
)

// newTestMarble creates a Marble suitable for unit tests.
func newTestMarble(t *testing.T) *marble.Marble {
	t.Helper()
	m, err := marble.New(marble.Config{MarbleType: "test"})
	if err != nil {
		t.Fatalf("marble.New: %v", err)
	}
	return m
}

func TestNewBaseNilConfig(t *testing.T) {
	bs := NewBase(nil)
	if bs == nil {
		t.Fatal("NewBase(nil) returned nil")
	}
	if bs.Service == nil {
		t.Fatal("embedded marble.Service is nil")
	}
	if bs.StopChan() == nil {
		t.Fatal("stopCh is nil")
	}
	// No DB → dbHealthy defaults to true
	if bs.WorkerCount() != 0 {
		t.Errorf("expected 0 workers, got %d", bs.WorkerCount())
	}
}

func TestNewBaseWithConfig(t *testing.T) {
	m := newTestMarble(t)
	bs := NewBase(&BaseConfig{
		ID:      "svc-1",
		Name:    "TestService",
		Version: "0.1.0",
		Marble:  m,
	})

	if bs.ID() != "svc-1" {
		t.Errorf("ID = %q, want %q", bs.ID(), "svc-1")
	}
	if bs.Name() != "TestService" {
		t.Errorf("Name = %q, want %q", bs.Name(), "TestService")
	}
	if bs.Version() != "0.1.0" {
		t.Errorf("Version = %q, want %q", bs.Version(), "0.1.0")
	}
	if bs.Marble() != m {
		t.Error("Marble() does not match provided marble")
	}
}

func TestStopIdempotent(t *testing.T) {
	bs := NewBase(nil)

	// Start so Stop has something to tear down.
	if err := bs.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}

	// First stop should succeed.
	if err := bs.Stop(); err != nil {
		t.Fatalf("first Stop: %v", err)
	}

	// Second stop must not panic (sync.Once guards close(stopCh)).
	if err := bs.Stop(); err != nil {
		t.Fatalf("second Stop: %v", err)
	}
}

func TestAddWorker(t *testing.T) {
	bs := NewBase(nil)

	var ran atomic.Bool
	bs.AddWorker(func(ctx context.Context) {
		ran.Store(true)
		// Exit immediately so the test doesn't hang.
		<-ctx.Done()
	})

	if bs.WorkerCount() != 1 {
		t.Fatalf("WorkerCount = %d, want 1", bs.WorkerCount())
	}

	ctx, cancel := context.WithCancel(context.Background())
	if err := bs.Start(ctx); err != nil {
		t.Fatalf("Start: %v", err)
	}

	// Give the goroutine a moment to execute.
	time.Sleep(50 * time.Millisecond)

	if !ran.Load() {
		t.Error("worker did not run after Start")
	}

	cancel()
	if err := bs.Stop(); err != nil {
		t.Fatalf("Stop: %v", err)
	}
}

func TestSetStatsFn(t *testing.T) {
	bs := NewBase(&BaseConfig{
		ID:      "stats-svc",
		Name:    "StatsService",
		Version: "1.0.0",
		Marble:  newTestMarble(t),
	})

	called := false
	bs.WithStats(func() map[string]any {
		called = true
		return map[string]any{"requests": 42}
	})

	if bs.statsFn == nil {
		t.Fatal("statsFn not set after WithStats")
	}

	result := bs.statsFn()
	if !called {
		t.Error("statsFn was not invoked")
	}
	if result["requests"] != 42 {
		t.Errorf("statsFn returned %v, want requests=42", result)
	}
}

func TestWithHydrate(t *testing.T) {
	bs := NewBase(nil)

	var order []int
	bs.WithHydrate(func(ctx context.Context) error {
		order = append(order, 1)
		return nil
	})
	bs.WithHydrate(func(ctx context.Context) error {
		order = append(order, 2)
		return nil
	})

	if err := bs.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer bs.Stop()

	if len(order) != 2 || order[0] != 1 || order[1] != 2 {
		t.Errorf("hydrate order = %v, want [1 2]", order)
	}
}

func TestWorkersAlias(t *testing.T) {
	bs := NewBase(nil)
	bs.AddWorker(func(ctx context.Context) { <-ctx.Done() })
	bs.AddWorker(func(ctx context.Context) { <-ctx.Done() })

	if bs.Workers() != bs.WorkerCount() {
		t.Errorf("Workers() = %d != WorkerCount() = %d", bs.Workers(), bs.WorkerCount())
	}
	if bs.Workers() != 2 {
		t.Errorf("Workers() = %d, want 2", bs.Workers())
	}
}

func TestHealthStatusNoDBNoSecrets(t *testing.T) {
	bs := NewBase(nil)

	status := bs.HealthStatus()
	if status != "healthy" {
		t.Errorf("HealthStatus = %q, want %q", status, "healthy")
	}

	details := bs.HealthDetails()
	if details["db_connected"] != true {
		t.Errorf("db_connected = %v, want true (no DB configured)", details["db_connected"])
	}
	if details["secrets_loaded"] != true {
		t.Errorf("secrets_loaded = %v, want true (no secrets required)", details["secrets_loaded"])
	}
}

func TestLoggerNilReceiver(t *testing.T) {
	var bs *BaseService
	logger := bs.Logger()
	if logger == nil {
		t.Fatal("Logger() on nil receiver returned nil")
	}
}

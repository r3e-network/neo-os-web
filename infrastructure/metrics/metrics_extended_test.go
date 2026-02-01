package metrics

import (
	"os"
	"testing"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/runtime"
)

func TestNewMetricsInstance(t *testing.T) {
	// Use a custom registry to avoid conflicts with default registry
	registry := prometheus.NewRegistry()

	m := NewWithRegistry("test-service", registry)
	if m == nil {
		t.Fatal("NewWithRegistry() returned nil")
	}

	// Verify all metrics are initialized
	if m.RequestsTotal == nil {
		t.Error("RequestsTotal should not be nil")
	}
	if m.RequestDuration == nil {
		t.Error("RequestDuration should not be nil")
	}
	if m.RequestsInFlight == nil {
		t.Error("RequestsInFlight should not be nil")
	}
	if m.ErrorsTotal == nil {
		t.Error("ErrorsTotal should not be nil")
	}
	if m.BlockchainTxTotal == nil {
		t.Error("BlockchainTxTotal should not be nil")
	}
	if m.BlockchainTxDuration == nil {
		t.Error("BlockchainTxDuration should not be nil")
	}
	if m.DatabaseQueriesTotal == nil {
		t.Error("DatabaseQueriesTotal should not be nil")
	}
	if m.DatabaseQueryDuration == nil {
		t.Error("DatabaseQueryDuration should not be nil")
	}
	if m.DatabaseConnectionsOpen == nil {
		t.Error("DatabaseConnectionsOpen should not be nil")
	}
	if m.ServiceUptime == nil {
		t.Error("ServiceUptime should not be nil")
	}
	if m.ServiceInfo == nil {
		t.Error("ServiceInfo should not be nil")
	}
}

func TestEnabled(t *testing.T) {
	// Save and restore environment
	savedMetrics := os.Getenv("METRICS_ENABLED")
	savedMarble := os.Getenv("MARBLE_ENV")
	defer func() {
		if savedMetrics != "" {
			os.Setenv("METRICS_ENABLED", savedMetrics)
		} else {
			os.Unsetenv("METRICS_ENABLED")
		}
		if savedMarble != "" {
			os.Setenv("MARBLE_ENV", savedMarble)
		} else {
			os.Unsetenv("MARBLE_ENV")
		}
	}()

	t.Run("explicitly enabled", func(t *testing.T) {
		os.Setenv("METRICS_ENABLED", "true")
		if !Enabled() {
			t.Error("Enabled() should return true when METRICS_ENABLED=true")
		}
	})

	t.Run("enabled with 1", func(t *testing.T) {
		os.Setenv("METRICS_ENABLED", "1")
		if !Enabled() {
			t.Error("Enabled() should return true when METRICS_ENABLED=1")
		}
	})

	t.Run("enabled with yes", func(t *testing.T) {
		os.Setenv("METRICS_ENABLED", "yes")
		if !Enabled() {
			t.Error("Enabled() should return true when METRICS_ENABLED=yes")
		}
	})

	t.Run("enabled with on", func(t *testing.T) {
		os.Setenv("METRICS_ENABLED", "on")
		if !Enabled() {
			t.Error("Enabled() should return true when METRICS_ENABLED=on")
		}
	})

	t.Run("explicitly disabled", func(t *testing.T) {
		os.Setenv("METRICS_ENABLED", "false")
		if Enabled() {
			t.Error("Enabled() should return false when METRICS_ENABLED=false")
		}
	})

	t.Run("disabled with 0", func(t *testing.T) {
		os.Setenv("METRICS_ENABLED", "0")
		if Enabled() {
			t.Error("Enabled() should return false when METRICS_ENABLED=0")
		}
	})

	t.Run("default in development", func(t *testing.T) {
		runtime.ResetEnvCache()
		os.Unsetenv("METRICS_ENABLED")
		os.Setenv("MARBLE_ENV", "development")
		if !Enabled() {
			t.Error("Enabled() should return true by default in development")
		}
	})

	t.Run("default in production", func(t *testing.T) {
		runtime.ResetEnvCache()
		os.Unsetenv("METRICS_ENABLED")
		os.Setenv("MARBLE_ENV", "production")
		if Enabled() {
			t.Error("Enabled() should return false by default in production")
		}
	})

	t.Run("case insensitive", func(t *testing.T) {
		os.Setenv("METRICS_ENABLED", "TRUE")
		if !Enabled() {
			t.Error("Enabled() should be case insensitive")
		}
	})

	t.Run("whitespace trimmed", func(t *testing.T) {
		os.Setenv("METRICS_ENABLED", "  true  ")
		if !Enabled() {
			t.Error("Enabled() should trim whitespace")
		}
	})
}

func TestInitAndGlobal(t *testing.T) {
	// Note: We can't fully reset global state because Prometheus default registry
	// doesn't allow re-registration of the same metrics.
	// These tests verify the behavior without resetting.

	t.Run("Init creates or returns global instance", func(t *testing.T) {
		m := Init("test-service")
		if m == nil {
			t.Fatal("Init() returned nil")
		}
	})

	t.Run("Init is idempotent", func(t *testing.T) {
		m1 := Init("service-1")
		m2 := Init("service-2")
		if m1 != m2 {
			t.Error("Init() should return same instance on subsequent calls")
		}
	})

	t.Run("Global returns same instance as Init", func(t *testing.T) {
		m1 := Init("test-service")
		m2 := Global()
		if m1 != m2 {
			t.Error("Global() should return same instance as Init()")
		}
	})

	t.Run("Global returns non-nil", func(t *testing.T) {
		m := Global()
		if m == nil {
			t.Fatal("Global() returned nil")
		}
	})
}

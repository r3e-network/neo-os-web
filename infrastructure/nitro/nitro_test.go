// Package nitro provides the core Nitro SDK for AWS Nitro integration.
package nitro

import (
	"context"
	"testing"
)

// =============================================================================
// Nitro Tests
// =============================================================================

func TestNewNitro(t *testing.T) {
	m, err := New(Config{
		NitroType: "test-nitro",
		DNSNames:   []string{"localhost"},
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	if m.NitroType() != "test-nitro" {
		t.Errorf("NitroType() = %s, want test-nitro", m.NitroType())
	}
}

func TestNitroType(t *testing.T) {
	tests := []struct {
		name       string
		nitroType string
	}{
		{"neofeeds", "neofeeds"},
		{"neocompute", "neocompute"},
		{"empty", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, _ := New(Config{NitroType: tt.nitroType})
			if m.NitroType() != tt.nitroType {
				t.Errorf("NitroType() = %s, want %s", m.NitroType(), tt.nitroType)
			}
		})
	}
}

func TestNitroIsEnclave(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	// Outside enclave, report should be nil.
	// This test runs outside Nitro enclaves, so IsEnclave should return false.
	if m.IsEnclave() {
		t.Log("Running inside enclave (unexpected in test environment)")
	} else {
		t.Log("Running outside enclave (expected in test environment)")
	}
}

func TestNitroSecret(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	// Manually inject a secret for testing
	m.secrets["test-secret"] = []byte("secret-value")

	secret, ok := m.Secret("test-secret")
	if !ok {
		t.Error("Secret() should return true for existing secret")
	}
	if string(secret) != "secret-value" {
		t.Errorf("Secret() = %s, want secret-value", string(secret))
	}

	_, ok = m.Secret("nonexistent")
	if ok {
		t.Error("Secret() should return false for nonexistent secret")
	}
}

func TestNitroUseSecret(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})
	m.secrets["test-secret"] = []byte("secret-value")

	var capturedSecret string
	err := m.UseSecret("test-secret", func(secret []byte) error {
		capturedSecret = string(secret)
		return nil
	})

	if err != nil {
		t.Errorf("UseSecret() error = %v", err)
	}
	if capturedSecret != "secret-value" {
		t.Errorf("UseSecret() captured = %s, want secret-value", capturedSecret)
	}
}

func TestNitroUseSecretNotFound(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	err := m.UseSecret("nonexistent", func(secret []byte) error {
		return nil
	})

	if err == nil {
		t.Error("UseSecret() should return error for nonexistent secret")
	}
}

func TestNitroInitialize(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	// Set environment variables for testing
	t.Setenv("NITRO_UUID", "test-uuid-123")

	ctx := context.Background()
	err := m.Initialize(ctx)
	if err != nil {
		t.Errorf("Initialize() error = %v", err)
	}

	if m.UUID() != "test-uuid-123" {
		t.Errorf("UUID() = %s, want test-uuid-123", m.UUID())
	}
}

func TestNitroInitializeIdempotent(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	ctx := context.Background()
	_ = m.Initialize(ctx)
	err := m.Initialize(ctx)

	if err != nil {
		t.Errorf("Initialize() should be idempotent, got error = %v", err)
	}
}

func TestNitroHTTPClient(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	client := m.HTTPClient()
	if client == nil {
		t.Error("HTTPClient() should not return nil")
	}
}

func TestNitroTLSConfig(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	// Before initialization, TLS config may be nil
	tlsConfig := m.TLSConfig()
	// This is expected to be nil without proper initialization
	_ = tlsConfig
}

// =============================================================================
// Service Tests
// =============================================================================

func TestNewService(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	svc := NewService(ServiceConfig{
		ID:      "test-service",
		Name:    "Test Service",
		Version: "1.0.0",
		Nitro:  m,
		DB:      nil,
	})

	if svc.ID() != "test-service" {
		t.Errorf("ID() = %s, want test-service", svc.ID())
	}
	if svc.Name() != "Test Service" {
		t.Errorf("Name() = %s, want Test Service", svc.Name())
	}
	if svc.Version() != "1.0.0" {
		t.Errorf("Version() = %s, want 1.0.0", svc.Version())
	}
}

func TestServiceStartStop(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})
	svc := NewService(ServiceConfig{
		ID:      "test-service",
		Name:    "Test Service",
		Version: "1.0.0",
		Nitro:  m,
	})

	ctx := context.Background()

	// Initially not running
	if svc.IsRunning() {
		t.Error("Service should not be running initially")
	}

	// Start service
	if err := svc.Start(ctx); err != nil {
		t.Errorf("Start() error = %v", err)
	}

	if !svc.IsRunning() {
		t.Error("Service should be running after Start()")
	}

	// Stop service
	if err := svc.Stop(); err != nil {
		t.Errorf("Stop() error = %v", err)
	}

	if svc.IsRunning() {
		t.Error("Service should not be running after Stop()")
	}
}

func TestServiceStartTwice(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})
	svc := NewService(ServiceConfig{
		ID:     "test-service",
		Name:   "Test Service",
		Nitro: m,
	})

	ctx := context.Background()
	_ = svc.Start(ctx)

	err := svc.Start(ctx)
	if err == nil {
		t.Error("Start() should return error when already running")
	}
}

func TestServiceStopTwice(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})
	svc := NewService(ServiceConfig{
		ID:     "test-service",
		Name:   "Test Service",
		Nitro: m,
	})

	ctx := context.Background()
	_ = svc.Start(ctx)
	_ = svc.Stop()

	// Second stop should not error
	err := svc.Stop()
	if err != nil {
		t.Errorf("Stop() should not error when already stopped, got %v", err)
	}
}

func TestServiceRouter(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})
	svc := NewService(ServiceConfig{
		ID:     "test-service",
		Name:   "Test Service",
		Nitro: m,
	})

	router := svc.Router()
	if router == nil {
		t.Error("Router() should not return nil")
	}
}

func TestServiceNitro(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})
	svc := NewService(ServiceConfig{
		ID:     "test-service",
		Name:   "Test Service",
		Nitro: m,
	})

	if svc.Nitro() != m {
		t.Error("Nitro() should return the configured nitro")
	}
}

// =============================================================================
// Concurrency Tests
// =============================================================================

func TestServiceConcurrentAccess(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})
	svc := NewService(ServiceConfig{
		ID:     "test-service",
		Name:   "Test Service",
		Nitro: m,
	})

	ctx := context.Background()
	_ = svc.Start(ctx)

	done := make(chan bool)

	// Concurrent reads
	for i := 0; i < 10; i++ {
		go func() {
			_ = svc.IsRunning()
			_ = svc.ID()
			_ = svc.Name()
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}

	_ = svc.Stop()
}

func TestNitroConcurrentSecretAccess(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})
	m.secrets["test-secret"] = []byte("secret-value")

	done := make(chan bool)

	// Concurrent secret reads
	for i := 0; i < 10; i++ {
		go func() {
			_, _ = m.Secret("test-secret")
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}

// =============================================================================
// Benchmarks
// =============================================================================

func BenchmarkNewNitro(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, _ = New(Config{NitroType: "benchmark"})
	}
}

func BenchmarkNewService(b *testing.B) {
	m, _ := New(Config{NitroType: "benchmark"})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = NewService(ServiceConfig{
			ID:     "benchmark-service",
			Name:   "Benchmark Service",
			Nitro: m,
		})
	}
}

func BenchmarkServiceStartStop(b *testing.B) {
	m, _ := New(Config{NitroType: "benchmark"})
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		svc := NewService(ServiceConfig{
			ID:     "benchmark-service",
			Name:   "Benchmark Service",
			Nitro: m,
		})
		_ = svc.Start(ctx)
		_ = svc.Stop()
	}
}

// =============================================================================
// Additional Coverage Tests
// =============================================================================

func TestNitroExternalHTTPClient(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	client := m.ExternalHTTPClient()
	if client == nil {
		t.Error("ExternalHTTPClient() should not return nil")
	}

	// Call again to test caching
	client2 := m.ExternalHTTPClient()
	if client2 != client {
		t.Error("ExternalHTTPClient() should return cached client")
	}
}

func TestNitroExternalHTTPClientNil(t *testing.T) {
	var m *Nitro
	client := m.ExternalHTTPClient()
	if client == nil {
		t.Error("ExternalHTTPClient() on nil should not return nil")
	}
}

func TestNitroHTTPClientNil(t *testing.T) {
	var m *Nitro
	client := m.HTTPClient()
	if client == nil {
		t.Error("HTTPClient() on nil should not return nil")
	}
}

func TestNitroReport(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	// Outside enclave, report should be nil
	report := m.Report()
	if report != nil {
		t.Log("Report() returned non-nil (running in enclave)")
	}
}

func TestNitroSetTestSecret(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	m.SetTestSecret("test-key", []byte("test-value"))

	secret, ok := m.Secret("test-key")
	if !ok {
		t.Error("SetTestSecret() should make secret available")
	}
	if string(secret) != "test-value" {
		t.Errorf("Secret() = %s, want test-value", string(secret))
	}
}

func TestNitroSetTestReport(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	// Initially not in enclave
	if m.IsEnclave() {
		t.Skip("Already in enclave")
	}

	// This would set a report but we can't create a real one outside enclave
	m.SetTestReport(nil)
	if m.IsEnclave() {
		t.Error("IsEnclave() should be false after SetTestReport(nil)")
	}
}

func TestNitroSecretFromEnv(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	// Set environment variable
	t.Setenv("TEST_ENV_SECRET", "env-secret-value")

	secret, ok := m.Secret("TEST_ENV_SECRET")
	if !ok {
		t.Error("Secret() should find env var secret")
	}
	if string(secret) != "env-secret-value" {
		t.Errorf("Secret() = %s, want env-secret-value", string(secret))
	}
}

func TestNitroSecretFromEnvHex(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	// Set hex-encoded environment variable
	t.Setenv("TEST_HEX_SECRET", "0x48656c6c6f")

	secret, ok := m.Secret("TEST_HEX_SECRET")
	if !ok {
		t.Error("Secret() should find hex env var secret")
	}
	if string(secret) != "Hello" {
		t.Errorf("Secret() = %s, want Hello", string(secret))
	}
}

func TestNitroInitializeWithSecrets(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	t.Setenv("NITRO_SECRETS", `{"key1":"dmFsdWUx"}`)
	t.Setenv("NITRO_UUID", "test-uuid")

	ctx := context.Background()
	err := m.Initialize(ctx)
	if err != nil {
		t.Errorf("Initialize() error = %v", err)
	}
}

func TestNitroInitializeCertWithoutRootCA(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	// Set cert and key but no root CA - should fail
	t.Setenv("NITRO_CERT", "dummy-cert")
	t.Setenv("NITRO_KEY", "dummy-key")

	ctx := context.Background()
	err := m.Initialize(ctx)
	if err == nil {
		t.Error("Initialize() should fail when cert/key set without root CA")
	}
}

func TestNitroHTTPClientCaching(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})

	client1 := m.HTTPClient()
	client2 := m.HTTPClient()

	if client1 != client2 {
		t.Error("HTTPClient() should return cached client")
	}
}

func TestServiceDB(t *testing.T) {
	m, _ := New(Config{NitroType: "test"})
	svc := NewService(ServiceConfig{
		ID:     "test-service",
		Name:   "Test Service",
		Nitro: m,
		DB:     nil,
	})

	if svc.DB() != nil {
		t.Error("DB() should return nil when not configured")
	}
}

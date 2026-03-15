package service

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewProbeManagerDefaults(t *testing.T) {
	pm := NewProbeManager(0)
	if pm == nil {
		t.Fatal("NewProbeManager returned nil")
	}
	// Live by default, not ready.
	if !pm.IsLive() {
		t.Error("expected live=true by default")
	}
	if pm.IsReady() {
		t.Error("expected ready=false by default")
	}
}

func TestProbeManagerSetReady(t *testing.T) {
	pm := NewProbeManager(time.Second)
	pm.SetReady(true)
	if !pm.IsReady() {
		t.Error("expected ready=true after SetReady(true)")
	}
	pm.SetReady(false)
	if pm.IsReady() {
		t.Error("expected ready=false after SetReady(false)")
	}
}

func TestProbeManagerSetLive(t *testing.T) {
	pm := NewProbeManager(time.Second)
	pm.SetLive(false)
	if pm.IsLive() {
		t.Error("expected live=false after SetLive(false)")
	}
	pm.SetLive(true)
	if !pm.IsLive() {
		t.Error("expected live=true after SetLive(true)")
	}
}

func TestLivenessHandler(t *testing.T) {
	pm := NewProbeManager(time.Second)

	// Live by default → 200
	rec := httptest.NewRecorder()
	pm.LivenessHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK {
		t.Errorf("live probe: got %d, want 200", rec.Code)
	}

	// Mark dead → 503
	pm.SetLive(false)
	rec = httptest.NewRecorder()
	pm.LivenessHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("dead probe: got %d, want 503", rec.Code)
	}
}

func TestReadinessHandler(t *testing.T) {
	pm := NewProbeManager(time.Second)

	// Not ready → 503
	rec := httptest.NewRecorder()
	pm.ReadinessHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("not-ready probe: got %d, want 503", rec.Code)
	}

	var status ProbeStatus
	if err := json.NewDecoder(rec.Body).Decode(&status); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if status.Message == "" {
		t.Error("expected non-empty message when not ready")
	}

	// Mark ready → 200
	pm.SetReady(true)
	rec = httptest.NewRecorder()
	pm.ReadinessHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if rec.Code != http.StatusOK {
		t.Errorf("ready probe: got %d, want 200", rec.Code)
	}
}

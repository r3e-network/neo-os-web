package service

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	gsclient "github.com/r3e-network/neo-miniapp-platform/infrastructure/globalsigner/client"
)

func newAdapterTestGlobalSignerClient(t *testing.T, baseURL string) *gsclient.Client {
	t.Helper()
	t.Setenv("NITRO_ENV", "development")

	client, err := gsclient.New(gsclient.Config{BaseURL: baseURL})
	if err != nil {
		t.Fatalf("globalsigner.New() error = %v", err)
	}
	return client
}

func TestBaseSignerAdapterSignWraps4xxAsRequestRejected(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/sign" {
			t.Fatalf("path = %q, want /sign", r.URL.Path)
		}
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, "invalid payload")
	}))
	defer srv.Close()

	adapter := &BaseSignerAdapter{GSClient: newAdapterTestGlobalSignerClient(t, srv.URL)}

	_, _, err := adapter.Sign(context.Background(), "domain", []byte{0x01})
	if err == nil {
		t.Fatal("Sign() expected error")
	}
	if !strings.Contains(err.Error(), "request rejected") {
		t.Fatalf("error should include request classification, got: %v", err)
	}
}

func TestBaseSignerAdapterSignWrapsTimeoutAsServiceUnavailable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"signature":"00","key_version":"v1","pubkey_hex":"02abc"}`)
	}))
	defer srv.Close()

	client, err := gsclient.New(gsclient.Config{BaseURL: srv.URL, Timeout: 10 * time.Millisecond})
	if err != nil {
		t.Fatalf("globalsigner.New() error = %v", err)
	}
	adapter := &BaseSignerAdapter{GSClient: client}

	_, _, err = adapter.Sign(context.Background(), "domain", []byte{0x01})
	if err == nil {
		t.Fatal("Sign() expected timeout error")
	}
	if !strings.Contains(err.Error(), "service unavailable") {
		t.Fatalf("error should include service-unavailable classification, got: %v", err)
	}
	if strings.Contains(err.Error(), srv.URL) {
		t.Fatalf("error should not leak upstream url, got: %v", err)
	}
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("wrapped error should preserve timeout cause, got: %v", err)
	}
}

func TestBaseSignerAdapterGetPublicKeyWraps404AsEndpointNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/attestation" {
			t.Fatalf("path = %q, want /attestation", r.URL.Path)
		}
		w.WriteHeader(http.StatusNotFound)
		_, _ = io.WriteString(w, "attestation route missing")
	}))
	defer srv.Close()

	adapter := &BaseSignerAdapter{GSClient: newAdapterTestGlobalSignerClient(t, srv.URL)}

	_, _, err := adapter.GetPublicKey(context.Background())
	if err == nil {
		t.Fatal("GetPublicKey() expected error")
	}
	if !strings.Contains(err.Error(), "endpoint not found") {
		t.Fatalf("error should include endpoint classification, got: %v", err)
	}
}

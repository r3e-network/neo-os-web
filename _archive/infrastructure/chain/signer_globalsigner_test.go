package chain

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	gsclient "github.com/r3e-network/neo-miniapp-platform/infrastructure/globalsigner/client"
)

func newTestGlobalSignerClient(t *testing.T, baseURL string) *gsclient.Client {
	t.Helper()
	t.Setenv("NITRO_ENV", "development")

	client, err := gsclient.New(gsclient.Config{BaseURL: baseURL})
	if err != nil {
		t.Fatalf("globalsigner.New() error = %v", err)
	}
	return client
}

func TestNewGlobalSignerSignerWrapsNotFoundAsEndpointError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/attestation" {
			t.Fatalf("path = %q, want /attestation", r.URL.Path)
		}
		w.WriteHeader(http.StatusNotFound)
		_, _ = io.WriteString(w, "missing attestation endpoint")
	}))
	defer srv.Close()

	client := newTestGlobalSignerClient(t, srv.URL)

	_, err := NewGlobalSignerSigner(context.Background(), client)
	if err == nil {
		t.Fatal("NewGlobalSignerSigner() expected error")
	}
	if !strings.Contains(err.Error(), "endpoint not found") {
		t.Fatalf("error should include endpoint classification, got: %v", err)
	}
}

func TestGlobalSignerSignerSignWraps5xxAsServiceUnavailable(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/sign-raw" {
			t.Fatalf("path = %q, want /sign-raw", r.URL.Path)
		}
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(w, "signer unavailable")
	}))
	defer srv.Close()

	client := newTestGlobalSignerClient(t, srv.URL)
	signer := &GlobalSignerSigner{client: client}

	_, err := signer.Sign(context.Background(), []byte{0x01})
	if err == nil {
		t.Fatal("Sign() expected error")
	}
	if !strings.Contains(err.Error(), "service unavailable") {
		t.Fatalf("error should include availability classification, got: %v", err)
	}
}

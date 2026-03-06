package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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

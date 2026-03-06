package main

import (
	"crypto/tls"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

func TestNewMasterKeyHTTPClientUsesTLS12Transport(t *testing.T) {
	client := newMasterKeyHTTPClient()
	if client == nil {
		t.Fatal("newMasterKeyHTTPClient() returned nil")
	}
	if client.Timeout != 30*time.Second {
		t.Fatalf("Timeout = %v, want %v", client.Timeout, 30*time.Second)
	}

	tr, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("Transport type = %T, want *http.Transport", client.Transport)
	}
	if tr.TLSClientConfig == nil || tr.TLSClientConfig.MinVersion < tls.VersionTLS12 {
		t.Fatal("newMasterKeyHTTPClient() did not enforce TLS 1.2+")
	}
}

func TestFetchMasterKeyRedirectDoesNotFollow(t *testing.T) {
	var redirectedHits int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&redirectedHits, 1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"hash":"abc","pubkey":"def"}`)
	}))
	defer target.Close()

	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer redirector.Close()

	_, err := fetchMasterKey(redirector.URL)
	if err == nil {
		t.Fatal("fetchMasterKey() should return error for redirect status")
	}

	var httpErr *httputil.HTTPStatusError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *httputil.HTTPStatusError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusFound {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusFound)
	}
	if hits := atomic.LoadInt32(&redirectedHits); hits != 0 {
		t.Fatalf("redirect target should not be called, got %d hit(s)", hits)
	}
}

func TestFetchMasterKeyReturnsTypedHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/master-key" {
			t.Fatalf("path = %q, want %q", r.URL.Path, "/master-key")
		}
		w.WriteHeader(http.StatusBadGateway)
		_, _ = io.WriteString(w, "upstream unavailable")
	}))
	defer server.Close()

	_, err := fetchMasterKey(server.URL)
	if err == nil {
		t.Fatal("fetchMasterKey() expected error")
	}

	var httpErr *httputil.HTTPStatusError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *httputil.HTTPStatusError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusBadGateway)
	}
	if !httputil.IsHTTPStatusError(err, http.StatusBadGateway) {
		t.Fatal("IsHTTPStatusError() should match 502")
	}
	if httputil.IsHTTPStatusError(err, http.StatusNotFound) {
		t.Fatal("IsHTTPStatusError() should not match wrong status")
	}
}

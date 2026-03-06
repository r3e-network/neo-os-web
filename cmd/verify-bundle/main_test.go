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

func TestNewVerifyBundleHTTPClientUsesTLS12Transport(t *testing.T) {
	client := newVerifyBundleHTTPClient()
	if client == nil {
		t.Fatal("newVerifyBundleHTTPClient() returned nil")
	}
	if client.Timeout != 30*time.Second {
		t.Fatalf("Timeout = %v, want %v", client.Timeout, 30*time.Second)
	}

	tr, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("Transport type = %T, want *http.Transport", client.Transport)
	}
	if tr.TLSClientConfig == nil || tr.TLSClientConfig.MinVersion < tls.VersionTLS12 {
		t.Fatal("newVerifyBundleHTTPClient() did not enforce TLS 1.2+")
	}
}

func TestFetchRedirectDoesNotFollow(t *testing.T) {
	var redirectedHits int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&redirectedHits, 1)
		_, _ = io.WriteString(w, `{"hash":"abc","pubkey":"def"}`)
	}))
	defer target.Close()

	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer redirector.Close()

	_, err := fetch(redirector.URL)
	if err == nil {
		t.Fatal("fetch() should return error for redirect status")
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

func TestFetchReturnsTypedHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(w, "maintenance")
	}))
	defer server.Close()

	_, err := fetch(server.URL)
	if err == nil {
		t.Fatal("fetch() expected error")
	}

	var httpErr *httputil.HTTPStatusError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *httputil.HTTPStatusError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusServiceUnavailable)
	}
	if !httputil.IsHTTPStatusError(err, http.StatusServiceUnavailable) {
		t.Fatal("IsHTTPStatusError() should match 503")
	}
	if httputil.IsHTTPStatusError(err, http.StatusNotFound) {
		t.Fatal("IsHTTPStatusError() should not match wrong status")
	}
}

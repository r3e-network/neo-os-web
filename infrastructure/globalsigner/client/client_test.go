package client

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	slhttputil "github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/serviceauth"
)

func TestNewValidConfig(t *testing.T) {
	c, err := New(Config{BaseURL: "http://localhost:8080"})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if c == nil {
		t.Fatal("New() returned nil client")
	}
}

func TestNewEmptyURL(t *testing.T) {
	_, err := New(Config{BaseURL: ""})
	if err == nil {
		t.Fatal("New() expected error for empty URL")
	}
}

func TestSignSuccess(t *testing.T) {
	want := SignResponse{
		Signature:  "abcd1234",
		KeyVersion: "v1",
		PubKeyHex:  "04deadbeef",
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/sign" {
			t.Errorf("path = %q, want /sign", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(want)
	}))
	defer srv.Close()

	c, err := New(Config{BaseURL: srv.URL})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	got, err := c.Sign(context.Background(), &SignRequest{Domain: "test", Data: "ff"})
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
	if got.Signature != want.Signature || got.KeyVersion != want.KeyVersion {
		t.Errorf("Sign() = %+v, want %+v", got, want)
	}
}

func TestSignServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal failure", http.StatusInternalServerError)
	}))
	defer srv.Close()

	c, err := New(Config{BaseURL: srv.URL})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	_, err = c.Sign(context.Background(), &SignRequest{Domain: "test", Data: "ff"})
	if err == nil {
		t.Fatal("Sign() expected error for 500 response")
	}
}

func TestSignRedirectDoesNotFollow(t *testing.T) {
	var redirectedHits int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&redirectedHits, 1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(SignResponse{Signature: "abcd1234"})
	}))
	defer target.Close()

	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer redirector.Close()

	baseClient := &http.Client{}
	c, err := New(Config{BaseURL: redirector.URL, HTTPClient: baseClient})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if baseClient.CheckRedirect != nil {
		t.Fatal("New() should not mutate caller-provided HTTP client")
	}

	_, err = c.Sign(context.Background(), &SignRequest{Domain: "test", Data: "ff"})
	if err == nil {
		t.Fatal("Sign() should return error for redirect status")
	}

	var httpErr *HTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *HTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusFound {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusFound)
	}
	if hits := atomic.LoadInt32(&redirectedHits); hits != 0 {
		t.Fatalf("redirect target should not be called, got %d hit(s)", hits)
	}
}

func TestSignReturnsTypedHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = io.WriteString(w, "missing signer endpoint")
	}))
	defer srv.Close()

	c, err := New(Config{BaseURL: srv.URL})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	_, err = c.Sign(context.Background(), &SignRequest{Domain: "test", Data: "ff"})
	if err == nil {
		t.Fatal("Sign() expected error for 404 response")
	}
	if !strings.Contains(err.Error(), "404 Not Found") {
		t.Fatalf("error should include status, got: %v", err)
	}
	if !strings.Contains(err.Error(), "missing signer endpoint") {
		t.Fatalf("error should include body, got: %v", err)
	}

	var httpErr *HTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *HTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusNotFound {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusNotFound)
	}
	if httpErr.Method != http.MethodPost {
		t.Fatalf("method = %q, want %q", httpErr.Method, http.MethodPost)
	}
	if httpErr.URL != srv.URL+"/sign" {
		t.Fatalf("url = %q, want %q", httpErr.URL, srv.URL+"/sign")
	}
	if httpErr.Body != "missing signer endpoint" {
		t.Fatalf("body = %q, want %q", httpErr.Body, "missing signer endpoint")
	}
	if !IsHTTPStatusError(err, http.StatusNotFound) {
		t.Fatal("IsHTTPStatusError() should detect 404 status")
	}
	if IsHTTPStatusError(err, http.StatusBadGateway) {
		t.Fatal("IsHTTPStatusError() should not match wrong status")
	}

	var sharedErr *slhttputil.HTTPStatusError
	if !errors.As(err, &sharedErr) {
		t.Fatalf("expected shared *httputil.HTTPStatusError, got %T", err)
	}
	if !slhttputil.IsHTTPStatusError(err, http.StatusNotFound) {
		t.Fatal("shared IsHTTPStatusError() should match 404")
	}
}

func TestSignNilClient(t *testing.T) {
	var c *Client
	_, err := c.Sign(context.Background(), &SignRequest{})
	if err == nil {
		t.Fatal("Sign() expected error for nil client")
	}
}

func TestHealthSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			t.Errorf("path = %q, want /health", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c, err := New(Config{BaseURL: srv.URL})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	if err := c.Health(context.Background()); err != nil {
		t.Fatalf("Health() error = %v", err)
	}
}

func TestHealthUnhealthy(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	c, err := New(Config{BaseURL: srv.URL})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	if err := c.Health(context.Background()); err == nil {
		t.Fatal("Health() expected error for 503 response")
	}
}

func TestHealthReturnsTypedHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(w, "signer overloaded")
	}))
	defer srv.Close()

	c, err := New(Config{BaseURL: srv.URL})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	err = c.Health(context.Background())
	if err == nil {
		t.Fatal("Health() expected error for 503 response")
	}

	var httpErr *HTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *HTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusServiceUnavailable)
	}
	if httpErr.Method != http.MethodGet {
		t.Fatalf("method = %q, want %q", httpErr.Method, http.MethodGet)
	}
	if httpErr.URL != srv.URL+"/health" {
		t.Fatalf("url = %q, want %q", httpErr.URL, srv.URL+"/health")
	}
	if !strings.Contains(httpErr.Body, "signer overloaded") {
		t.Fatalf("body = %q, want to contain signer overloaded", httpErr.Body)
	}
	if !IsHTTPStatusError(err, http.StatusServiceUnavailable) {
		t.Fatal("IsHTTPStatusError() should match 503")
	}
	if IsHTTPStatusError(err, http.StatusNotFound) {
		t.Fatal("IsHTTPStatusError() should not match wrong status")
	}
}

func TestServiceIDHeaderSent(t *testing.T) {
	const wantID = "my-service"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := r.Header.Get(serviceauth.ServiceIDHeader)
		if got != wantID {
			t.Errorf("X-Service-ID = %q, want %q", got, wantID)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(SignResponse{Signature: "aa", KeyVersion: "v1", PubKeyHex: "04bb"})
	}))
	defer srv.Close()

	c, err := New(Config{BaseURL: srv.URL, ServiceID: wantID})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	_, err = c.Sign(context.Background(), &SignRequest{Domain: "d", Data: "ff"})
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
}

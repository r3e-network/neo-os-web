package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	slhttputil "github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	txproxytypes "github.com/r3e-network/neo-miniapp-platform/infrastructure/txproxy/types"
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

func TestInvokeSuccess(t *testing.T) {
	want := txproxytypes.InvokeResponse{
		RequestID: "req-1",
		TxHash:    "0xabc",
		VMState:   "HALT",
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/invoke" {
			t.Errorf("path = %q, want /invoke", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(want)
	}))
	defer srv.Close()

	c, err := New(Config{BaseURL: srv.URL})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	got, err := c.Invoke(context.Background(), &txproxytypes.InvokeRequest{
		RequestID:    "req-1",
		ContractHash: "0xdead",
		Method:       "transfer",
	})
	if err != nil {
		t.Fatalf("Invoke() error = %v", err)
	}
	if got.RequestID != want.RequestID || got.TxHash != want.TxHash {
		t.Errorf("Invoke() = %+v, want %+v", got, want)
	}
}

func TestInvokeServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal failure", http.StatusInternalServerError)
	}))
	defer srv.Close()

	c, err := New(Config{BaseURL: srv.URL})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	_, err = c.Invoke(context.Background(), &txproxytypes.InvokeRequest{
		RequestID:    "req-1",
		ContractHash: "0xdead",
		Method:       "transfer",
	})
	if err == nil {
		t.Fatal("Invoke() expected error for 500 response")
	}
}

func TestInvokeRedirectDoesNotFollow(t *testing.T) {
	var redirectedHits int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&redirectedHits, 1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(txproxytypes.InvokeResponse{RequestID: "req-1", TxHash: "0xabc"})
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

	_, err = c.Invoke(context.Background(), &txproxytypes.InvokeRequest{
		RequestID:    "req-1",
		ContractHash: "0xdead",
		Method:       "transfer",
	})
	if err == nil {
		t.Fatal("Invoke() should return error for redirect status")
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

func TestInvokeReturnsHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"code":"CONFLICT","message":"request_id already used"}`))
	}))
	defer srv.Close()

	c, err := New(Config{BaseURL: srv.URL})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	_, err = c.Invoke(context.Background(), &txproxytypes.InvokeRequest{
		RequestID:    "req-1",
		ContractHash: "0xdead",
		Method:       "transfer",
	})
	if err == nil {
		t.Fatal("Invoke() expected conflict error")
	}

	var httpErr *HTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("Invoke() error type = %T, want *HTTPError", err)
	}
	if httpErr.StatusCode != http.StatusConflict {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusConflict)
	}
	if httpErr.Method != http.MethodPost {
		t.Fatalf("method = %q, want %q", httpErr.Method, http.MethodPost)
	}
	if httpErr.URL != srv.URL+"/invoke" {
		t.Fatalf("url = %q, want %q", httpErr.URL, srv.URL+"/invoke")
	}
	if !strings.Contains(httpErr.Body, "request_id already used") {
		t.Fatalf("body = %q, expected to contain conflict message", httpErr.Body)
	}
	var sharedErr *slhttputil.HTTPStatusError
	if !errors.As(err, &sharedErr) {
		t.Fatalf("expected shared *httputil.HTTPStatusError, got %T", err)
	}
	if !slhttputil.IsHTTPStatusError(err, http.StatusConflict) {
		t.Fatal("shared IsHTTPStatusError() should match 409")
	}
}

func TestInvokeNilClient(t *testing.T) {
	var c *Client
	_, err := c.Invoke(context.Background(), &txproxytypes.InvokeRequest{})
	if err == nil {
		t.Fatal("Invoke() expected error for nil client")
	}
}

func TestIsRequestIDConflictError(t *testing.T) {
	t.Run("typed conflict", func(t *testing.T) {
		err := &HTTPError{
			HTTPStatusError: &slhttputil.HTTPStatusError{
				StatusCode: http.StatusConflict,
				Status:     "409 Conflict",
				Body:       `{"code":"CONFLICT","message":"request_id already used"}`,
			},
		}
		if !IsRequestIDConflictError(err) {
			t.Fatal("IsRequestIDConflictError() = false, want true")
		}
	})

	t.Run("legacy wrapped conflict string", func(t *testing.T) {
		err := fmt.Errorf("wrapped: %w", errors.New(`request failed: 409 Conflict - {"code":"CONFLICT","message":"request_id already used"}`))
		if !IsRequestIDConflictError(err) {
			t.Fatal("IsRequestIDConflictError() = false, want true")
		}
	})

	t.Run("legacy conflict with spaced json formatting", func(t *testing.T) {
		err := errors.New(`request failed: 409 Conflict - { "code" : "CONFLICT", "message" : "already used" }`)
		if !IsRequestIDConflictError(err) {
			t.Fatal("IsRequestIDConflictError() = false, want true")
		}
	})

	t.Run("legacy conflict code marker with loose spacing", func(t *testing.T) {
		err := errors.New(`request failed: 409 Conflict - payload "code" : "CONFLICT"`)
		if !IsRequestIDConflictError(err) {
			t.Fatal("IsRequestIDConflictError() = false, want true")
		}
	})

	t.Run("non conflict", func(t *testing.T) {
		if IsRequestIDConflictError(errors.New("request failed: 500 Internal Server Error")) {
			t.Fatal("IsRequestIDConflictError() = true, want false")
		}
	})

	t.Run("500 with conflict-like payload is not request-id conflict", func(t *testing.T) {
		err := errors.New(`request failed: 500 Internal Server Error - {"code":"CONFLICT","message":"request_id already used"}`)
		if IsRequestIDConflictError(err) {
			t.Fatal("IsRequestIDConflictError() = true, want false")
		}
	})

	t.Run("unrelated 409 conflict text is not txproxy conflict", func(t *testing.T) {
		err := errors.New("database 409 conflict: request_id already used in another subsystem")
		if IsRequestIDConflictError(err) {
			t.Fatal("IsRequestIDConflictError() = true, want false")
		}
	})
}

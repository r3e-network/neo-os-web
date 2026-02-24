package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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

func TestInvokeNilClient(t *testing.T) {
	var c *Client
	_, err := c.Invoke(context.Background(), &txproxytypes.InvokeRequest{})
	if err == nil {
		t.Fatal("Invoke() expected error for nil client")
	}
}

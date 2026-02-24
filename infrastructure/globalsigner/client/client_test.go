package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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

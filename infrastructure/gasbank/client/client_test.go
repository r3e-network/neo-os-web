package client

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

func TestNew(t *testing.T) {
	c, err := New(Config{BaseURL: "http://localhost:8080"})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if c.baseURL != "http://localhost:8080" {
		t.Errorf("baseURL = %s, want http://localhost:8080", c.baseURL)
	}
	if c.httpClient == nil {
		t.Error("httpClient should not be nil")
	}
}

func TestNewEmptyBaseURL(t *testing.T) {
	_, err := New(Config{BaseURL: ""})
	if err == nil {
		t.Error("New() expected error for empty base URL")
	}
}

func TestDeductFeeRedirectDoesNotFollow(t *testing.T) {
	var redirectedHits int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&redirectedHits, 1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(DeductFeeResponse{Success: true, TransactionID: "tx123", BalanceAfter: 900})
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

	_, err = c.DeductFee(context.Background(), &DeductFeeRequest{UserID: "user1", Amount: 100, ServiceID: "neofeeds"})
	if err == nil {
		t.Fatal("DeductFee() should return error for redirect status")
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

func TestNewCustomHTTPClient(t *testing.T) {
	customClient := &http.Client{Timeout: 30 * time.Second}
	c, err := New(Config{
		BaseURL:    "http://localhost:8080",
		HTTPClient: customClient,
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if c.httpClient == customClient {
		t.Fatal("httpClient should be copied, not reuse caller pointer")
	}
	if customClient.CheckRedirect != nil {
		t.Fatal("custom client should not be mutated")
	}
	if c.httpClient.Timeout != 30*time.Second {
		t.Fatalf("Timeout = %v, want %v", c.httpClient.Timeout, 30*time.Second)
	}
	if c.httpClient.CheckRedirect == nil {
		t.Fatal("copied client should disable redirects")
	}
}

func TestDeductFeeNilRequest(t *testing.T) {
	c, _ := New(Config{BaseURL: "http://localhost:8080"})
	_, err := c.DeductFee(context.Background(), nil)
	if err == nil {
		t.Error("DeductFee() expected error for nil request")
	}
}

func TestDeductFeeSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/deduct" {
			t.Errorf("path = %s, want /deduct", r.URL.Path)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Content-Type = %s, want application/json", r.Header.Get("Content-Type"))
		}

		var req DeductFeeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.UserID != "user1" {
			t.Errorf("UserID = %s, want user1", req.UserID)
		}
		if req.Amount != 100 {
			t.Errorf("Amount = %d, want 100", req.Amount)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(DeductFeeResponse{
			Success:       true,
			TransactionID: "tx123",
			BalanceAfter:  900,
		})
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	resp, err := c.DeductFee(context.Background(), &DeductFeeRequest{
		UserID:    "user1",
		Amount:    100,
		ServiceID: "neofeeds",
	})
	if err != nil {
		t.Fatalf("DeductFee() error = %v", err)
	}
	if !resp.Success {
		t.Error("Success should be true")
	}
	if resp.TransactionID != "tx123" {
		t.Errorf("TransactionID = %s, want tx123", resp.TransactionID)
	}
	if resp.BalanceAfter != 900 {
		t.Errorf("BalanceAfter = %d, want 900", resp.BalanceAfter)
	}
}

func TestDeductFeeHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "insufficient balance"})
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	_, err := c.DeductFee(context.Background(), &DeductFeeRequest{
		UserID:    "user1",
		Amount:    100,
		ServiceID: "neofeeds",
	})
	if err == nil {
		t.Error("DeductFee() expected error for HTTP 403")
	}
}

func TestDeductFeeReturnsTypedHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "insufficient balance"})
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	_, err := c.DeductFee(context.Background(), &DeductFeeRequest{
		UserID:    "user1",
		Amount:    100,
		ServiceID: "neofeeds",
	})
	if err == nil {
		t.Fatal("DeductFee() expected error for HTTP 403")
	}

	var httpErr *HTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *HTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusForbidden {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusForbidden)
	}
	if httpErr.Method != http.MethodPost {
		t.Fatalf("method = %q, want %q", httpErr.Method, http.MethodPost)
	}
	if httpErr.URL != server.URL+"/deduct" {
		t.Fatalf("url = %q, want %q", httpErr.URL, server.URL+"/deduct")
	}
	if !strings.Contains(httpErr.Body, "insufficient balance") {
		t.Fatalf("body = %q, want to contain insufficient balance", httpErr.Body)
	}
	if !IsHTTPStatusError(err, http.StatusForbidden) {
		t.Fatal("IsHTTPStatusError() should match 403")
	}
	if IsHTTPStatusError(err, http.StatusInternalServerError) {
		t.Fatal("IsHTTPStatusError() should not match wrong status")
	}

	var sharedErr *httputil.HTTPStatusError
	if !errors.As(err, &sharedErr) {
		t.Fatalf("expected shared *httputil.HTTPStatusError, got %T", err)
	}
	if !httputil.IsHTTPStatusError(err, http.StatusForbidden) {
		t.Fatal("shared IsHTTPStatusError() should match 403")
	}
}

func TestDeductFeeHTTPErrorNoJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal server error"))
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	_, err := c.DeductFee(context.Background(), &DeductFeeRequest{
		UserID:    "user1",
		Amount:    100,
		ServiceID: "neofeeds",
	})
	if err == nil {
		t.Error("DeductFee() expected error for HTTP 500")
	}
}

func TestDeductFeeInvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("not json"))
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	_, err := c.DeductFee(context.Background(), &DeductFeeRequest{
		UserID:    "user1",
		Amount:    100,
		ServiceID: "neofeeds",
	})
	if err == nil {
		t.Error("DeductFee() expected error for invalid JSON")
	}
}

func TestGetAccountSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", r.Method)
		}
		if r.URL.Path != "/account" {
			t.Errorf("path = %s, want /account", r.URL.Path)
		}
		if r.Header.Get("X-User-ID") != "user1" {
			t.Errorf("X-User-ID = %s, want user1", r.Header.Get("X-User-ID"))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(GetAccountResponse{
			ID:        "acc1",
			UserID:    "user1",
			Balance:   1000,
			Reserved:  100,
			Available: 900,
		})
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	resp, err := c.GetAccount(context.Background(), "user1")
	if err != nil {
		t.Fatalf("GetAccount() error = %v", err)
	}
	if resp.ID != "acc1" {
		t.Errorf("ID = %s, want acc1", resp.ID)
	}
	if resp.Balance != 1000 {
		t.Errorf("Balance = %d, want 1000", resp.Balance)
	}
	if resp.Available != 900 {
		t.Errorf("Available = %d, want 900", resp.Available)
	}
}

func TestGetAccountHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	_, err := c.GetAccount(context.Background(), "user1")
	if err == nil {
		t.Error("GetAccount() expected error for HTTP 404")
	}
}

func TestGetAccountReturnsTypedHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("account not found"))
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	_, err := c.GetAccount(context.Background(), "user1")
	if err == nil {
		t.Fatal("GetAccount() expected error for HTTP 404")
	}

	var httpErr *HTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *HTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusNotFound {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusNotFound)
	}
	if httpErr.Method != http.MethodGet {
		t.Fatalf("method = %q, want %q", httpErr.Method, http.MethodGet)
	}
	if httpErr.URL != server.URL+"/account" {
		t.Fatalf("url = %q, want %q", httpErr.URL, server.URL+"/account")
	}
	if !strings.Contains(httpErr.Body, "account not found") {
		t.Fatalf("body = %q, want to contain account not found", httpErr.Body)
	}
	if !IsHTTPStatusError(err, http.StatusNotFound) {
		t.Fatal("IsHTTPStatusError() should match 404")
	}
}

func TestGetAccountInvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("not json"))
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	_, err := c.GetAccount(context.Background(), "user1")
	if err == nil {
		t.Error("GetAccount() expected error for invalid JSON")
	}
}

func TestCheckBalanceSufficient(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(GetAccountResponse{
			ID:        "acc1",
			UserID:    "user1",
			Balance:   1000,
			Reserved:  100,
			Available: 900,
		})
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	sufficient, available, err := c.CheckBalance(context.Background(), "user1", 500)
	if err != nil {
		t.Fatalf("CheckBalance() error = %v", err)
	}
	if !sufficient {
		t.Error("sufficient should be true")
	}
	if available != 900 {
		t.Errorf("available = %d, want 900", available)
	}
}

func TestCheckBalanceInsufficient(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(GetAccountResponse{
			ID:        "acc1",
			UserID:    "user1",
			Balance:   1000,
			Reserved:  100,
			Available: 900,
		})
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	sufficient, available, err := c.CheckBalance(context.Background(), "user1", 1000)
	if err != nil {
		t.Fatalf("CheckBalance() error = %v", err)
	}
	if sufficient {
		t.Error("sufficient should be false")
	}
	if available != 900 {
		t.Errorf("available = %d, want 900", available)
	}
}

func TestCheckBalanceError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	c, _ := New(Config{BaseURL: server.URL})
	_, _, err := c.CheckBalance(context.Background(), "user1", 500)
	if err == nil {
		t.Error("CheckBalance() expected error")
	}
}

func TestDeductFeeConnectionError(t *testing.T) {
	c, _ := New(Config{BaseURL: "http://localhost:99999"})
	_, err := c.DeductFee(context.Background(), &DeductFeeRequest{
		UserID:    "user1",
		Amount:    100,
		ServiceID: "neofeeds",
	})
	if err == nil {
		t.Error("DeductFee() expected error for connection failure")
	}
}

func TestGetAccountConnectionError(t *testing.T) {
	c, _ := New(Config{BaseURL: "http://localhost:99999"})
	_, err := c.GetAccount(context.Background(), "user1")
	if err == nil {
		t.Error("GetAccount() expected error for connection failure")
	}
}

func TestDefaultTimeout(t *testing.T) {
	if defaultTimeout != 10*time.Second {
		t.Errorf("defaultTimeout = %v, want 10s", defaultTimeout)
	}
}

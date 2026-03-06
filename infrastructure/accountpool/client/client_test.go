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

	slhttputil "github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/serviceauth"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/testutil"
)

func newTestClient(t *testing.T, baseURL string) *Client {
	t.Helper()
	t.Setenv("NITRO_ENV", "development")
	client, err := New(Config{
		BaseURL:   baseURL,
		ServiceID: "neocompute",
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	return client
}

func TestNew(t *testing.T) {
	t.Setenv("NITRO_ENV", "development")
	client, err := New(Config{
		BaseURL:   "http://localhost:8090/",
		ServiceID: "neocompute",
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if client.baseURL != "http://localhost:8090" {
		t.Errorf("baseURL = %s, want http://localhost:8090", client.baseURL)
	}
	if client.serviceID != "neocompute" {
		t.Errorf("serviceID = %s, want neocompute", client.serviceID)
	}
}

func TestNew_StrictModeRequiresHTTPS(t *testing.T) {
	t.Setenv("NITRO_ENV", "production")
	_, err := New(Config{
		BaseURL:   "http://localhost:8090",
		ServiceID: "neocompute",
	})
	if err == nil {
		t.Fatal("New() error = nil, want error in strict identity mode")
	}
}

func TestGetPoolInfo(t *testing.T) {
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/pool-info" {
			t.Errorf("Path = %s, want /pool-info", r.URL.Path)
		}
		if got := r.Header.Get(serviceauth.ServiceIDHeader); got != "neocompute" {
			t.Errorf("%s = %s, want neocompute", serviceauth.ServiceIDHeader, got)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(PoolInfoResponse{
			TotalAccounts:    10,
			ActiveAccounts:   8,
			LockedAccounts:   2,
			RetiringAccounts: 0,
			TokenStats: map[string]TokenStats{
				"GAS": {TokenType: "GAS", TotalBalance: 1000000},
			},
		})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	info, err := client.GetPoolInfo(context.Background())
	if err != nil {
		t.Fatalf("GetPoolInfo() error = %v", err)
	}
	if info.TotalAccounts != 10 {
		t.Errorf("TotalAccounts = %d, want 10", info.TotalAccounts)
	}
	if gasStats, ok := info.TokenStats["GAS"]; !ok || gasStats.TotalBalance != 1000000 {
		t.Errorf("TokenStats[GAS].TotalBalance = %v, want 1000000", info.TokenStats)
	}
}

func TestRequestAccounts(t *testing.T) {
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/request" {
			t.Errorf("Path = %s, want /request", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("Method = %s, want POST", r.Method)
		}

		var input RequestAccountsInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if input.ServiceID != "neocompute" {
			t.Errorf("ServiceID = %s, want neocompute", input.ServiceID)
		}
		if input.Count != 2 {
			t.Errorf("Count = %d, want 2", input.Count)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(RequestAccountsResponse{
			Accounts: []AccountInfo{
				{ID: "acc-1", Address: "NAddr1", Balances: map[string]TokenBalance{"GAS": {Amount: 1000}}},
				{ID: "acc-2", Address: "NAddr2", Balances: map[string]TokenBalance{"GAS": {Amount: 2000}}},
			},
			LockID: "lock-123",
		})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	resp, err := client.RequestAccounts(context.Background(), 2, "test")
	if err != nil {
		t.Fatalf("RequestAccounts() error = %v", err)
	}
	if len(resp.Accounts) != 2 {
		t.Errorf("len(Accounts) = %d, want 2", len(resp.Accounts))
	}
	if resp.LockID != "lock-123" {
		t.Errorf("LockID = %s, want lock-123", resp.LockID)
	}
}

func TestReleaseAccounts(t *testing.T) {
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/release" {
			t.Errorf("Path = %s, want /release", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("Method = %s, want POST", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(ReleaseAccountsResponse{ReleasedCount: 2})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	resp, err := client.ReleaseAccounts(context.Background(), []string{"acc-1", "acc-2"})
	if err != nil {
		t.Fatalf("ReleaseAccounts() error = %v", err)
	}
	if resp.ReleasedCount != 2 {
		t.Errorf("ReleasedCount = %d, want 2", resp.ReleasedCount)
	}
}

func TestUpdateBalance(t *testing.T) {
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/balance" {
			t.Errorf("Path = %s, want /balance", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("Method = %s, want POST", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(UpdateBalanceResponse{
			AccountID:  "acc-1",
			Token:      "GAS",
			OldBalance: 0,
			NewBalance: 1000,
			TxCount:    1,
		})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	_, err := client.UpdateBalance(context.Background(), "acc-1", "GAS", 1000, nil)
	if err != nil {
		t.Fatalf("UpdateBalance() error = %v", err)
	}
}

func TestUpdateBalanceWithAbsolute(t *testing.T) {
	absolute := int64(5000)
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body UpdateBalanceInput
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if body.Absolute == nil || *body.Absolute != absolute {
			t.Fatalf("Absolute = %v, want %d", body.Absolute, absolute)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(UpdateBalanceResponse{
			AccountID:  "acc-1",
			Token:      "GAS",
			OldBalance: 0,
			NewBalance: absolute,
			TxCount:    1,
		})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	_, err := client.UpdateBalance(context.Background(), "acc-1", "GAS", 0, &absolute)
	if err != nil {
		t.Fatalf("UpdateBalance() error = %v", err)
	}
}

func TestGetLockedAccounts(t *testing.T) {
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/accounts" {
			t.Errorf("Path = %s, want /accounts", r.URL.Path)
		}
		if r.URL.Query().Get("service_id") != "neocompute" {
			t.Errorf("service_id = %s, want neocompute", r.URL.Query().Get("service_id"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(ListAccountsResponse{
			Accounts: []AccountInfo{
				{ID: "acc-1", Address: "NAddr1", Balances: map[string]TokenBalance{"GAS": {Amount: 1000}}},
				{ID: "acc-2", Address: "NAddr2", Balances: map[string]TokenBalance{"GAS": {Amount: 2000}}},
			},
		})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	accounts, err := client.GetLockedAccounts(context.Background(), "", nil)
	if err != nil {
		t.Fatalf("GetLockedAccounts() error = %v", err)
	}
	if len(accounts) != 2 {
		t.Errorf("len(accounts) = %d, want 2", len(accounts))
	}
}

func TestGetLockedAccountsWithMinBalance(t *testing.T) {
	minBalance := int64(1000)
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("min_balance") != "1000" {
			t.Errorf("min_balance = %s, want 1000", r.URL.Query().Get("min_balance"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(ListAccountsResponse{
			Accounts: []AccountInfo{
				{ID: "acc-1", Address: "NAddr1", Balances: map[string]TokenBalance{"GAS": {Amount: 2000}}},
			},
		})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	accounts, err := client.GetLockedAccounts(context.Background(), "", &minBalance)
	if err != nil {
		t.Fatalf("GetLockedAccounts() error = %v", err)
	}
	if len(accounts) != 1 {
		t.Errorf("len(accounts) = %d, want 1", len(accounts))
	}
}

func TestSignTransaction(t *testing.T) {
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/sign" {
			t.Errorf("Path = %s, want /sign", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("Method = %s, want POST", r.Method)
		}

		var input SignTransactionInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if input.ServiceID != "neocompute" {
			t.Errorf("ServiceID = %s, want neocompute", input.ServiceID)
		}
		if input.AccountID != "acc-1" {
			t.Errorf("AccountID = %s, want acc-1", input.AccountID)
		}
		if string(input.TxHash) != "txhash" {
			t.Errorf("TxHash = %q, want %q", string(input.TxHash), "txhash")
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(SignTransactionResponse{
			AccountID: "acc-1",
			Signature: []byte("signature"),
			PublicKey: []byte("pubkey"),
		})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	result, err := client.SignTransaction(context.Background(), "acc-1", []byte("txhash"))
	if err != nil {
		t.Fatalf("SignTransaction() error = %v", err)
	}
	if result.AccountID != "acc-1" {
		t.Errorf("AccountID = %s, want acc-1", result.AccountID)
	}
	if string(result.Signature) != "signature" {
		t.Errorf("Signature = %q, want %q", string(result.Signature), "signature")
	}
}

func TestTransfer(t *testing.T) {
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/transfer" {
			t.Errorf("Path = %s, want /transfer", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("Method = %s, want POST", r.Method)
		}

		var body TransferInput
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if body.ServiceID != "neocompute" {
			t.Errorf("ServiceID = %s, want neocompute", body.ServiceID)
		}
		if body.Amount != 1000 {
			t.Errorf("Amount = %d, want 1000", body.Amount)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(TransferResponse{
			TxHash:    "0x123abc",
			AccountID: "acc-1",
			ToAddress: "NTargetAddr",
			Amount:    1000,
		})
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	result, err := client.Transfer(context.Background(), "acc-1", "NTargetAddr", 1000, "")
	if err != nil {
		t.Fatalf("Transfer() error = %v", err)
	}
	if result.TxHash != "0x123abc" {
		t.Errorf("TxHash = %s, want 0x123abc", result.TxHash)
	}
	if result.Amount != 1000 {
		t.Errorf("Amount = %d, want 1000", result.Amount)
	}
}

func TestErrorHandling(t *testing.T) {
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal error"))
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)

	_, err := client.GetPoolInfo(context.Background())
	if err == nil {
		t.Error("GetPoolInfo() should return error on 500")
	}

	_, err = client.RequestAccounts(context.Background(), 1, "test")
	if err == nil {
		t.Error("RequestAccounts() should return error on 500")
	}

	_, err = client.ReleaseAccounts(context.Background(), []string{"acc-1"})
	if err == nil {
		t.Error("ReleaseAccounts() should return error on 500")
	}
}

func TestErrorIncludesStatusAndBody(t *testing.T) {
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("upstream unavailable"))
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)

	_, err := client.GetPoolInfo(context.Background())
	if err == nil {
		t.Fatal("GetPoolInfo() should return error on 502")
	}
	if !strings.Contains(err.Error(), "502 Bad Gateway") {
		t.Fatalf("error should include status, got: %v", err)
	}
	if !strings.Contains(err.Error(), "upstream unavailable") {
		t.Fatalf("error should include response body, got: %v", err)
	}
}

func TestErrorReturnsTypedHTTPError(t *testing.T) {
	server := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("upstream unavailable"))
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	_, err := client.GetPoolInfo(context.Background())
	if err == nil {
		t.Fatal("GetPoolInfo() should return error on 502")
	}

	var httpErr *HTTPError
	if !errors.As(err, &httpErr) {
		t.Fatalf("expected *HTTPError, got %T", err)
	}
	if httpErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("status code = %d, want %d", httpErr.StatusCode, http.StatusBadGateway)
	}
	if httpErr.Method != http.MethodGet {
		t.Fatalf("method = %q, want %q", httpErr.Method, http.MethodGet)
	}
	if httpErr.URL != server.URL+"/pool-info" {
		t.Fatalf("url = %q, want %q", httpErr.URL, server.URL+"/pool-info")
	}
	if !strings.Contains(httpErr.Body, "upstream unavailable") {
		t.Fatalf("body = %q, want to contain %q", httpErr.Body, "upstream unavailable")
	}
	if !IsHTTPStatusError(err, http.StatusBadGateway) {
		t.Fatal("IsHTTPStatusError() should match 502 error")
	}
	if IsHTTPStatusError(err, http.StatusInternalServerError) {
		t.Fatal("IsHTTPStatusError() should not match wrong status")
	}

	var sharedErr *slhttputil.HTTPStatusError
	if !errors.As(err, &sharedErr) {
		t.Fatalf("expected shared *httputil.HTTPStatusError, got %T", err)
	}
	if !slhttputil.IsHTTPStatusError(err, http.StatusBadGateway) {
		t.Fatal("shared IsHTTPStatusError() should match 502")
	}
}

func BenchmarkRequestAccounts(b *testing.B) {
	b.Setenv("NITRO_ENV", "development")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(RequestAccountsResponse{
			Accounts: []AccountInfo{{ID: "acc-1", Address: "NAddr1"}},
			LockID:   "lock-123",
		})
	}))
	defer server.Close()

	client, err := New(Config{
		BaseURL:   server.URL,
		ServiceID: "neocompute",
	})
	if err != nil {
		b.Fatalf("New() error = %v", err)
	}
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = client.RequestAccounts(ctx, 1, "bench")
	}
}

func TestRequestAccountsRedirectDoesNotFollow(t *testing.T) {
	t.Setenv("NITRO_ENV", "development")
	var redirectedHits int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&redirectedHits, 1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(RequestAccountsResponse{
			Accounts: []AccountInfo{{ID: "acc-1", Address: "NAddr1"}},
			LockID:   "lock-target",
		})
	}))
	defer target.Close()

	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer redirector.Close()

	baseClient := &http.Client{}
	client, err := New(Config{
		BaseURL:      redirector.URL,
		ServiceID:    "neocompute",
		HTTPClient:   baseClient,
		MaxBodyBytes: 1 << 20,
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if baseClient.CheckRedirect != nil {
		t.Fatal("New() should not mutate caller-provided HTTP client")
	}

	_, err = client.RequestAccounts(context.Background(), 1, "test")
	if err == nil {
		t.Fatal("RequestAccounts() should return error for redirect status")
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

func TestTimeoutOverrideDoesNotMutateHTTPClient(t *testing.T) {
	t.Setenv("NITRO_ENV", "development")
	shared := &http.Client{Timeout: 0}
	client, err := New(Config{
		BaseURL:      "http://localhost:8090",
		ServiceID:    "neocompute",
		Timeout:      10 * time.Second,
		HTTPClient:   shared,
		MaxBodyBytes: 1,
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	if shared.Timeout != 0 {
		t.Fatalf("shared.Timeout = %v, want 0 (caller client must not be mutated)", shared.Timeout)
	}
	if client.httpClient == shared {
		t.Fatal("client.httpClient unexpectedly shares pointer with caller")
	}
	if client.httpClient.Timeout != 10*time.Second {
		t.Fatalf("client.httpClient.Timeout = %v, want %v", client.httpClient.Timeout, 10*time.Second)
	}
}

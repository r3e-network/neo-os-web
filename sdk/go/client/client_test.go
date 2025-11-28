package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func mockServer(t *testing.T, handlers map[string]http.HandlerFunc) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Method + " " + r.URL.Path
		if h, ok := handlers[key]; ok {
			h(w, r)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
}

func TestNewClientInitialisesServices(t *testing.T) {
	client := New(Config{BaseURL: "http://localhost:8080"})

	if client.config.Timeout != 30*time.Second {
		t.Fatalf("expected default timeout of 30s, got %v", client.config.Timeout)
	}

	services := map[string]interface{}{
		"Accounts":         client.Accounts,
		"WorkspaceWallets": client.WorkspaceWallets,
		"Functions":        client.Functions,
		"Triggers":         client.Triggers,
		"Secrets":          client.Secrets,
		"GasBank":          client.GasBank,
		"Automation":       client.Automation,
		"PriceFeeds":       client.PriceFeeds,
		"DataFeeds":        client.DataFeeds,
		"DataStreams":      client.DataStreams,
		"Oracle":           client.Oracle,
		"VRF":              client.VRF,
		"Random":           client.Random,
		"CCIP":             client.CCIP,
		"DataLink":         client.DataLink,
		"DTA":              client.DTA,
		"Confidential":     client.Confidential,
		"CRE":              client.CRE,
		"Bus":              client.Bus,
		"System":           client.System,
	}

	for name, svc := range services {
		if svc == nil {
			t.Fatalf("expected %s service to be initialised", name)
		}
	}
}

func TestAuthHeadersArePropagated(t *testing.T) {
	var gotAuth, gotTenant string
	srv := mockServer(t, map[string]http.HandlerFunc{
		"GET /healthz": func(w http.ResponseWriter, r *http.Request) {
			gotAuth = r.Header.Get("Authorization")
			gotTenant = r.Header.Get("X-Tenant-ID")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		},
	})
	defer srv.Close()

	client := New(Config{BaseURL: srv.URL, Token: "token", TenantID: "tenant"})
	_, err := client.System.Health(context.Background())
	if err != nil {
		t.Fatalf("health request failed: %v", err)
	}
	if gotAuth != "Bearer token" {
		t.Fatalf("expected auth header, got %q", gotAuth)
	}
	if gotTenant != "tenant" {
		t.Fatalf("expected tenant header, got %q", gotTenant)
	}
}

func TestAccountsAndFunctionsRoundTrip(t *testing.T) {
	srv := mockServer(t, map[string]http.HandlerFunc{
		"POST /accounts": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"ID": "acc-1", "Owner": "alice"})
		},
		"GET /accounts": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode([]map[string]any{{"ID": "acc-1", "Owner": "alice"}})
		},
		"GET /accounts/acc-1": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"ID": "acc-1", "Owner": "alice"})
		},
		"DELETE /accounts/acc-1": func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		},
		"POST /accounts/acc-1/functions": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"ID": "fn-1", "AccountID": "acc-1", "Name": "hello"})
		},
		"POST /accounts/acc-1/functions/fn-1/execute": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"ID": "exec-1", "FunctionID": "fn-1", "AccountID": "acc-1", "Status": "ok"})
		},
		"GET /accounts/acc-1/functions/fn-1/executions": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode([]map[string]any{{"ID": "exec-1", "FunctionID": "fn-1"}})
		},
		"GET /accounts/acc-1/functions/executions/exec-1": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"ID": "exec-1", "FunctionID": "fn-1"})
		},
	})
	defer srv.Close()

	client := New(Config{BaseURL: srv.URL})
	ctx := context.Background()

	acc, err := client.Accounts.Create(ctx, "alice", nil)
	if err != nil || acc.ID != "acc-1" {
		t.Fatalf("create account: %v id=%s", err, acc.ID)
	}
	if _, err := client.Accounts.List(ctx); err != nil {
		t.Fatalf("list accounts: %v", err)
	}
	if _, err := client.Accounts.Get(ctx, "acc-1"); err != nil {
		t.Fatalf("get account: %v", err)
	}

	fn, err := client.Functions.Create(ctx, "acc-1", CreateFunctionParams{Name: "hello", Source: "()=>({})"})
	if err != nil || fn.ID != "fn-1" {
		t.Fatalf("create function: %v id=%s", err, fn.ID)
	}
	if _, err := client.Functions.Execute(ctx, "acc-1", "fn-1", map[string]any{"msg": "hi"}); err != nil {
		t.Fatalf("execute: %v", err)
	}
	if _, err := client.Functions.ListExecutions(ctx, "acc-1", "fn-1", PaginationParams{Limit: 5}); err != nil {
		t.Fatalf("list executions: %v", err)
	}
	if _, err := client.Functions.GetExecution(ctx, "acc-1", "exec-1"); err != nil {
		t.Fatalf("get execution: %v", err)
	}
	if err := client.Accounts.Delete(ctx, "acc-1"); err != nil {
		t.Fatalf("delete account: %v", err)
	}
}

func TestGasBankEndpoints(t *testing.T) {
	srv := mockServer(t, map[string]http.HandlerFunc{
		"POST /accounts/acc-1/gasbank": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"ID": "gas-1", "AccountID": "acc-1", "WalletAddress": "NX..."})
		},
		"GET /accounts/acc-1/gasbank": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode([]map[string]any{{"ID": "gas-1"}})
		},
		"GET /accounts/acc-1/gasbank/summary": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"total_balance": 10})
		},
		"POST /accounts/acc-1/gasbank/deposit": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{
				"account":     map[string]any{"ID": "gas-1"},
				"transaction": map[string]any{"ID": "tx-1", "Type": "deposit"},
			})
		},
		"POST /accounts/acc-1/gasbank/withdraw": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{
				"account":     map[string]any{"ID": "gas-1"},
				"transaction": map[string]any{"ID": "tx-2", "Type": "withdrawal"},
			})
		},
		"GET /accounts/acc-1/gasbank/transactions": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode([]map[string]any{{"ID": "tx-1"}, {"ID": "tx-2"}})
		},
	})
	defer srv.Close()

	client := New(Config{BaseURL: srv.URL})
	ctx := context.Background()

	if _, err := client.GasBank.EnsureAccount(ctx, "acc-1", EnsureGasAccountOptions{WalletAddress: "NX.."}); err != nil {
		t.Fatalf("ensure account: %v", err)
	}
	if _, err := client.GasBank.ListAccounts(ctx, "acc-1"); err != nil {
		t.Fatalf("list accounts: %v", err)
	}
	if _, err := client.GasBank.Summary(ctx, "acc-1"); err != nil {
		t.Fatalf("summary: %v", err)
	}
	if _, _, err := client.GasBank.Deposit(ctx, "acc-1", GasDepositRequest{GasAccountID: "gas-1", Amount: 1, TxID: "hash"}); err != nil {
		t.Fatalf("deposit: %v", err)
	}
	if _, _, err := client.GasBank.Withdraw(ctx, "acc-1", GasWithdrawRequest{GasAccountID: "gas-1", Amount: 1, ToAddress: "NX.."}); err != nil {
		t.Fatalf("withdraw: %v", err)
	}
	if _, err := client.GasBank.ListTransactions(ctx, "acc-1", GasTransactionFilter{GasAccountID: "gas-1"}); err != nil {
		t.Fatalf("transactions: %v", err)
	}
}

func TestOracleLifecycle(t *testing.T) {
	srv := mockServer(t, map[string]http.HandlerFunc{
		"POST /accounts/acc-1/oracle/sources": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"ID": "src-1"})
		},
		"GET /accounts/acc-1/oracle/sources": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode([]map[string]any{{"ID": "src-1"}})
		},
		"POST /accounts/acc-1/oracle/requests": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"ID": "req-1", "Status": "pending"})
		},
		"GET /accounts/acc-1/oracle/requests": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode([]map[string]any{{"ID": "req-1"}})
		},
		"PATCH /accounts/acc-1/oracle/requests/req-1": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"ID": "req-1", "Status": "running"})
		},
	})
	defer srv.Close()

	client := New(Config{BaseURL: srv.URL})
	ctx := context.Background()

	if _, err := client.Oracle.CreateSource(ctx, "acc-1", CreateSourceParams{Name: "prices", URL: "https://example.com", Method: "GET"}); err != nil {
		t.Fatalf("create source: %v", err)
	}
	if _, err := client.Oracle.ListSources(ctx, "acc-1"); err != nil {
		t.Fatalf("list sources: %v", err)
	}
	req, err := client.Oracle.CreateRequest(ctx, "acc-1", CreateOracleRequestParams{DataSourceID: "src-1", Payload: "{}"})
	if err != nil || req.ID == "" {
		t.Fatalf("create request: %v", err)
	}
	if _, err := client.Oracle.ListRequests(ctx, "acc-1", "", PaginationParams{Limit: 1}); err != nil {
		t.Fatalf("list requests: %v", err)
	}
	if _, err := client.Oracle.UpdateRequest(ctx, "acc-1", "req-1", UpdateOracleRequestParams{Status: "running"}); err != nil {
		t.Fatalf("update request: %v", err)
	}
}

func TestDataLinkChannels(t *testing.T) {
	srv := mockServer(t, map[string]http.HandlerFunc{
		"POST /accounts/acc-1/datalink/channels": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"ID": "ch-1"})
		},
		"GET /accounts/acc-1/datalink/channels": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode([]map[string]any{{"ID": "ch-1"}})
		},
		"POST /accounts/acc-1/datalink/channels/ch-1/deliveries": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{"ID": "del-1"})
		},
		"GET /accounts/acc-1/datalink/deliveries": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode([]map[string]any{{"ID": "del-1"}})
		},
	})
	defer srv.Close()

	client := New(Config{BaseURL: srv.URL})
	ctx := context.Background()

	if _, err := client.DataLink.CreateChannel(ctx, "acc-1", CreateChannelParams{Name: "provider", Endpoint: "https://api", SignerSet: []string{"NX.."}}); err != nil {
		t.Fatalf("create channel: %v", err)
	}
	if _, err := client.DataLink.ListChannels(ctx, "acc-1"); err != nil {
		t.Fatalf("list channels: %v", err)
	}
	if _, err := client.DataLink.CreateDelivery(ctx, "acc-1", "ch-1", CreateDeliveryParams{Payload: map[string]any{"msg": "hi"}}); err != nil {
		t.Fatalf("create delivery: %v", err)
	}
	if _, err := client.DataLink.ListDeliveries(ctx, "acc-1", PaginationParams{Limit: 5}); err != nil {
		t.Fatalf("list deliveries: %v", err)
	}
}

func TestBusEndpoints(t *testing.T) {
	srv := mockServer(t, map[string]http.HandlerFunc{
		"POST /system/events": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		},
		"POST /system/data": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		},
		"POST /system/compute": func(w http.ResponseWriter, r *http.Request) {
			json.NewEncoder(w).Encode(map[string]any{
				"results": []map[string]any{
					{"module": "compute", "result": map[string]any{"ok": true}},
				},
			})
		},
	})
	defer srv.Close()

	client := New(Config{BaseURL: srv.URL})
	ctx := context.Background()

	if err := client.Bus.PublishEvent(ctx, "test.event", map[string]any{"msg": "hi"}); err != nil {
		t.Fatalf("publish event: %v", err)
	}
	if err := client.Bus.PushData(ctx, "test.topic", map[string]any{"msg": "hi"}); err != nil {
		t.Fatalf("push data: %v", err)
	}
	results, err := client.Bus.Compute(ctx, map[string]any{"action": "ping"})
	if err != nil {
		t.Fatalf("compute: %v", err)
	}
	if len(results) != 1 || results[0].Module != "compute" {
		t.Fatalf("unexpected compute results: %+v", results)
	}
}

package txproxy

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/R3E-Network/service_layer/infrastructure/marble"
)

func TestInvokeEnforcesAllowlistAndReplay(t *testing.T) {
	m, err := marble.New(marble.Config{MarbleType: ServiceID})
	if err != nil {
		t.Fatalf("marble.New: %v", err)
	}

	allowlist, err := ParseAllowlist(`{"contracts":{"abcd":["foo"]}}`)
	if err != nil {
		t.Fatalf("ParseAllowlist: %v", err)
	}

	svc, err := New(Config{
		Marble:    m,
		Allowlist: allowlist,
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := svc.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(func() { _ = svc.Stop() })

	server := httptest.NewServer(svc.Router())
	defer server.Close()

	call := func(req InvokeRequest) *http.Response {
		body, _ := json.Marshal(req)
		httpReq, _ := http.NewRequest(http.MethodPost, server.URL+"/invoke", bytes.NewReader(body))
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("X-Service-ID", "gateway") // satisfy RequireServiceAuth in non-strict mode
		resp, _ := http.DefaultClient.Do(httpReq)
		return resp
	}

	// Not allowed contract.
	resp := call(InvokeRequest{RequestID: "1", ContractHash: "beef", Method: "foo"})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Allowed contract+method but chain is not configured -> 503.
	resp = call(InvokeRequest{RequestID: "2", ContractHash: "abcd", Method: "foo"})
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Replay request_id -> 409.
	resp = call(InvokeRequest{RequestID: "2", ContractHash: "abcd", Method: "foo"})
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}


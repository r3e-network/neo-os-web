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

	allowlist, err := ParseAllowlist(`{"contracts":{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":["foo"]}}`)
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

	call := func(req InvokeRequest) *httptest.ResponseRecorder {
		body, _ := json.Marshal(req)
		httpReq := httptest.NewRequest(http.MethodPost, "/invoke", bytes.NewReader(body))
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("X-Service-ID", "gateway") // satisfy RequireServiceAuth in non-strict mode

		w := httptest.NewRecorder()
		svc.Router().ServeHTTP(w, httpReq)
		return w
	}

	// Not allowed contract - request_id should NOT be consumed for invalid requests.
	resp := call(InvokeRequest{RequestID: "1", ContractAddress: "beef", Method: "foo"})
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}

	// Same request_id with invalid contract should still be rejected (not consumed).
	resp = call(InvokeRequest{RequestID: "1", ContractAddress: "beef", Method: "foo"})
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 (request_id not consumed for invalid request), got %d", resp.Code)
	}

	// Allowed contract+method but chain is not configured -> 503.
	// Note: With the new validation-first approach, markSeen happens AFTER chain check,
	// so 503 means request_id is NOT consumed.
	resp = call(InvokeRequest{RequestID: "2", ContractAddress: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", Method: "foo"})
	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", resp.Code)
	}

	// Same request_id should still get 503 (not 409) because markSeen is after chain check.
	resp = call(InvokeRequest{RequestID: "2", ContractAddress: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", Method: "foo"})
	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 (request_id not consumed when chain unavailable), got %d", resp.Code)
	}
}

package txproxy

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/nitro"
)

func TestInvokeEnforcesAllowlistAndReplay(t *testing.T) {
	t.Setenv("TEE_BACKEND", "simulation")
	m, err := nitro.New(nitro.Config{NitroType: ServiceID})
	if err != nil {
		t.Fatalf("nitro.New: %v", err)
	}

	allowlist, err := ParseAllowlist(`{"contracts":{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":["foo"]}}`)
	if err != nil {
		t.Fatalf("ParseAllowlist: %v", err)
	}

	svc, err := New(Config{
		Nitro:     m,
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
	resp := call(InvokeRequest{RequestID: "1", ContractHash: "beef", Method: "foo"})
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}

	// Same request_id with invalid contract should still be rejected (not consumed).
	resp = call(InvokeRequest{RequestID: "1", ContractHash: "beef", Method: "foo"})
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 (request_id not consumed for invalid request), got %d", resp.Code)
	}

	// Allowed contract+method but chain is not configured -> 503.
	// Note: With the new validation-first approach, markSeen happens AFTER chain check,
	// so 503 means request_id is NOT consumed.
	resp = call(InvokeRequest{RequestID: "2", ContractHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", Method: "foo"})
	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", resp.Code)
	}

	// Same request_id should still get 503 (not 409) because markSeen is after chain check.
	resp = call(InvokeRequest{RequestID: "2", ContractHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", Method: "foo"})
	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 (request_id not consumed when chain unavailable), got %d", resp.Code)
	}
}

// newTestService creates a txproxy Service in simulation mode with the given allowlist JSON.
// chainClient and signer are left nil (non-strict mode).
//
//nolint:unparam // allowlistJSON is kept for readability at call sites in tests.
func newTestService(t *testing.T, allowlistJSON string) *Service {
	t.Helper()
	t.Setenv("TEE_BACKEND", "simulation")

	m, err := nitro.New(nitro.Config{NitroType: ServiceID})
	if err != nil {
		t.Fatalf("nitro.New: %v", err)
	}

	allowlist, err := ParseAllowlist(allowlistJSON)
	if err != nil {
		t.Fatalf("ParseAllowlist: %v", err)
	}

	svc, err := New(Config{
		Nitro:     m,
		Allowlist: allowlist,
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := svc.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(func() { _ = svc.Stop() })
	return svc
}

func TestHandleInvokeInvalidJSON(t *testing.T) {
	svc := newTestService(t, `{"contracts":{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":["foo"]}}`)

	req := httptest.NewRequest(http.MethodPost, "/invoke", strings.NewReader("{invalid"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	svc.handleInvoke(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandleInvokeMissingRequestID(t *testing.T) {
	svc := newTestService(t, `{"contracts":{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":["foo"]}}`)

	body, _ := json.Marshal(InvokeRequest{ContractHash: "aaaa", Method: "foo"})
	req := httptest.NewRequest(http.MethodPost, "/invoke", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	svc.handleInvoke(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "request_id") {
		t.Fatalf("expected error about request_id, got: %s", w.Body.String())
	}
}

func TestHandleInvokeMissingContractHash(t *testing.T) {
	svc := newTestService(t, `{"contracts":{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":["foo"]}}`)

	body, _ := json.Marshal(InvokeRequest{RequestID: "r1", Method: "foo"})
	req := httptest.NewRequest(http.MethodPost, "/invoke", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	svc.handleInvoke(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "contract_hash") {
		t.Fatalf("expected error about contract_hash, got: %s", w.Body.String())
	}
}

func TestHandleInvokeNotAllowed(t *testing.T) {
	// Allowlist only permits contract "aaaa" with method "foo".
	svc := newTestService(t, `{"contracts":{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":["foo"]}}`)

	body, _ := json.Marshal(InvokeRequest{RequestID: "r1", ContractHash: "bbbb", Method: "bar"})
	req := httptest.NewRequest(http.MethodPost, "/invoke", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	svc.handleInvoke(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandleInvokeNoChainClient(t *testing.T) {
	// Contract is allowed, but chainClient is nil → 503.
	svc := newTestService(t, `{"contracts":{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":["foo"]}}`)

	body, _ := json.Marshal(InvokeRequest{
		RequestID:    "r1",
		ContractHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		Method:       "foo",
	})
	req := httptest.NewRequest(http.MethodPost, "/invoke", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	svc.handleInvoke(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", w.Code, w.Body.String())
	}
}

func TestNewMergesPlatformAllowlistHashes(t *testing.T) {
	t.Setenv("TEE_BACKEND", "simulation")
	t.Setenv("CONTRACT_PRICEFEED_HASH", "0x1111111111111111111111111111111111111111")
	t.Setenv("CONTRACT_RANDOMNESSLOG_HASH", "0x2222222222222222222222222222222222222222")
	t.Setenv("CONTRACT_AUTOMATIONANCHOR_HASH", "0x3333333333333333333333333333333333333333")
	t.Setenv("CONTRACT_SERVICEGATEWAY_HASH", "0x4444444444444444444444444444444444444444")
	t.Setenv("CONTRACT_PAYMENTHUB_HASH", "0x5555555555555555555555555555555555555555")
	t.Setenv("CONTRACT_GOVERNANCE_HASH", "0x6666666666666666666666666666666666666666")
	t.Setenv("CONTRACT_GAS_HASH", "0x7777777777777777777777777777777777777777")

	m, err := nitro.New(nitro.Config{NitroType: ServiceID})
	if err != nil {
		t.Fatalf("nitro.New: %v", err)
	}

	allowlist, err := ParseAllowlist(`{"contracts":{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":["foo"]}}`)
	if err != nil {
		t.Fatalf("ParseAllowlist: %v", err)
	}

	svc, err := New(Config{
		Nitro:     m,
		Allowlist: allowlist,
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	if !svc.allowlist.Allows("0x1111111111111111111111111111111111111111", "update") {
		t.Fatal("expected pricefeed update to be allowlisted")
	}
	if !svc.allowlist.Allows("0x2222222222222222222222222222222222222222", "record") {
		t.Fatal("expected randomnesslog record to be allowlisted")
	}
	if !svc.allowlist.Allows("0x3333333333333333333333333333333333333333", "markExecuted") {
		t.Fatal("expected automation markExecuted to be allowlisted")
	}
	if !svc.allowlist.Allows("0x4444444444444444444444444444444444444444", "fulfillRequest") {
		t.Fatal("expected service gateway fulfillRequest to be allowlisted")
	}
	if !svc.allowlist.Allows("0x5555555555555555555555555555555555555555", "pay") {
		t.Fatal("expected payment hub pay to be allowlisted")
	}
	if !svc.allowlist.Allows("0x6666666666666666666666666666666666666666", "stake") {
		t.Fatal("expected governance stake to be allowlisted")
	}
	if !svc.allowlist.Allows("0x7777777777777777777777777777777777777777", "transfer") {
		t.Fatal("expected GAS transfer to be allowlisted")
	}
	if !svc.allowlist.Allows("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "foo") {
		t.Fatal("expected existing allowlist entry to be preserved")
	}
}

func TestNewEmptyAllowlistStillAllowsPriceFeedUpdate(t *testing.T) {
	t.Setenv("TEE_BACKEND", "simulation")
	t.Setenv("CONTRACT_PRICEFEED_HASH", "0x9999999999999999999999999999999999999999")

	m, err := nitro.New(nitro.Config{NitroType: ServiceID})
	if err != nil {
		t.Fatalf("nitro.New: %v", err)
	}

	svc, err := New(Config{
		Nitro:        m,
		AllowlistRaw: "",
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	if !svc.allowlist.Allows("0x9999999999999999999999999999999999999999", "update") {
		t.Fatal("expected pricefeed update to be allowlisted even when TXPROXY_ALLOWLIST is empty")
	}
}

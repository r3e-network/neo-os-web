package neooracle

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	internalhttputil "github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/testutil"
)

// mockSecretProvider implements secrets.Provider for testing.
type mockSecretProvider struct {
	secret string
	err    error
}

func (m *mockSecretProvider) GetSecret(_ context.Context, _, _ string) (string, error) {
	return m.secret, m.err
}

// newTestOracleService creates a test service with the given allowlist prefixes.
func newTestOracleService(t *testing.T, prefixes []string) *Service {
	t.Helper()
	return newTestOracle(t, URLAllowlist{Prefixes: prefixes})
}

func TestHandleQueryNoUserID(t *testing.T) {
	svc := newTestOracleService(t, nil)
	req := httptest.NewRequest("POST", "/query", strings.NewReader(`{"url":"https://example.com"}`))
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}

func TestHandleQueryEmptyURL(t *testing.T) {
	svc := newTestOracleService(t, nil)
	req := httptest.NewRequest("POST", "/query", strings.NewReader(`{"url":""}`))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}
}

func TestHandleQueryURLNotAllowed(t *testing.T) {
	svc := newTestOracleService(t, []string{"https://allowed.example"})
	req := httptest.NewRequest("POST", "/query", strings.NewReader(`{"url":"https://forbidden.example/data"}`))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}
}

func TestHandleQueryUnsupportedMethodTrace(t *testing.T) {
	svc := newTestOracleService(t, nil)
	req := httptest.NewRequest("POST", "/query", strings.NewReader(`{"url":"https://example.com","method":"TRACE"}`))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}
}

func TestHandleQueryForbiddenHeader(t *testing.T) {
	svc := newTestOracleService(t, nil)
	body := `{"url":"https://example.com","headers":{"X-Bad\r\n":"value"}}`
	req := httptest.NewRequest("POST", "/query", strings.NewReader(body))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}
}

func TestHandleQuerySuccessGET(t *testing.T) {
	up := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("upstream method = %s, want GET", r.Method)
		}
		w.Header().Set("X-Custom", "hello")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"data":"ok"}`))
	}))
	defer up.Close()

	svc := newTestOracleService(t, []string{up.URL})
	body := `{"url":"` + up.URL + `/test"}`
	req := httptest.NewRequest("POST", "/query", strings.NewReader(body))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}

	var resp QueryResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("StatusCode = %d, want 200", resp.StatusCode)
	}
	if resp.Body != `{"data":"ok"}` {
		t.Errorf("Body = %q, want %q", resp.Body, `{"data":"ok"}`)
	}
	if resp.Headers["X-Custom"] != "hello" {
		t.Errorf("X-Custom header = %q, want %q", resp.Headers["X-Custom"], "hello")
	}
}

func TestHandleQueryPostWithBody(t *testing.T) {
	up := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("upstream method = %s, want POST", r.Method)
		}
		b, _ := io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
		w.Write(b)
	}))
	defer up.Close()

	svc := newTestOracleService(t, []string{up.URL})
	payload := `{"url":"` + up.URL + `","method":"POST","body":"hello world"}`
	req := httptest.NewRequest("POST", "/query", strings.NewReader(payload))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}

	var resp QueryResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("StatusCode = %d, want 200", resp.StatusCode)
	}
	if resp.Body != "hello world" {
		t.Errorf("Body = %q, want %q", resp.Body, "hello world")
	}
}

func TestHandleQueryResponseTooLarge(t *testing.T) {
	up := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(strings.Repeat("X", 2048)))
	}))
	defer up.Close()

	svc := newTestOracleService(t, []string{up.URL})
	svc.maxBodyBytes = 64 // tiny limit to trigger truncation

	payload := `{"url":"` + up.URL + `"}`
	req := httptest.NewRequest("POST", "/query", strings.NewReader(payload))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusBadGateway)
	}

	var errResp internalhttputil.ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if errResp.Message != "upstream response too large" {
		t.Errorf("message = %q, want %q", errResp.Message, "upstream response too large")
	}
}

func TestHandleQuerySecretProviderNotConfigured(t *testing.T) {
	svc := newTestOracleService(t, nil)
	// svc.secretProvider is nil by default from newTestOracle
	payload := `{"url":"https://example.com","secret_name":"my-secret"}`
	req := httptest.NewRequest("POST", "/query", strings.NewReader(payload))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusServiceUnavailable)
	}
}

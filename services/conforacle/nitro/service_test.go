package neooracle

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	internalhttputil "github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/nitro"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/testutil"
)

func TestAllowlistBlocksURL(t *testing.T) {
	svc := newTestOracle(t, URLAllowlist{Prefixes: []string{"https://allowed.example"}})
	body := `{"url":"https://forbidden.example/data"}`
	req := httptest.NewRequest("POST", "/query", strings.NewReader(body))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("status=%d want 400", rr.Result().StatusCode)
	}
}

func TestBodyLimitApplied(t *testing.T) {
	// Mock upstream returning large body.
	up := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(strings.Repeat("A", 1024)))
	}))
	defer up.Close()

	svc := newTestOracle(t, URLAllowlist{Prefixes: []string{up.URL}})
	svc.maxBodyBytes = 10 // very small for test

	body := `{"url":"` + up.URL + `"}`
	req := httptest.NewRequest("POST", "/query", strings.NewReader(body))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Result().StatusCode != http.StatusBadGateway {
		t.Fatalf("status=%d want 502", rr.Result().StatusCode)
	}

	var resp internalhttputil.ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if resp.Message != "upstream response too large" {
		t.Fatalf("message=%q want %q", resp.Message, "upstream response too large")
	}
}

func TestServiceConstants(t *testing.T) {
	if ServiceID != "neooracle" {
		t.Errorf("ServiceID = %s, want neooracle", ServiceID)
	}
	if ServiceName != "NeoOracle Service" {
		t.Errorf("ServiceName = %s, want NeoOracle Service", ServiceName)
	}
	if Version != "1.0.0" {
		t.Errorf("Version = %s, want 1.0.0", Version)
	}
}

func TestNewDefaults(t *testing.T) {
	svc := newTestOracle(t, URLAllowlist{Prefixes: []string{"https://example.com"}})
	if svc.ID() != ServiceID {
		t.Errorf("ID() = %s, want %s", svc.ID(), ServiceID)
	}
	if svc.maxBodyBytes != 2*1024*1024 {
		t.Errorf("maxBodyBytes = %d, want %d", svc.maxBodyBytes, 2*1024*1024)
	}
}

func TestNewCustomMaxBodyBytes(t *testing.T) {
	t.Setenv("NITRO_ENV", "testing")
	t.Setenv("TEE_BACKEND", "simulation")
	m, _ := nitro.New(nitro.Config{NitroType: "neooracle"})
	svc, err := New(Config{
		Nitro:        m,
		URLAllowlist: URLAllowlist{Prefixes: []string{"https://example.com"}},
		MaxBodyBytes: 512,
		Transport:    http.DefaultTransport,
	})
	if err != nil {
		t.Fatalf("New() err = %v", err)
	}
	if svc.maxBodyBytes != 512 {
		t.Errorf("maxBodyBytes = %d, want 512", svc.maxBodyBytes)
	}
}

func TestHandleQueryMissingUserID(t *testing.T) {
	svc := newTestOracle(t, URLAllowlist{})
	req := httptest.NewRequest("POST", "/query", strings.NewReader(`{"url":"https://example.com"}`))
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}

func TestHandleQueryMissingURL(t *testing.T) {
	svc := newTestOracle(t, URLAllowlist{})
	req := httptest.NewRequest("POST", "/query", strings.NewReader(`{}`))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}
}

func TestHandleQueryUnsupportedMethod(t *testing.T) {
	svc := newTestOracle(t, URLAllowlist{})
	req := httptest.NewRequest("POST", "/query", strings.NewReader(`{"url":"https://example.com","method":"TRACE"}`))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleQuery(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}
}

func TestHandleQuerySuccess(t *testing.T) {
	up := testutil.NewHTTPTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Test", "ok")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"result":true}`))
	}))
	defer up.Close()

	svc := newTestOracle(t, URLAllowlist{Prefixes: []string{up.URL}})
	body := `{"url":"` + up.URL + `"}`
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
	if resp.Body != `{"result":true}` {
		t.Errorf("Body = %q, want %q", resp.Body, `{"result":true}`)
	}
}

// newTestOracle returns a service with minimal deps; secrets client won't be used.
// It uses http.DefaultTransport (no SSRF dialer) so tests can reach httptest servers on localhost.
func newTestOracle(t *testing.T, allowlist URLAllowlist) *Service {
	t.Helper()
	t.Setenv("NITRO_ENV", "testing")
	t.Setenv("TEE_BACKEND", "simulation")
	t.Setenv("STRICT_IDENTITY_MODE", "false")
	t.Setenv("STRICT_IDENTITY_ON_TEE", "false")
	t.Setenv("NITRO_CERT", "")

	m, _ := nitro.New(nitro.Config{NitroType: "neooracle"})
	svc, err := New(Config{
		Nitro:        m,
		URLAllowlist: allowlist,
		Transport:    http.DefaultTransport,
	})
	if err != nil {
		t.Fatalf("New() err = %v", err)
	}
	return svc
}

package globalsigner

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/marble"
)

// newTestService creates a hydrated GlobalSigner service for handler tests.
func newTestService(t *testing.T) *Service {
	t.Helper()
	t.Setenv("MARBLE_ENV", "development")

	m, err := marble.New(marble.Config{MarbleType: "globalsigner"})
	if err != nil {
		t.Fatalf("marble.New: %v", err)
	}
	m.SetTestSecret("GLOBALSIGNER_MASTER_SEED", bytes.Repeat([]byte{0xAB}, 32))

	s, err := New(Config{Marble: m})
	if err != nil {
		t.Fatalf("globalsigner.New: %v", err)
	}

	if err := s.hydrate(context.Background()); err != nil {
		t.Fatalf("hydrate: %v", err)
	}
	return s
}

// ---------------------------------------------------------------------------
// Public endpoints – wrong method
// ---------------------------------------------------------------------------

func TestHandleStatusWrongMethod(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/status", nil)
	s.handleStatus(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

func TestHandleListKeysWrongMethod(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/keys", nil)
	s.handleListKeys(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

func TestHandleAttestationWrongMethod(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/attestation", nil)
	s.handleAttestation(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Public endpoints – success
// ---------------------------------------------------------------------------

func TestHandleStatusSuccess(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	s.handleStatus(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp StatusResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Service != ServiceName {
		t.Errorf("service = %q, want %q", resp.Service, ServiceName)
	}
	if !resp.Healthy {
		t.Error("expected healthy=true after hydration")
	}
	if resp.ActiveKeyVersion == "" {
		t.Error("expected non-empty active key version")
	}
}

func TestHandleListKeysSuccess(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/keys", nil)
	s.handleListKeys(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp KeysResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.ActiveVersion == "" {
		t.Error("expected non-empty active version")
	}
	if len(resp.KeyVersions) == 0 {
		t.Error("expected at least one key version")
	}
}

func TestHandleAttestationSuccess(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/attestation", nil)
	s.handleAttestation(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp MasterKeyAttestation
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.KeyVersion == "" {
		t.Error("expected non-empty key version")
	}
	if !resp.Simulated {
		t.Error("expected simulated=true when running outside enclave in tests")
	}
}

// ---------------------------------------------------------------------------
// Protected endpoints – wrong method (calling handlers directly, no middleware)
// ---------------------------------------------------------------------------

func TestHandleSignWrongMethod(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/sign", nil)
	s.handleSign(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

func TestHandleSignRawWrongMethod(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/sign-raw", nil)
	s.handleSignRaw(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

func TestHandleRotateWrongMethod(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/rotate", nil)
	s.handleRotate(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

func TestHandleDeriveWrongMethod(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/derive", nil)
	s.handleDerive(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Protected endpoints – invalid JSON body
// ---------------------------------------------------------------------------

func TestHandleSignInvalidJSON(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	body := bytes.NewBufferString(`{invalid`)
	req := httptest.NewRequest(http.MethodPost, "/sign", body)
	req.Header.Set("Content-Type", "application/json")
	s.handleSign(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestHandleSignRawInvalidJSON(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	body := bytes.NewBufferString(`{not json}`)
	req := httptest.NewRequest(http.MethodPost, "/sign-raw", body)
	req.Header.Set("Content-Type", "application/json")
	s.handleSignRaw(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestHandleDeriveInvalidJSON(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	body := bytes.NewBufferString(`{bad`)
	req := httptest.NewRequest(http.MethodPost, "/derive", body)
	req.Header.Set("Content-Type", "application/json")
	s.handleDerive(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Protected endpoints – success paths (handlers called directly)
// ---------------------------------------------------------------------------

func TestHandleRotateSuccess(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	// Empty body is valid for rotate (force defaults to false).
	req := httptest.NewRequest(http.MethodPost, "/rotate", nil)
	req.ContentLength = 0
	s.handleRotate(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp RotateResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.NewVersion == "" {
		t.Error("expected non-empty new_version")
	}
}

func TestHandleSignSuccess(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	payload, _ := json.Marshal(SignRequest{
		Domain: "test-domain",
		Data:   "deadbeef",
	})
	req := httptest.NewRequest(http.MethodPost, "/sign", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	s.handleSign(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp SignResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Signature == "" {
		t.Error("expected non-empty signature")
	}
	if resp.PubKeyHex == "" {
		t.Error("expected non-empty pubkey_hex")
	}
}

func TestHandleSignRawSuccess(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	payload, _ := json.Marshal(SignRawRequest{
		Data: "cafebabe",
	})
	req := httptest.NewRequest(http.MethodPost, "/sign-raw", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	s.handleSignRaw(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp SignResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Signature == "" {
		t.Error("expected non-empty signature")
	}
}

func TestHandleDeriveSuccess(t *testing.T) {
	s := newTestService(t)
	rec := httptest.NewRecorder()
	payload, _ := json.Marshal(DeriveRequest{
		Domain: "test-domain",
		Path:   "user/123",
	})
	req := httptest.NewRequest(http.MethodPost, "/derive", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	s.handleDerive(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp DeriveResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.PubKeyHex == "" {
		t.Error("expected non-empty pubkey_hex")
	}
	if resp.KeyVersion == "" {
		t.Error("expected non-empty key_version")
	}
}

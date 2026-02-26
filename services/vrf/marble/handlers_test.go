package neovrf

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/marble"
)

// newTestVRF returns a VRF service with ephemeral signing key for testing.
func newTestVRF(t *testing.T) *Service {
	t.Helper()
	m, _ := marble.New(marble.Config{MarbleType: "neovrf"})
	svc, err := New(Config{Marble: m})
	if err != nil {
		t.Fatalf("New() err = %v", err)
	}
	return svc
}

func TestHandleRandomUnauthorized(t *testing.T) {
	svc := newTestVRF(t)
	req := httptest.NewRequest("POST", "/random", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()
	svc.handleRandom(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}

func TestHandlePubKeyNoKey(t *testing.T) {
	svc := newTestVRF(t)
	svc.publicKey = nil // simulate missing key
	req := httptest.NewRequest("GET", "/pubkey", nil)
	rr := httptest.NewRecorder()
	svc.handlePubKey(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusServiceUnavailable)
	}
}

func TestHandlePubKeySuccess(t *testing.T) {
	svc := newTestVRF(t)
	req := httptest.NewRequest("GET", "/pubkey", nil)
	rr := httptest.NewRecorder()
	svc.handlePubKey(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}
	var resp PublicKeyResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.PublicKey == "" {
		t.Error("PublicKey is empty")
	}
}

func TestHandleRandomRequestIDTooLong(t *testing.T) {
	svc := newTestVRF(t)
	longID := strings.Repeat("x", 129)
	body := `{"request_id":"` + longID + `"}`
	req := httptest.NewRequest("POST", "/random", strings.NewReader(body))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleRandom(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}
}

func TestHandleRandomSuccess(t *testing.T) {
	svc := newTestVRF(t)
	req := httptest.NewRequest("POST", "/random", strings.NewReader(`{"request_id":"test-123"}`))
	req.Header.Set("X-User-ID", "user1")
	rr := httptest.NewRecorder()
	svc.handleRandom(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}
	var resp RandomResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.RequestID != "test-123" {
		t.Errorf("RequestID = %q, want %q", resp.RequestID, "test-123")
	}
	if resp.Randomness == "" {
		t.Error("Randomness is empty")
	}
	if resp.Signature == "" {
		t.Error("Signature is empty")
	}
	if resp.Timestamp == 0 {
		t.Error("Timestamp is zero")
	}
}

func TestHandleRandomDuplicateRequestID(t *testing.T) {
	svc := newTestVRF(t)

	// First request should succeed.
	req1 := httptest.NewRequest("POST", "/random", strings.NewReader(`{"request_id":"dup-id"}`))
	req1.Header.Set("X-User-ID", "user1")
	rr1 := httptest.NewRecorder()
	svc.handleRandom(rr1, req1)
	if rr1.Code != http.StatusOK {
		t.Fatalf("first request: status = %d, want %d", rr1.Code, http.StatusOK)
	}
	var resp1 RandomResponse
	if err := json.NewDecoder(rr1.Body).Decode(&resp1); err != nil {
		t.Fatalf("decode first response: %v", err)
	}

	// Second request with same ID should return the same deterministic result.
	req2 := httptest.NewRequest("POST", "/random", strings.NewReader(`{"request_id":"dup-id"}`))
	req2.Header.Set("X-User-ID", "user1")
	rr2 := httptest.NewRecorder()
	svc.handleRandom(rr2, req2)
	if rr2.Code != http.StatusOK {
		t.Errorf("duplicate request: status = %d, want %d", rr2.Code, http.StatusOK)
	}
	var resp2 RandomResponse
	if err := json.NewDecoder(rr2.Body).Decode(&resp2); err != nil {
		t.Fatalf("decode second response: %v", err)
	}
	if resp2.RequestID != resp1.RequestID {
		t.Errorf("duplicate request_id = %q, want %q", resp2.RequestID, resp1.RequestID)
	}
	if resp2.Randomness != resp1.Randomness {
		t.Errorf("duplicate randomness mismatch: got %q, want %q", resp2.Randomness, resp1.Randomness)
	}
	if resp2.Signature != resp1.Signature {
		t.Errorf("duplicate signature mismatch: got %q, want %q", resp2.Signature, resp1.Signature)
	}
}

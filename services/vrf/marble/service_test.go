package neorand

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/R3E-Network/service_layer/infrastructure/marble"
)

func TestNeoRandRandomAndVerify(t *testing.T) {
	m, err := marble.New(marble.Config{MarbleType: ServiceID})
	if err != nil {
		t.Fatalf("marble.New: %v", err)
	}

	// Use a stable local key for deterministic outputs in tests.
	m.SetTestSecret("VRF_PRIVATE_KEY", bytes.Repeat([]byte{0x11}, 32))

	svc, err := New(Config{Marble: m})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := svc.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(func() { _ = svc.Stop() })

	server := httptest.NewServer(svc.Router())
	defer server.Close()

	randomReq := RandomRequest{AppID: "app-1", RequestID: "req-1", SeedHex: "0x01"}
	body, _ := json.Marshal(randomReq)

	httpReq, _ := http.NewRequest(http.MethodPost, server.URL+"/random", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Service-ID", "gateway") // satisfy RequireServiceAuth in non-strict mode

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		t.Fatalf("POST /random: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var randomResp RandomResponse
	if err := json.NewDecoder(resp.Body).Decode(&randomResp); err != nil {
		t.Fatalf("decode /random response: %v", err)
	}
	if randomResp.Randomness == "" || randomResp.Signature == "" || randomResp.PublicKey == "" {
		t.Fatalf("missing fields in response: %#v", randomResp)
	}

	verifyReq := VerifyRequest{
		Domain:    randomResp.Domain,
		Payload:   randomResp.Payload,
		Signature: randomResp.Signature,
		PublicKey: randomResp.PublicKey,
	}
	vbody, _ := json.Marshal(verifyReq)
	vhttpReq, _ := http.NewRequest(http.MethodPost, server.URL+"/verify", bytes.NewReader(vbody))
	vhttpReq.Header.Set("Content-Type", "application/json")

	vresp, err := http.DefaultClient.Do(vhttpReq)
	if err != nil {
		t.Fatalf("POST /verify: %v", err)
	}
	defer vresp.Body.Close()

	if vresp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", vresp.StatusCode)
	}

	var verifyResp VerifyResponse
	if err := json.NewDecoder(vresp.Body).Decode(&verifyResp); err != nil {
		t.Fatalf("decode /verify response: %v", err)
	}
	if !verifyResp.Valid {
		t.Fatalf("expected proof to be valid: %#v", verifyResp)
	}
}

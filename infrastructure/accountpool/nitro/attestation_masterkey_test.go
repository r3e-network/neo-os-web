package neoaccounts

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/serviceauth"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/logging"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/middleware"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/nitro"
)

func TestLoadMasterKey_SetsDerivedFields(t *testing.T) {
	m, err := nitro.New(nitro.Config{NitroType: "neoaccounts"})
	if err != nil {
		t.Fatalf("nitro.New: %v", err)
	}

	key := bytes.Repeat([]byte{0x02}, 32)
	m.SetTestSecret(secretPoolMasterKey, key)

	pub, err := deriveMasterPubKey(key)
	if err != nil {
		t.Fatalf("deriveMasterPubKey: %v", err)
	}
	hash := sha256.Sum256(pub)
	m.SetTestSecret(secretPoolMasterKeyHash, hash[:]) // raw form
	m.SetTestSecret(secretPoolMasterAttestationID, []byte("att-123"))

	svc, err := New(Config{Nitro: m})
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	if err := svc.loadMasterKey(m); err != nil {
		t.Fatalf("loadMasterKey: %v", err)
	}

	summary := svc.masterKeySummary()
	if summary.Hash != hex.EncodeToString(hash[:]) {
		t.Fatalf("summary hash = %q, want %q", summary.Hash, hex.EncodeToString(hash[:]))
	}
	if summary.AttestationHash != "att-123" {
		t.Fatalf("attestation hash = %q, want att-123", summary.AttestationHash)
	}
}

func TestLoadMasterKey_FailsOnMissingSecrets(t *testing.T) {
	t.Setenv("POOL_MASTER_KEY", "")
	t.Setenv("COORDINATOR_MASTER_SEED", "")
	t.Setenv("NEOACCOUNTS_ALLOW_EPHEMERAL_MASTER_KEY", "false")

	m, _ := nitro.New(nitro.Config{NitroType: "neoaccounts"})

	s, err := New(Config{Nitro: m})

	if err == nil {
		t.Fatalf("expected error when secrets are missing, got svc with key: %x", s.masterKey)
	}
}
func TestLoadMasterKey_FailsOnHashMismatch(t *testing.T) {
	m, _ := nitro.New(nitro.Config{NitroType: "neoaccounts"})
	key := bytes.Repeat([]byte{0x03}, 32)
	m.SetTestSecret(secretPoolMasterKey, key)
	m.SetTestSecret(secretPoolMasterKeyHash, []byte("deadbeef")) // invalid hash input

	svc, _ := New(Config{Nitro: m})
	if err := svc.loadMasterKey(m); err == nil {
		t.Fatalf("expected error for invalid hash secret")
	}
}

func TestLoadMasterKey_DerivesFromSeed(t *testing.T) {
	t.Setenv("POOL_MASTER_KEY", "") // Ensure host env doesn't break test

	m, _ := nitro.New(nitro.Config{NitroType: "neoaccounts"})
	m.SetTestSecret(secretCoordinatorMasterSeed, bytes.Repeat([]byte{0x04}, 16))

	svc, _ := New(Config{Nitro: m})
	if err := svc.loadMasterKey(m); err != nil {
		t.Fatalf("loadMasterKey(seed): %v", err)
	}
	if len(svc.masterKey) < 32 {
		t.Fatalf("expected derived master key to be set")
	}
}

func TestBuildMasterKeyAttestation_NonEnclaveIsSimulated(t *testing.T) {
	m, _ := nitro.New(nitro.Config{NitroType: "neoaccounts"})
	key := bytes.Repeat([]byte{0x05}, 32)
	m.SetTestSecret(secretPoolMasterKey, key)
	svc, _ := New(Config{Nitro: m})
	_ = svc.loadMasterKey(m)

	att := svc.buildMasterKeyAttestation()
	if att.Source != "neoaccounts" {
		t.Fatalf("source = %q, want neoaccounts", att.Source)
	}
	if !att.Simulated {
		t.Fatalf("expected attestation to be simulated outside enclave")
	}
	if att.Timestamp == "" {
		t.Fatalf("expected timestamp to be set")
	}
}

func TestNitroAttest_ReturnsErrorOutsideEnclave(t *testing.T) {
	m, err := nitro.New(nitro.Config{NitroType: "neoaccounts"})
	if err != nil {
		t.Fatalf("nitro.New: %v", err)
	}

	if _, err := m.Attest([]byte("hello")); err == nil {
		t.Fatalf("expected Attest to fail outside TEE backend")
	}
}

func TestResolveServiceID_Behavior(t *testing.T) {
	t.Skip("temporarily disabled")
	t.Setenv("NITRO_ENV", "development")

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	if _, ok := resolveServiceID(rr, req, ""); ok {
		t.Fatalf("expected missing service_id to be rejected in non-production")
	}
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rr.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/", nil)
	rr = httptest.NewRecorder()
	svc, ok := resolveServiceID(rr, req, "neocompute")
	if !ok || svc != "neocompute" {
		t.Fatalf("resolveServiceID() = (%q,%v), want (neocompute,true)", svc, ok)
	}

	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Service-ID", "neooracle")
	req = req.WithContext(serviceauth.WithServiceID(req.Context(), "neooracle"))
	rr = httptest.NewRecorder()
	if _, ok := resolveServiceID(rr, req, "neocompute"); ok {
		t.Fatalf("expected mismatched service_id to be rejected")
	}
	if rr.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rr.Code)
	}
}

func TestResolveServiceID_ProductionRejectsMismatch(t *testing.T) {
	t.Setenv("NITRO_ENV", "production")

	svc, _ := newTestServiceWithMock(t)

	privateKey, err := rsaKeyForTest()
	if err != nil {
		t.Fatalf("rsaKeyForTest: %v", err)
	}
	gen := serviceauth.NewServiceTokenGenerator(privateKey, "neocompute", time.Hour)
	token, err := gen.GenerateToken()
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}

	auth := middleware.NewServiceAuthMiddleware(middleware.ServiceAuthConfig{
		PublicKey:       &privateKey.PublicKey,
		Logger:          logging.New("test", "error", "text"),
		AllowedServices: []string{"neocompute"},
	})

	body := []byte(`{"service_id":"neooracle","count":1}`)
	req := httptest.NewRequest(http.MethodPost, "/request", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(serviceauth.ServiceTokenHeader, token)
	req.TLS = &tls.ConnectionState{
		VerifiedChains: [][]*x509.Certificate{{&x509.Certificate{DNSNames: []string{"neocompute"}}}},
	}

	rr := httptest.NewRecorder()
	auth.Handler(http.HandlerFunc(svc.handleRequestAccounts)).ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rr.Code)
	}
}

func rsaKeyForTest() (*rsa.PrivateKey, error) {
	return rsa.GenerateKey(rand.Reader, 2048)
}

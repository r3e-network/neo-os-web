package confidential

import (
	"context"
	"testing"

	"github.com/R3E-Network/service_layer/internal/app/domain/account"
	domainconf "github.com/R3E-Network/service_layer/internal/app/domain/confidential"
	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
)

func TestService_CreateEnclave(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	enclave, err := svc.CreateEnclave(context.Background(), domainconf.Enclave{AccountID: acct.ID, Name: "TEE", Endpoint: "https://tee"})
	if err != nil {
		t.Fatalf("create enclave: %v", err)
	}
	if enclave.Status != domainconf.EnclaveStatusInactive {
		t.Fatalf("expected default inactive")
	}
	list, err := svc.ListEnclaves(context.Background(), acct.ID)
	if err != nil || len(list) != 1 {
		t.Fatalf("list enclaves failed")
	}
}

func TestService_CreateSealedKey(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)
	enclave, _ := svc.CreateEnclave(context.Background(), domainconf.Enclave{AccountID: acct.ID, Name: "TEE", Endpoint: "https://tee"})
	key, err := svc.CreateSealedKey(context.Background(), domainconf.SealedKey{AccountID: acct.ID, EnclaveID: enclave.ID, Name: "default", Blob: []byte("blob")})
	if err != nil {
		t.Fatalf("create sealed key: %v", err)
	}
	keys, err := svc.ListSealedKeys(context.Background(), acct.ID, enclave.ID, 10)
	if err != nil {
		t.Fatalf("list sealed keys: %v", err)
	}
	if len(keys) != 1 || keys[0].ID != key.ID {
		t.Fatalf("expected one sealed key")
	}
}

func TestService_CreateAttestation(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)
	enclave, _ := svc.CreateEnclave(context.Background(), domainconf.Enclave{AccountID: acct.ID, Name: "TEE", Endpoint: "https://tee"})
	att, err := svc.CreateAttestation(context.Background(), domainconf.Attestation{AccountID: acct.ID, EnclaveID: enclave.ID, Report: "quote", Status: "valid"})
	if err != nil {
		t.Fatalf("create attestation: %v", err)
	}
	list, err := svc.ListAttestations(context.Background(), acct.ID, enclave.ID, 10)
	if err != nil {
		t.Fatalf("list attestations: %v", err)
	}
	if len(list) != 1 || list[0].ID != att.ID {
		t.Fatalf("expected single attestation")
	}
}

func TestService_ListAccountAttestations(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)
	enclave1, _ := svc.CreateEnclave(context.Background(), domainconf.Enclave{AccountID: acct.ID, Name: "TEE1", Endpoint: "https://tee1"})
	enclave2, _ := svc.CreateEnclave(context.Background(), domainconf.Enclave{AccountID: acct.ID, Name: "TEE2", Endpoint: "https://tee2"})
	if _, err := svc.CreateAttestation(context.Background(), domainconf.Attestation{AccountID: acct.ID, EnclaveID: enclave1.ID, Report: "quote-1", Status: "valid"}); err != nil {
		t.Fatalf("create attestation 1: %v", err)
	}
	if _, err := svc.CreateAttestation(context.Background(), domainconf.Attestation{AccountID: acct.ID, EnclaveID: enclave2.ID, Report: "quote-2", Status: "valid"}); err != nil {
		t.Fatalf("create attestation 2: %v", err)
	}
	atts, err := svc.ListAccountAttestations(context.Background(), acct.ID, 10)
	if err != nil {
		t.Fatalf("list account attestations: %v", err)
	}
	if len(atts) != 2 {
		t.Fatalf("expected 2 attestations, got %d", len(atts))
	}
	seen := map[string]bool{}
	for _, att := range atts {
		seen[att.EnclaveID] = true
	}
	if len(seen) != 2 {
		t.Fatalf("expected attestations from both enclaves, got %+v", seen)
	}
}

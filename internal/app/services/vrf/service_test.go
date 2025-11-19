package vrf

import (
	"context"
	"testing"

	"github.com/R3E-Network/service_layer/internal/app/domain/account"
	domainvrf "github.com/R3E-Network/service_layer/internal/app/domain/vrf"
	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
)

const (
	testVRFWallet    = "0xabc123abc123abc123abc123abc123abc123abcd"
	testVRFBadWallet = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
)

func TestService_CreateKeyAndList(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	if _, err := store.CreateWorkspaceWallet(context.Background(), account.WorkspaceWallet{
		WorkspaceID:   acct.ID,
		WalletAddress: testVRFWallet,
		Status:        "active",
	}); err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
	key, err := svc.CreateKey(context.Background(), domainvrf.Key{
		AccountID:     acct.ID,
		PublicKey:     "pk",
		Label:         "Label",
		WalletAddress: testVRFWallet,
	})
	if err != nil {
		t.Fatalf("create key: %v", err)
	}
	if key.Status != domainvrf.KeyStatusInactive {
		t.Fatalf("expected inactive status")
	}

	keys, err := svc.ListKeys(context.Background(), acct.ID)
	if err != nil {
		t.Fatalf("list keys: %v", err)
	}
	if len(keys) != 1 {
		t.Fatalf("expected 1 key")
	}
}

func TestService_UpdateKeyOwnership(t *testing.T) {
	store := memory.New()
	acct1, err := store.CreateAccount(context.Background(), account.Account{Owner: "one"})
	if err != nil {
		t.Fatalf("create account1: %v", err)
	}
	acct2, err := store.CreateAccount(context.Background(), account.Account{Owner: "two"})
	if err != nil {
		t.Fatalf("create account2: %v", err)
	}
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	if _, err := store.CreateWorkspaceWallet(context.Background(), account.WorkspaceWallet{WorkspaceID: acct1.ID, WalletAddress: testVRFWallet}); err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
	key, err := svc.CreateKey(context.Background(), domainvrf.Key{
		AccountID:     acct1.ID,
		PublicKey:     "pk",
		WalletAddress: testVRFWallet,
	})
	if err != nil {
		t.Fatalf("create key: %v", err)
	}

	_, err = svc.UpdateKey(context.Background(), acct2.ID, domainvrf.Key{ID: key.ID, AccountID: acct2.ID, PublicKey: "pk", WalletAddress: testVRFWallet})
	if err == nil {
		t.Fatalf("expected ownership error")
	}
}

func TestService_CreateRequestDispatcher(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	if _, err := store.CreateWorkspaceWallet(context.Background(), account.WorkspaceWallet{WorkspaceID: acct.ID, WalletAddress: testVRFWallet}); err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
	key, err := svc.CreateKey(context.Background(), domainvrf.Key{AccountID: acct.ID, PublicKey: "pk", WalletAddress: testVRFWallet, Status: domainvrf.KeyStatusActive})
	if err != nil {
		t.Fatalf("create key: %v", err)
	}
	called := false
	svc.WithDispatcher(DispatcherFunc(func(ctx context.Context, req domainvrf.Request, k domainvrf.Key) error {
		called = true
		if req.KeyID != k.ID {
			t.Fatalf("dispatcher key mismatch")
		}
		return nil
	}))

	req, err := svc.CreateRequest(context.Background(), acct.ID, key.ID, "consumer", "seed", map[string]string{"env": "prod"})
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	if !called {
		t.Fatalf("expected dispatcher call")
	}
	got, err := svc.GetRequest(context.Background(), acct.ID, req.ID)
	if err != nil {
		t.Fatalf("get request: %v", err)
	}
	if got.ID != req.ID {
		t.Fatalf("request mismatch")
	}
}

func TestService_CreateRequestRejectsForeignKey(t *testing.T) {
	store := memory.New()
	acct1, err := store.CreateAccount(context.Background(), account.Account{Owner: "one"})
	if err != nil {
		t.Fatalf("create account1: %v", err)
	}
	acct2, err := store.CreateAccount(context.Background(), account.Account{Owner: "two"})
	if err != nil {
		t.Fatalf("create account2: %v", err)
	}
	svc := New(store, store, nil)
	key, err := svc.CreateKey(context.Background(), domainvrf.Key{
		AccountID:     acct1.ID,
		PublicKey:     "pk",
		WalletAddress: testVRFWallet,
	})
	if err != nil {
		t.Fatalf("create key: %v", err)
	}

	if _, err := svc.CreateRequest(context.Background(), acct2.ID, key.ID, "consumer", "seed", nil); err == nil {
		t.Fatalf("expected ownership check for foreign key")
	}
}

func TestService_CreateKeyRequiresWalletRegistration(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)

	if _, err := svc.CreateKey(context.Background(), domainvrf.Key{
		AccountID:     acct.ID,
		PublicKey:     "pk",
		WalletAddress: testVRFBadWallet,
	}); err == nil {
		t.Fatalf("expected error when wallet not registered")
	}
}

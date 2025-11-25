package dta

import (
	"context"
	"testing"

	"github.com/R3E-Network/service_layer/internal/app/domain/account"
	domaindta "github.com/R3E-Network/service_layer/internal/app/domain/dta"
	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
)

const (
	testOrderWalletLower = "0xabc123abc123abc123abc123abc123abc123abcd"
	testOrderWalletUpper = "0xABC123ABC123ABC123ABC123ABC123ABC123ABCD"
)

func TestService_CreateProduct(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	prod, err := svc.CreateProduct(context.Background(), domaindta.Product{AccountID: acct.ID, Name: "Fund", Symbol: "FND", Type: "open"})
	if err != nil {
		t.Fatalf("create product: %v", err)
	}
	if prod.Status != domaindta.ProductStatusInactive {
		t.Fatalf("expected inactive")
	}
	products, err := svc.ListProducts(context.Background(), acct.ID)
	if err != nil {
		t.Fatalf("list products: %v", err)
	}
	if len(products) != 1 {
		t.Fatalf("expected one product")
	}
}

func TestService_CreateOrder(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	if _, err := store.CreateWorkspaceWallet(context.Background(), account.WorkspaceWallet{WorkspaceID: acct.ID, WalletAddress: testOrderWalletLower}); err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
	prod, err := svc.CreateProduct(context.Background(), domaindta.Product{AccountID: acct.ID, Name: "Fund", Symbol: "FND", Type: "open"})
	if err != nil {
		t.Fatalf("create product: %v", err)
	}
	order, err := svc.CreateOrder(context.Background(), acct.ID, prod.ID, domaindta.OrderTypeSubscription, "100", testOrderWalletUpper, map[string]string{"tier": "gold"})
	if err != nil {
		t.Fatalf("create order: %v", err)
	}
	if order.Type != domaindta.OrderTypeSubscription {
		t.Fatalf("order type mismatch")
	}
	got, err := svc.GetOrder(context.Background(), acct.ID, order.ID)
	if err != nil {
		t.Fatalf("get order: %v", err)
	}
	if got.ID != order.ID {
		t.Fatalf("order mismatch")
	}
}

func TestService_CreateOrderRequiresWallet(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	prod, err := svc.CreateProduct(context.Background(), domaindta.Product{AccountID: acct.ID, Name: "Fund", Symbol: "FND", Type: "open"})
	if err != nil {
		t.Fatalf("create product: %v", err)
	}
	if _, err := svc.CreateOrder(context.Background(), acct.ID, prod.ID, domaindta.OrderTypeSubscription, "100", "", nil); err == nil {
		t.Fatalf("expected wallet error")
	}
}

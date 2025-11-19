package datalink

import (
	"context"
	"testing"

	"github.com/R3E-Network/service_layer/internal/app/domain/account"
	domainlink "github.com/R3E-Network/service_layer/internal/app/domain/datalink"
	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
)

const testChannelSigner = "0xdddd111122223333444455556666777788889999"

func TestService_CreateChannel(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	if _, err := store.CreateWorkspaceWallet(context.Background(), account.WorkspaceWallet{WorkspaceID: acct.ID, WalletAddress: testChannelSigner}); err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
	ch, err := svc.CreateChannel(context.Background(), domainlink.Channel{AccountID: acct.ID, Name: "Provider", Endpoint: "https://example", SignerSet: []string{testChannelSigner}})
	if err != nil {
		t.Fatalf("create channel: %v", err)
	}
	if ch.Status != domainlink.ChannelStatusInactive {
		t.Fatalf("expected default inactive")
	}
	channels, err := svc.ListChannels(context.Background(), acct.ID)
	if err != nil {
		t.Fatalf("list channels: %v", err)
	}
	if len(channels) != 1 {
		t.Fatalf("expected one channel")
	}
}

func TestService_CreateDelivery(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	if _, err := store.CreateWorkspaceWallet(context.Background(), account.WorkspaceWallet{WorkspaceID: acct.ID, WalletAddress: testChannelSigner}); err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
	ch, err := svc.CreateChannel(context.Background(), domainlink.Channel{AccountID: acct.ID, Name: "Provider", Endpoint: "https://example", SignerSet: []string{testChannelSigner}})
	if err != nil {
		t.Fatalf("create channel: %v", err)
	}
	called := false
	svc.WithDispatcher(DispatcherFunc(func(ctx context.Context, del domainlink.Delivery, channel domainlink.Channel) error {
		called = true
		if del.ChannelID != channel.ID {
			t.Fatalf("dispatcher mismatch")
		}
		return nil
	}))

	del, err := svc.CreateDelivery(context.Background(), acct.ID, ch.ID, map[string]any{"payload": "x"}, map[string]string{"env": "prod"})
	if err != nil {
		t.Fatalf("create delivery: %v", err)
	}
	if !called {
		t.Fatalf("expected dispatcher call")
	}
	got, err := svc.GetDelivery(context.Background(), acct.ID, del.ID)
	if err != nil || got.ID != del.ID {
		t.Fatalf("get delivery mismatch")
	}
}

func TestService_ChannelRequiresSignerWallet(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	if _, err := svc.CreateChannel(context.Background(), domainlink.Channel{AccountID: acct.ID, Name: "Provider", Endpoint: "https://example", SignerSet: []string{"unknown"}}); err == nil {
		t.Fatalf("expected signer validation error")
	}
}

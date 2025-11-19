package datafeeds

import (
	"context"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/app/domain/account"
	domaindf "github.com/R3E-Network/service_layer/internal/app/domain/datafeeds"
	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
)

const testFeedSigner = "0xbbbbccccddddeeeeffffaaaabbbbccccddddeeee"

func TestService_CreateFeed(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	if _, err := store.CreateWorkspaceWallet(context.Background(), account.WorkspaceWallet{WorkspaceID: acct.ID, WalletAddress: testFeedSigner}); err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
	feed, err := svc.CreateFeed(context.Background(), domaindf.Feed{
		AccountID: acct.ID,
		Pair:      "ETH/USD",
		Decimals:  8,
		SignerSet: []string{testFeedSigner},
	})
	if err != nil {
		t.Fatalf("create feed: %v", err)
	}
	if feed.Pair != "ETH/USD" {
		t.Fatalf("expected pair normalized to upper, got %s", feed.Pair)
	}

	feeds, err := svc.ListFeeds(context.Background(), acct.ID)
	if err != nil {
		t.Fatalf("list feeds: %v", err)
	}
	if len(feeds) != 1 {
		t.Fatalf("expected 1 feed, got %d", len(feeds))
	}
}

func TestService_CreateFeedValidation(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	if _, err := svc.CreateFeed(context.Background(), domaindf.Feed{AccountID: acct.ID, Decimals: 0}); err == nil {
		t.Fatalf("expected validation error")
	}
}

func TestService_CreateFeedRequiresRegisteredSigners(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	_, err = svc.CreateFeed(context.Background(), domaindf.Feed{
		AccountID: acct.ID,
		Pair:      "ETH/USD",
		Decimals:  8,
		SignerSet: []string{"unknown"},
	})
	if err == nil {
		t.Fatalf("expected signer validation error")
	}
}

func TestService_SubmitUpdate(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	feed, err := svc.CreateFeed(context.Background(), domaindf.Feed{
		AccountID: acct.ID,
		Pair:      "BTC/USD",
		Decimals:  8,
	})
	if err != nil {
		t.Fatalf("create feed: %v", err)
	}

	upd, err := svc.SubmitUpdate(context.Background(), acct.ID, feed.ID, 1, "35000", time.Now(), "sig", map[string]string{"Env": "Prod"})
	if err != nil {
		t.Fatalf("submit update: %v", err)
	}
	if upd.RoundID != 1 {
		t.Fatalf("unexpected round id")
	}

	if _, err := svc.SubmitUpdate(context.Background(), acct.ID, feed.ID, 1, "35100", time.Now(), "sig", nil); err == nil {
		t.Fatalf("expected round monotonicity error")
	}

	updates, err := svc.ListUpdates(context.Background(), acct.ID, feed.ID, 10)
	if err != nil {
		t.Fatalf("list updates: %v", err)
	}
	if len(updates) != 1 {
		t.Fatalf("expected 1 update")
	}

	latest, err := svc.LatestUpdate(context.Background(), acct.ID, feed.ID)
	if err != nil {
		t.Fatalf("latest update: %v", err)
	}
	if latest.ID != upd.ID {
		t.Fatalf("expected latest to match first update")
	}
}

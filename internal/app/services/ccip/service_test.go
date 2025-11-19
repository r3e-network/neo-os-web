package ccip

import (
	"context"
	"testing"

	"github.com/R3E-Network/service_layer/internal/app/domain/account"
	domainccip "github.com/R3E-Network/service_layer/internal/app/domain/ccip"
	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
)

const testLaneWallet = "0xaaaabbbbccccddddeeeeffffaaaabbbbccccdddd"

func TestService_CreateLane(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}

	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	if _, err := store.CreateWorkspaceWallet(context.Background(), account.WorkspaceWallet{WorkspaceID: acct.ID, WalletAddress: testLaneWallet}); err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
	lane, err := svc.CreateLane(context.Background(), domainccip.Lane{
		AccountID:   acct.ID,
		Name:        "Primary Lane",
		SourceChain: "Ethereum",
		DestChain:   "Neo",
		SignerSet:   []string{testLaneWallet},
	})
	if err != nil {
		t.Fatalf("create lane: %v", err)
	}
	if lane.SourceChain != "ethereum" {
		t.Fatalf("expected normalized source chain, got %s", lane.SourceChain)
	}

	lanes, err := svc.ListLanes(context.Background(), acct.ID)
	if err != nil {
		t.Fatalf("list lanes: %v", err)
	}
	if len(lanes) != 1 {
		t.Fatalf("expected 1 lane, got %d", len(lanes))
	}
}

func TestService_CreateLaneValidation(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	if _, err := svc.CreateLane(context.Background(), domainccip.Lane{AccountID: acct.ID}); err == nil {
		t.Fatalf("expected validation error")
	}
}

func TestService_SendMessageOwnership(t *testing.T) {
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
	if _, err := store.CreateWorkspaceWallet(context.Background(), account.WorkspaceWallet{WorkspaceID: acct1.ID, WalletAddress: testLaneWallet}); err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
	lane, err := svc.CreateLane(context.Background(), domainccip.Lane{
		AccountID:   acct1.ID,
		Name:        "Lane",
		SourceChain: "eth",
		DestChain:   "neo",
		SignerSet:   []string{testLaneWallet},
	})
	if err != nil {
		t.Fatalf("create lane: %v", err)
	}

	if _, err := svc.SendMessage(context.Background(), acct2.ID, lane.ID, nil, nil, nil, nil); err == nil {
		t.Fatalf("expected ownership error when sending with foreign account")
	}
}

func TestService_SendMessageDispatch(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	svc.WithWorkspaceWallets(store)
	if _, err := store.CreateWorkspaceWallet(context.Background(), account.WorkspaceWallet{WorkspaceID: acct.ID, WalletAddress: testLaneWallet}); err != nil {
		t.Fatalf("seed wallet: %v", err)
	}
	lane, err := svc.CreateLane(context.Background(), domainccip.Lane{
		AccountID:   acct.ID,
		Name:        "Lane",
		SourceChain: "eth",
		DestChain:   "neo",
		SignerSet:   []string{testLaneWallet},
	})
	if err != nil {
		t.Fatalf("create lane: %v", err)
	}
	called := false
	svc.WithDispatcher(DispatcherFunc(func(ctx context.Context, msg domainccip.Message, ln domainccip.Lane) error {
		called = true
		if msg.LaneID != ln.ID {
			t.Fatalf("dispatcher lane mismatch")
		}
		return nil
	}))

	msg, err := svc.SendMessage(context.Background(), acct.ID, lane.ID, map[string]any{"hello": "world"}, []domainccip.TokenTransfer{{Token: "eth", Amount: "1", Recipient: "addr"}}, map[string]string{"Env": "Prod"}, []string{"Priority"})
	if err != nil {
		t.Fatalf("send message: %v", err)
	}
	if len(msg.TokenTransfers) != 1 || msg.TokenTransfers[0].Token != "eth" {
		t.Fatalf("expected normalized token transfer")
	}
	if !called {
		t.Fatalf("expected dispatcher to be called")
	}

	msgs, err := svc.ListMessages(context.Background(), acct.ID, 10)
	if err != nil {
		t.Fatalf("list messages: %v", err)
	}
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message")
	}
}

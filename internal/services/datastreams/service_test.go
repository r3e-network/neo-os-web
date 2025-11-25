package datastreams

import (
	"context"
	"testing"

	"github.com/R3E-Network/service_layer/internal/app/domain/account"
	domainds "github.com/R3E-Network/service_layer/internal/app/domain/datastreams"
	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
)

func TestService_CreateStreamAndList(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, store, nil)
	stream, err := svc.CreateStream(context.Background(), domainds.Stream{
		AccountID: acct.ID,
		Name:      "Market",
		Symbol:    "ETH-USD",
	})
	if err != nil {
		t.Fatalf("create stream: %v", err)
	}
	if stream.Symbol != "ETH-USD" {
		t.Fatalf("expected upper symbol")
	}
	streams, err := svc.ListStreams(context.Background(), acct.ID)
	if err != nil {
		t.Fatalf("list streams: %v", err)
	}
	if len(streams) != 1 {
		t.Fatalf("expected one stream")
	}
}

func TestService_FrameLifecycle(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)
	stream, _ := svc.CreateStream(context.Background(), domainds.Stream{AccountID: acct.ID, Name: "Market", Symbol: "BTC"})

	frame, err := svc.CreateFrame(context.Background(), acct.ID, stream.ID, 1, map[string]any{"price": 100}, 50, domainds.FrameStatusOK, map[string]string{"env": "prod"})
	if err != nil {
		t.Fatalf("create frame: %v", err)
	}
	if frame.Sequence != 1 {
		t.Fatalf("sequence mismatch")
	}
	frames, err := svc.ListFrames(context.Background(), acct.ID, stream.ID, 10)
	if err != nil {
		t.Fatalf("list frames: %v", err)
	}
	if len(frames) != 1 {
		t.Fatalf("expected one frame")
	}
	latest, err := svc.LatestFrame(context.Background(), acct.ID, stream.ID)
	if err != nil {
		t.Fatalf("latest frame: %v", err)
	}
	if latest.ID != frame.ID {
		t.Fatalf("latest mismatch")
	}
}

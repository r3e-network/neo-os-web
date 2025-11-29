package random

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"testing"

	"github.com/R3E-Network/service_layer/applications/storage/memory"
	"github.com/R3E-Network/service_layer/domain/account"
)

func TestServiceGenerate(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "test"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	svc := New(store, nil)
	res, err := svc.Generate(context.Background(), acct.ID, 32, "req-1")
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if len(res.Value) != 32 {
		t.Fatalf("expected 32 bytes, got %d", len(res.Value))
	}
	if res.CreatedAt.IsZero() {
		t.Fatalf("expected timestamp to be set")
	}
	if len(res.Signature) == 0 || len(res.PublicKey) == 0 {
		t.Fatalf("expected signature and public key to be present")
	}
	if !svc.Verify(res) {
		t.Fatalf("expected signature to verify")
	}
	zero := make([]byte, 32)
	if string(res.Value) == string(zero) {
		t.Fatalf("random bytes should not be all zero")
	}

	encoded := EncodeResult(res)
	if _, err := base64.StdEncoding.DecodeString(encoded); err != nil {
		t.Fatalf("encoded result not valid base64: %v", err)
	}
}

func TestServiceGenerateInvalidLength(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "test"})
	svc := New(store, nil)
	invalidLengths := []int{-1, 0, 2048}
	for _, length := range invalidLengths {
		if _, err := svc.Generate(context.Background(), acct.ID, length, ""); err == nil {
			t.Fatalf("expected error for length %d", length)
		}
	}
}

func TestService_WithSigningKey(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "test"})
	svc := New(store, nil, WithSigningKey(priv))
	res, err := svc.Generate(context.Background(), acct.ID, 16, "custom")
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if !svc.Verify(res) {
		t.Fatalf("signature should verify with provided key")
	}
	if string(res.PublicKey) != string(pub) {
		t.Fatalf("expected public key to match provided key")
	}
}

func TestServiceListHistory(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "hist"})
	svc := New(store, nil, WithHistoryLimit(2))
	for i := 0; i < 3; i++ {
		if _, err := svc.Generate(context.Background(), acct.ID, 8, fmt.Sprintf("req-%d", i)); err != nil {
			t.Fatalf("generate %d: %v", i, err)
		}
	}
	results, err := svc.List(context.Background(), acct.ID, 0)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	if results[0].RequestID != "req-2" || results[1].RequestID != "req-1" {
		t.Fatalf("expected newest-first order, got %+v", results)
	}
	limited, err := svc.List(context.Background(), acct.ID, 1)
	if err != nil {
		t.Fatalf("list limited: %v", err)
	}
	if len(limited) != 1 || limited[0].RequestID != "req-2" {
		t.Fatalf("expected latest item only, got %+v", limited)
	}
}

func ExampleService_Generate() {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "demo"})
	svc := New(store, nil)
	res, _ := svc.Generate(context.Background(), acct.ID, 4, "demo")
	fmt.Printf("bytes:%d encoded:%d\n", len(res.Value), len(EncodeResult(res)))
	// Output:
	// bytes:4 encoded:8
}

func TestService_Manifest(t *testing.T) {
	svc := New(nil, nil)
	m := svc.Manifest()
	if m.Name != "random" {
		t.Fatalf("expected name random, got %s", m.Name)
	}
}

func TestService_Descriptor(t *testing.T) {
	svc := New(nil, nil)
	d := svc.Descriptor()
	if d.Name != "random" {
		t.Fatalf("expected name random, got %s", d.Name)
	}
}

func TestService_Domain(t *testing.T) {
	svc := New(nil, nil)
	if svc.Domain() != "random" {
		t.Fatalf("expected domain random")
	}
}

func TestService_Lifecycle(t *testing.T) {
	svc := New(nil, nil)
	if err := svc.Start(context.Background()); err != nil {
		t.Fatalf("start: %v", err)
	}
	if err := svc.Ready(context.Background()); err != nil {
		t.Fatalf("ready: %v", err)
	}
	if err := svc.Stop(context.Background()); err != nil {
		t.Fatalf("stop: %v", err)
	}
	if svc.Ready(context.Background()) == nil {
		t.Fatalf("expected not ready after stop")
	}
}

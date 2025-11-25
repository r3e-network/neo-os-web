package cre

import (
	"context"
	"testing"

	"github.com/R3E-Network/service_layer/internal/app/domain/account"
	domaincre "github.com/R3E-Network/service_layer/internal/app/domain/cre"
	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
)

func TestService_CreatePlaybookAndList(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "neo"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}

	svc := New(store, store, nil)
	pb := domaincre.Playbook{
		AccountID: acct.ID,
		Name:      "Onboard",
		Steps: []domaincre.Step{
			{Type: domaincre.StepTypeFunctionCall, Name: "call-fn", Config: map[string]any{"function_id": "fn"}},
		},
	}
	created, err := svc.CreatePlaybook(context.Background(), pb)
	if err != nil {
		t.Fatalf("create playbook: %v", err)
	}
	if created.Name != "Onboard" {
		t.Fatalf("unexpected name: %s", created.Name)
	}

	list, err := svc.ListPlaybooks(context.Background(), acct.ID)
	if err != nil {
		t.Fatalf("list playbooks: %v", err)
	}
	if len(list) != 1 || list[0].ID != created.ID {
		t.Fatalf("expected one playbook in list")
	}

	fetched, err := svc.GetPlaybook(context.Background(), acct.ID, created.ID)
	if err != nil {
		t.Fatalf("get playbook: %v", err)
	}
	if fetched.AccountID != acct.ID {
		t.Fatalf("expected account ownership to be preserved")
	}
}

func TestService_CreatePlaybookValidation(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "neo"})
	svc := New(store, store, nil)
	_, err := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct.ID,
		Name:      "   ",
		Steps:     []domaincre.Step{},
	})
	if err == nil {
		t.Fatalf("expected validation to fail for missing name/steps")
	}
}

func TestService_CreateRunValidatesOwnership(t *testing.T) {
	store := memory.New()
	acct1, _ := store.CreateAccount(context.Background(), account.Account{Owner: "one"})
	acct2, _ := store.CreateAccount(context.Background(), account.Account{Owner: "two"})
	svc := New(store, store, nil)

	pb, err := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct1.ID,
		Name:      "Demo",
		Steps: []domaincre.Step{
			{Type: domaincre.StepTypeFunctionCall, Name: "step"},
		},
	})
	if err != nil {
		t.Fatalf("create playbook: %v", err)
	}

	if _, err := svc.CreateRun(context.Background(), acct2.ID, pb.ID, nil, nil, ""); err == nil {
		t.Fatalf("expected create run to fail when account does not own playbook")
	}
}

func TestService_CreateRunDispatchesRunner(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "owner"})
	svc := New(store, store, nil)
	var called bool
	svc.WithRunner(RunnerFunc(func(ctx context.Context, run domaincre.Run, pb domaincre.Playbook, exec *domaincre.Executor) error {
		called = true
		if run.PlaybookID != pb.ID {
			t.Fatalf("runner received mismatched ids")
		}
		if exec != nil {
			t.Fatalf("expected nil executor")
		}
		return nil
	}))

	pb, _ := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct.ID,
		Name:      "Demo",
		Steps: []domaincre.Step{
			{Type: domaincre.StepTypeFunctionCall, Name: "step"},
		},
	})

	if _, err := svc.CreateRun(context.Background(), acct.ID, pb.ID, map[string]any{"foo": "bar"}, []string{"A", "a"}, ""); err != nil {
		t.Fatalf("create run: %v", err)
	}
	if !called {
		t.Fatalf("expected runner to be invoked")
	}
	list, err := svc.ListRuns(context.Background(), acct.ID, 10)
	if err != nil {
		t.Fatalf("list runs: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected one run persisted")
	}
	if len(list[0].Tags) != 1 || list[0].Tags[0] != "a" {
		t.Fatalf("expected tags to be normalized")
	}
}

func TestService_CreateRunWithExecutorValidation(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "owner"})
	other, _ := store.CreateAccount(context.Background(), account.Account{Owner: "other"})
	svc := New(store, store, nil)

	pb, _ := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct.ID,
		Name:      "Demo",
		Steps:     []domaincre.Step{{Type: domaincre.StepTypeFunctionCall, Name: "step"}},
	})
	exec, _ := svc.CreateExecutor(context.Background(), domaincre.Executor{
		AccountID: acct.ID,
		Name:      "Exec",
		Type:      "http",
		Endpoint:  "https://exec",
	})
	if _, err := svc.CreateRun(context.Background(), acct.ID, pb.ID, nil, nil, exec.ID); err != nil {
		t.Fatalf("create run with executor: %v", err)
	}
	foreignExec, _ := svc.CreateExecutor(context.Background(), domaincre.Executor{
		AccountID: other.ID,
		Name:      "Exec2",
		Type:      "http",
		Endpoint:  "https://exec2",
	})
	var receivedExec string
	svc.WithRunner(RunnerFunc(func(ctx context.Context, run domaincre.Run, pb domaincre.Playbook, exec *domaincre.Executor) error {
		if exec != nil {
			receivedExec = exec.ID
		}
		return nil
	}))

	if _, err := svc.CreateRun(context.Background(), acct.ID, pb.ID, nil, nil, exec.ID); err != nil {
		t.Fatalf("create run with owned exec: %v", err)
	}
	if receivedExec != exec.ID {
		t.Fatalf("runner did not receive executor")
	}

	if _, err := svc.CreateRun(context.Background(), acct.ID, pb.ID, nil, nil, foreignExec.ID); err == nil {
		t.Fatalf("expected foreign executor to be rejected")
	}
}

func TestService_ExecutorCRUD(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)

	exec, err := svc.CreateExecutor(context.Background(), domaincre.Executor{
		AccountID: acct.ID,
		Name:      "Runner",
		Type:      "http",
		Endpoint:  "https://runner",
		Tags:      []string{"A", "a"},
	})
	if err != nil {
		t.Fatalf("create executor: %v", err)
	}
	list, err := svc.ListExecutors(context.Background(), acct.ID)
	if err != nil || len(list) != 1 {
		t.Fatalf("list executors: %v", err)
	}
	if list[0].Tags[0] != "a" {
		t.Fatalf("expected normalized tags")
	}
	updated, err := svc.UpdateExecutor(context.Background(), domaincre.Executor{
		ID:        exec.ID,
		AccountID: acct.ID,
		Name:      "Runner2",
		Type:      "HTTP",
		Endpoint:  "https://runner2",
	})
	if err != nil {
		t.Fatalf("update executor: %v", err)
	}
	if updated.Name != "Runner2" {
		t.Fatalf("expected updated name")
	}
}

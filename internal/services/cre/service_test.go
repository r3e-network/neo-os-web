package cre

import (
	"context"
	"testing"

	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
	"github.com/R3E-Network/service_layer/internal/domain/account"
	domaincre "github.com/R3E-Network/service_layer/internal/domain/cre"
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

func TestService_Lifecycle(t *testing.T) {
	svc := New(nil, nil, nil)
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

func TestService_Manifest(t *testing.T) {
	svc := New(nil, nil, nil)
	m := svc.Manifest()
	if m.Name != "cre" {
		t.Fatalf("expected name cre")
	}
	if m.Domain != "cre" {
		t.Fatalf("expected domain cre")
	}
}

func TestService_Domain(t *testing.T) {
	svc := New(nil, nil, nil)
	if svc.Domain() != "cre" {
		t.Fatalf("expected domain cre")
	}
}

func TestService_Descriptor(t *testing.T) {
	svc := New(nil, nil, nil)
	d := svc.Descriptor()
	if d.Name != "cre" {
		t.Fatalf("expected name cre")
	}
}

func TestService_UpdatePlaybook(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)
	pb, _ := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct.ID,
		Name:      "Demo",
		Steps:     []domaincre.Step{{Type: domaincre.StepTypeFunctionCall, Name: "step"}},
	})
	updated, err := svc.UpdatePlaybook(context.Background(), domaincre.Playbook{
		ID:        pb.ID,
		AccountID: acct.ID,
		Name:      "UpdatedDemo",
		Steps:     []domaincre.Step{{Type: domaincre.StepTypeFunctionCall, Name: "newstep"}},
	})
	if err != nil {
		t.Fatalf("update playbook: %v", err)
	}
	if updated.Name != "UpdatedDemo" {
		t.Fatalf("expected updated name")
	}
}

func TestService_UpdatePlaybook_WrongAccount(t *testing.T) {
	store := memory.New()
	acct1, _ := store.CreateAccount(context.Background(), account.Account{Owner: "one"})
	acct2, _ := store.CreateAccount(context.Background(), account.Account{Owner: "two"})
	svc := New(store, store, nil)
	pb, _ := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct1.ID,
		Name:      "Demo",
		Steps:     []domaincre.Step{{Type: domaincre.StepTypeFunctionCall, Name: "step"}},
	})
	_, err := svc.UpdatePlaybook(context.Background(), domaincre.Playbook{
		ID:        pb.ID,
		AccountID: acct2.ID,
		Name:      "Hacked",
		Steps:     []domaincre.Step{{Type: domaincre.StepTypeFunctionCall, Name: "step"}},
	})
	if err == nil {
		t.Fatalf("expected ownership error")
	}
}

func TestService_UpdatePlaybook_NotFound(t *testing.T) {
	store := memory.New()
	svc := New(store, store, nil)
	_, err := svc.UpdatePlaybook(context.Background(), domaincre.Playbook{
		ID: "nonexistent",
	})
	if err == nil {
		t.Fatalf("expected not found error")
	}
}

func TestService_GetRun(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)
	pb, _ := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct.ID,
		Name:      "Demo",
		Steps:     []domaincre.Step{{Type: domaincre.StepTypeFunctionCall, Name: "step"}},
	})
	run, _ := svc.CreateRun(context.Background(), acct.ID, pb.ID, nil, nil, "")
	got, err := svc.GetRun(context.Background(), acct.ID, run.ID)
	if err != nil {
		t.Fatalf("get run: %v", err)
	}
	if got.ID != run.ID {
		t.Fatalf("run mismatch")
	}
}

func TestService_GetRun_WrongAccount(t *testing.T) {
	store := memory.New()
	acct1, _ := store.CreateAccount(context.Background(), account.Account{Owner: "one"})
	acct2, _ := store.CreateAccount(context.Background(), account.Account{Owner: "two"})
	svc := New(store, store, nil)
	pb, _ := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct1.ID,
		Name:      "Demo",
		Steps:     []domaincre.Step{{Type: domaincre.StepTypeFunctionCall, Name: "step"}},
	})
	run, _ := svc.CreateRun(context.Background(), acct1.ID, pb.ID, nil, nil, "")
	_, err := svc.GetRun(context.Background(), acct2.ID, run.ID)
	if err == nil {
		t.Fatalf("expected ownership error")
	}
}

func TestService_GetExecutor(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)
	exec, _ := svc.CreateExecutor(context.Background(), domaincre.Executor{
		AccountID: acct.ID,
		Name:      "Exec",
		Type:      "http",
		Endpoint:  "https://exec",
	})
	got, err := svc.GetExecutor(context.Background(), acct.ID, exec.ID)
	if err != nil {
		t.Fatalf("get executor: %v", err)
	}
	if got.ID != exec.ID {
		t.Fatalf("executor mismatch")
	}
}

func TestService_GetExecutor_WrongAccount(t *testing.T) {
	store := memory.New()
	acct1, _ := store.CreateAccount(context.Background(), account.Account{Owner: "one"})
	acct2, _ := store.CreateAccount(context.Background(), account.Account{Owner: "two"})
	svc := New(store, store, nil)
	exec, _ := svc.CreateExecutor(context.Background(), domaincre.Executor{
		AccountID: acct1.ID,
		Name:      "Exec",
		Type:      "http",
		Endpoint:  "https://exec",
	})
	_, err := svc.GetExecutor(context.Background(), acct2.ID, exec.ID)
	if err == nil {
		t.Fatalf("expected ownership error")
	}
}

func TestService_GetPlaybook_WrongAccount(t *testing.T) {
	store := memory.New()
	acct1, _ := store.CreateAccount(context.Background(), account.Account{Owner: "one"})
	acct2, _ := store.CreateAccount(context.Background(), account.Account{Owner: "two"})
	svc := New(store, store, nil)
	pb, _ := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct1.ID,
		Name:      "Demo",
		Steps:     []domaincre.Step{{Type: domaincre.StepTypeFunctionCall, Name: "step"}},
	})
	_, err := svc.GetPlaybook(context.Background(), acct2.ID, pb.ID)
	if err == nil {
		t.Fatalf("expected ownership error")
	}
}

func TestService_ListPlaybooks_MissingAccount(t *testing.T) {
	store := memory.New()
	svc := New(store, store, nil)
	_, err := svc.ListPlaybooks(context.Background(), "nonexistent")
	if err == nil {
		t.Fatalf("expected error for nonexistent account")
	}
}

func TestService_ListRuns_MissingAccount(t *testing.T) {
	store := memory.New()
	svc := New(store, store, nil)
	_, err := svc.ListRuns(context.Background(), "nonexistent", 10)
	if err == nil {
		t.Fatalf("expected error for nonexistent account")
	}
}

func TestService_ListExecutors_MissingAccount(t *testing.T) {
	store := memory.New()
	svc := New(store, store, nil)
	_, err := svc.ListExecutors(context.Background(), "nonexistent")
	if err == nil {
		t.Fatalf("expected error for nonexistent account")
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

func TestService_CreateExecutor_Validation(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)

	// Missing name
	_, err := svc.CreateExecutor(context.Background(), domaincre.Executor{
		AccountID: acct.ID,
		Type:      "http",
		Endpoint:  "https://exec",
	})
	if err == nil {
		t.Fatalf("expected name required error")
	}

	// Missing endpoint
	_, err = svc.CreateExecutor(context.Background(), domaincre.Executor{
		AccountID: acct.ID,
		Name:      "Exec",
		Type:      "http",
	})
	if err == nil {
		t.Fatalf("expected endpoint required error")
	}

	// Empty type defaults to generic
	exec, err := svc.CreateExecutor(context.Background(), domaincre.Executor{
		AccountID: acct.ID,
		Name:      "Exec",
		Endpoint:  "https://exec",
	})
	if err != nil {
		t.Fatalf("create executor: %v", err)
	}
	if exec.Type != "generic" {
		t.Fatalf("expected default type generic, got %s", exec.Type)
	}
}

func TestService_UpdateExecutor_Validation(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	acct2, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct2"})
	svc := New(store, store, nil)

	exec, _ := svc.CreateExecutor(context.Background(), domaincre.Executor{
		AccountID: acct.ID,
		Name:      "Exec",
		Type:      "http",
		Endpoint:  "https://exec",
	})

	// Wrong account
	_, err := svc.UpdateExecutor(context.Background(), domaincre.Executor{
		ID:        exec.ID,
		AccountID: acct2.ID,
		Name:      "Hacked",
		Endpoint:  "https://hacked",
	})
	if err == nil {
		t.Fatalf("expected ownership error")
	}

	// Not found
	_, err = svc.UpdateExecutor(context.Background(), domaincre.Executor{
		ID:        "nonexistent",
		AccountID: acct.ID,
	})
	if err == nil {
		t.Fatalf("expected not found error")
	}
}

func TestService_StepValidation(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)

	// Invalid step type
	_, err := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct.ID,
		Name:      "Demo",
		Steps:     []domaincre.Step{{Type: "invalid", Name: "step"}},
	})
	if err == nil {
		t.Fatalf("expected invalid step type error")
	}

	// Missing step type
	_, err = svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct.ID,
		Name:      "Demo",
		Steps:     []domaincre.Step{{Name: "step"}},
	})
	if err == nil {
		t.Fatalf("expected step type required error")
	}

	// Step name empty - gets auto-named
	pb, err := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct.ID,
		Name:      "Demo",
		Steps:     []domaincre.Step{{Type: domaincre.StepTypeFunctionCall}},
	})
	if err != nil {
		t.Fatalf("create playbook: %v", err)
	}
	if pb.Steps[0].Name != "step-0" {
		t.Fatalf("expected auto-named step")
	}

	// Negative timeout corrected
	pb2, _ := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct.ID,
		Name:      "Demo2",
		Steps:     []domaincre.Step{{Type: domaincre.StepTypeFunctionCall, Name: "s", TimeoutSeconds: -10, RetryLimit: -5}},
	})
	if pb2.Steps[0].TimeoutSeconds != 0 || pb2.Steps[0].RetryLimit != 0 {
		t.Fatalf("expected negative values corrected")
	}

	// Multiple step types
	pb3, err := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: acct.ID,
		Name:      "Demo3",
		Steps: []domaincre.Step{
			{Type: domaincre.StepTypeAutomation, Name: "auto"},
			{Type: domaincre.StepTypeHTTPRequest, Name: "http"},
		},
	})
	if err != nil {
		t.Fatalf("create playbook: %v", err)
	}
	if len(pb3.Steps) != 2 {
		t.Fatalf("expected 2 steps")
	}
}

func TestService_CreateRun_MissingPlaybook(t *testing.T) {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "acct"})
	svc := New(store, store, nil)
	_, err := svc.CreateRun(context.Background(), acct.ID, "nonexistent", nil, nil, "")
	if err == nil {
		t.Fatalf("expected playbook not found error")
	}
}

func TestService_CreateExecutor_MissingAccount(t *testing.T) {
	store := memory.New()
	svc := New(store, store, nil)
	_, err := svc.CreateExecutor(context.Background(), domaincre.Executor{
		AccountID: "nonexistent",
		Name:      "Exec",
		Type:      "http",
		Endpoint:  "https://exec",
	})
	if err == nil {
		t.Fatalf("expected account error")
	}
}

func TestService_CreatePlaybook_MissingAccount(t *testing.T) {
	store := memory.New()
	svc := New(store, store, nil)
	_, err := svc.CreatePlaybook(context.Background(), domaincre.Playbook{
		AccountID: "nonexistent",
		Name:      "Demo",
		Steps:     []domaincre.Step{{Type: domaincre.StepTypeFunctionCall, Name: "step"}},
	})
	if err == nil {
		t.Fatalf("expected account error")
	}
}

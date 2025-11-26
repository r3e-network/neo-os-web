package automation

import (
	"context"
	"fmt"
	"io"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
	"github.com/R3E-Network/service_layer/internal/domain/account"
	"github.com/R3E-Network/service_layer/internal/domain/function"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

func TestService_CreateAndUpdateJob(t *testing.T) {
	store := memory.New()
	acct, err := store.CreateAccount(context.Background(), account.Account{Owner: "owner"})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	fn, err := store.CreateFunction(context.Background(), function.Definition{AccountID: acct.ID, Name: "fn", Source: "() => 1"})
	if err != nil {
		t.Fatalf("create function: %v", err)
	}

	svc := New(store, store, store, nil)
	job, err := svc.CreateJob(context.Background(), acct.ID, fn.ID, "hourly", "@every 1h", "desc")
	if err != nil {
		t.Fatalf("create job: %v", err)
	}
	if !job.Enabled {
		t.Fatalf("job should be enabled by default")
	}
	if job.NextRun.IsZero() || !job.NextRun.After(time.Now()) {
		t.Fatalf("expected next run to be set in the future, got %v", job.NextRun)
	}

	if _, err := svc.CreateJob(context.Background(), acct.ID, fn.ID, "hourly", "@hourly", "dup"); err == nil {
		t.Fatalf("expected duplicate name error")
	}

	if _, err := svc.CreateJob(context.Background(), acct.ID, fn.ID, "bad", "invalid spec", ""); err == nil {
		t.Fatalf("expected invalid schedule error")
	}

	newName := "nightly"
	newSchedule := "@every 2h"
	newDesc := "updated"
	next := time.Now().Add(24 * time.Hour)
	updated, err := svc.UpdateJob(context.Background(), job.ID, &newName, &newSchedule, &newDesc, &next)
	if err != nil {
		t.Fatalf("update job: %v", err)
	}
	if updated.Name != newName || updated.Schedule != newSchedule || updated.Description != newDesc {
		t.Fatalf("update not applied: %#v", updated)
	}
	if !updated.NextRun.Equal(next.UTC()) {
		t.Fatalf("next run mismatch: %v", updated.NextRun)
	}

	disabled, err := svc.SetEnabled(context.Background(), job.ID, false)
	if err != nil {
		t.Fatalf("set enabled: %v", err)
	}
	if disabled.Enabled {
		t.Fatalf("job should be disabled")
	}

	runTime := time.Now()
	recorded, err := svc.RecordExecution(context.Background(), job.ID, runTime)
	if err != nil {
		t.Fatalf("record execution: %v", err)
	}
	if !recorded.LastRun.Equal(runTime.UTC()) {
		t.Fatalf("last run not updated: %v", recorded.LastRun)
	}
	expectedNext := runTime.Add(2 * time.Hour).UTC()
	if !recorded.NextRun.Equal(expectedNext) {
		t.Fatalf("expected next run %v, got %v", expectedNext, recorded.NextRun)
	}

	list, err := svc.ListJobs(context.Background(), acct.ID)
	if err != nil {
		t.Fatalf("list jobs: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected one job, got %d", len(list))
	}
}

func ExampleService_CreateJob() {
	store := memory.New()
	acct, _ := store.CreateAccount(context.Background(), account.Account{Owner: "owner"})
	fn, _ := store.CreateFunction(context.Background(), function.Definition{AccountID: acct.ID, Name: "fn", Source: "() => 1"})
	log := logger.NewDefault("example-automation")
	log.SetOutput(io.Discard)
	svc := New(store, store, store, log)

	job, _ := svc.CreateJob(context.Background(), acct.ID, fn.ID, "daily-report", "@daily", "send summary email")
	fmt.Println(job.Name, job.Enabled)
	// Output:
	// daily-report true
}

func TestService_CreateJobRejectsForeignFunction(t *testing.T) {
	store := memory.New()
	acct1, err := store.CreateAccount(context.Background(), account.Account{Owner: "one"})
	if err != nil {
		t.Fatalf("create account1: %v", err)
	}
	acct2, err := store.CreateAccount(context.Background(), account.Account{Owner: "two"})
	if err != nil {
		t.Fatalf("create account2: %v", err)
	}
	fn, err := store.CreateFunction(context.Background(), function.Definition{AccountID: acct1.ID, Name: "fn", Source: "() => 1"})
	if err != nil {
		t.Fatalf("create function: %v", err)
	}

	svc := New(store, store, store, nil)
	if _, err := svc.CreateJob(context.Background(), acct2.ID, fn.ID, "job", "@hourly", "desc"); err == nil {
		t.Fatalf("expected create job to fail when function belongs to different account")
	}
}

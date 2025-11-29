package cre

import (
	"testing"
	"time"
)

func TestStepType(t *testing.T) {
	tests := []struct {
		stepType StepType
		want     string
	}{
		{StepTypeFunctionCall, "function_call"},
		{StepTypeAutomation, "automation_job"},
		{StepTypeHTTPRequest, "http_request"},
	}

	for _, tc := range tests {
		if string(tc.stepType) != tc.want {
			t.Errorf("StepType = %q, want %q", tc.stepType, tc.want)
		}
	}
}

func TestRunStatus(t *testing.T) {
	tests := []struct {
		status RunStatus
		want   string
	}{
		{RunStatusPending, "pending"},
		{RunStatusRunning, "running"},
		{RunStatusSucceeded, "succeeded"},
		{RunStatusFailed, "failed"},
		{RunStatusCanceled, "canceled"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("RunStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestStepFields(t *testing.T) {
	step := Step{
		Name:           "Call Function",
		Type:           StepTypeFunctionCall,
		Config:         map[string]any{"function_id": "fn-1"},
		TimeoutSeconds: 30,
		RetryLimit:     3,
		Metadata:       map[string]string{"priority": "high"},
		Tags:           []string{"critical"},
	}

	if step.Name != "Call Function" {
		t.Errorf("Name = %q, want 'Call Function'", step.Name)
	}
	if step.Type != StepTypeFunctionCall {
		t.Errorf("Type = %q, want 'function_call'", step.Type)
	}
	if step.TimeoutSeconds != 30 {
		t.Errorf("TimeoutSeconds = %d, want 30", step.TimeoutSeconds)
	}
}

func TestPlaybookFields(t *testing.T) {
	now := time.Now()
	playbook := Playbook{
		ID:          "pb-1",
		AccountID:   "acct-1",
		Name:        "Daily Report",
		Description: "Generates daily reports",
		Tags:        []string{"automation", "daily"},
		Steps: []Step{
			{Name: "Fetch Data", Type: StepTypeHTTPRequest},
			{Name: "Process", Type: StepTypeFunctionCall},
		},
		CreatedAt: now,
		UpdatedAt: now,
		Metadata:  map[string]string{"version": "1.0"},
	}

	if playbook.ID != "pb-1" {
		t.Errorf("ID = %q, want 'pb-1'", playbook.ID)
	}
	if len(playbook.Steps) != 2 {
		t.Errorf("Steps len = %d, want 2", len(playbook.Steps))
	}
}

func TestRunFields(t *testing.T) {
	now := time.Now()
	completedAt := now.Add(time.Minute)
	run := Run{
		ID:          "run-1",
		AccountID:   "acct-1",
		PlaybookID:  "pb-1",
		ExecutorID:  "exec-1",
		Status:      RunStatusSucceeded,
		Parameters:  map[string]any{"date": "2024-01-01"},
		Tags:        []string{"scheduled"},
		CreatedAt:   now,
		UpdatedAt:   now,
		CompletedAt: &completedAt,
		Results: []StepResult{
			{RunID: "run-1", StepIndex: 0, Status: RunStatusSucceeded},
		},
		Metadata: map[string]string{"trigger": "cron"},
	}

	if run.ID != "run-1" {
		t.Errorf("ID = %q, want 'run-1'", run.ID)
	}
	if run.Status != RunStatusSucceeded {
		t.Errorf("Status = %q, want 'succeeded'", run.Status)
	}
	if run.CompletedAt == nil {
		t.Error("CompletedAt should not be nil")
	}
	if len(run.Results) != 1 {
		t.Errorf("Results len = %d, want 1", len(run.Results))
	}
}

func TestStepResultFields(t *testing.T) {
	now := time.Now()
	completedAt := now.Add(10 * time.Second)
	result := StepResult{
		RunID:       "run-1",
		StepIndex:   0,
		Name:        "Fetch Data",
		Type:        StepTypeHTTPRequest,
		Status:      RunStatusSucceeded,
		Logs:        []string{"Starting...", "Done"},
		StartedAt:   now,
		CompletedAt: &completedAt,
		Metadata:    map[string]string{"response_code": "200"},
	}

	if result.RunID != "run-1" {
		t.Errorf("RunID = %q, want 'run-1'", result.RunID)
	}
	if result.Status != RunStatusSucceeded {
		t.Errorf("Status = %q, want 'succeeded'", result.Status)
	}
	if len(result.Logs) != 2 {
		t.Errorf("Logs len = %d, want 2", len(result.Logs))
	}
}

func TestExecutorFields(t *testing.T) {
	now := time.Now()
	executor := Executor{
		ID:        "exec-1",
		AccountID: "acct-1",
		Name:      "Primary Runner",
		Type:      "docker",
		Endpoint:  "http://runner:8080",
		Metadata:  map[string]string{"capacity": "high"},
		Tags:      []string{"production"},
		CreatedAt: now,
		UpdatedAt: now,
	}

	if executor.ID != "exec-1" {
		t.Errorf("ID = %q, want 'exec-1'", executor.ID)
	}
	if executor.Type != "docker" {
		t.Errorf("Type = %q, want 'docker'", executor.Type)
	}
	if executor.Endpoint == "" {
		t.Error("Endpoint should not be empty")
	}
}

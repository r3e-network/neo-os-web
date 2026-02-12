package transaction

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
)

var (
	ErrTransactionFailed     = errors.New("transaction failed")
	ErrTransactionRolledBack = errors.New("transaction was rolled back")
	ErrCompensationFailed    = errors.New("compensation action failed")
)

type CompensationFunc func(ctx context.Context) error

type Step struct {
	Name         string
	Action       func(ctx context.Context) error
	Compensation CompensationFunc
}

type Transaction struct {
	steps         []Step
	executedSteps int
	mu            sync.Mutex
}

func NewTransaction() *Transaction {
	return &Transaction{
		steps: make([]Step, 0),
	}
}

func (t *Transaction) AddStep(name string, action func(ctx context.Context) error, compensation CompensationFunc) *Transaction {
	t.steps = append(t.steps, Step{
		Name:         name,
		Action:       action,
		Compensation: compensation,
	})
	return t
}

func (t *Transaction) Execute(ctx context.Context) error {
	t.mu.Lock()
	t.executedSteps = 0
	t.mu.Unlock()

	var lastErr error

	for _, step := range t.steps {
		if err := step.Action(ctx); err != nil {
			lastErr = fmt.Errorf("%s: %w", step.Name, err)

			// Rollback all previously executed steps
			t.rollback(ctx, t.executedSteps)
			return fmt.Errorf("%w: %s", ErrTransactionFailed, lastErr)
		}

		t.mu.Lock()
		t.executedSteps++
		t.mu.Unlock()
	}

	return nil
}

func (t *Transaction) rollback(ctx context.Context, stepsExecuted int) {
	for i := stepsExecuted - 1; i >= 0; i-- {
		step := &t.steps[i]
		if step.Compensation != nil {
			if err := step.Compensation(ctx); err != nil {
				// Log compensation failure but continue with other compensations
				slog.Error("compensation failed", "step", step.Name, "error", err)
			}
		}
	}
}

func (t *Transaction) ExecuteAll(ctx context.Context) (int, error) {
	t.mu.Lock()
	t.executedSteps = 0
	t.mu.Unlock()

	executed := 0
	var lastErr error

	for _, step := range t.steps {
		if err := step.Action(ctx); err != nil {
			lastErr = fmt.Errorf("%s: %w", step.Name, err)
			t.rollback(ctx, executed)
			return executed, fmt.Errorf("%w: %s", ErrTransactionFailed, lastErr)
		}
		executed++
	}

	return executed, nil
}

type TwoPhaseCommit struct {
	mu        sync.RWMutex
	prepared  map[string]bool
	committed map[string]bool
}

type TwoPhaseResult struct {
	Success bool
	Phase   string
	Step    string
	Error   error
}

func NewTwoPhaseCommit() *TwoPhaseCommit {
	return &TwoPhaseCommit{
		prepared:  make(map[string]bool),
		committed: make(map[string]bool),
	}
}

type TwoPhaseStep struct {
	Name     string
	Prepare  func(ctx context.Context) error
	Commit   func(ctx context.Context) error
	Rollback func(ctx context.Context) error
}

func (t *TwoPhaseCommit) Execute(ctx context.Context, steps []TwoPhaseStep) error {
	t.mu.Lock()
	t.prepared = make(map[string]bool)
	t.committed = make(map[string]bool)
	t.mu.Unlock()

	// Phase 1: Prepare
	for _, step := range steps {
		if err := step.Prepare(ctx); err != nil {
			t.rollback(ctx, steps, "prepare")
			return fmt.Errorf("prepare failed for %s: %w", step.Name, err)
		}
		t.mu.Lock()
		t.prepared[step.Name] = true
		t.mu.Unlock()
	}

	// Phase 2: Commit
	for _, step := range steps {
		if err := step.Commit(ctx); err != nil {
			t.rollback(ctx, steps, "commit")
			return fmt.Errorf("commit failed for %s: %w", step.Name, err)
		}
		t.mu.Lock()
		t.committed[step.Name] = true
		t.mu.Unlock()
	}

	return nil
}

func (t *TwoPhaseCommit) rollback(ctx context.Context, steps []TwoPhaseStep, phase string) {
	for _, step := range steps {
		if step.Rollback == nil {
			continue
		}

		// Only rollback steps that were prepared in prepare phase
		// or committed in commit phase
		t.mu.RLock()
		shouldRollback := false
		if phase == "prepare" && t.prepared[step.Name] {
			shouldRollback = true
		}
		if phase == "commit" && (t.prepared[step.Name] || t.committed[step.Name]) {
			shouldRollback = true
		}
		t.mu.RUnlock()

		if shouldRollback {
			if err := step.Rollback(ctx); err != nil {
				slog.Error("rollback failed", "step", step.Name, "phase", phase, "error", err)
			}
		}
	}
}

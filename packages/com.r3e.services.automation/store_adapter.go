package automation

import (
	"context"

	domain "github.com/R3E-Network/service_layer/domain/automation"
	"github.com/R3E-Network/service_layer/pkg/storage"
)

// StoreAdapter bridges storage.AutomationStore with the local Store interface.
type StoreAdapter struct {
	store storage.AutomationStore
}

// NewStoreAdapter creates a new adapter wrapping the given storage.AutomationStore.
func NewStoreAdapter(store storage.AutomationStore) *StoreAdapter {
	return &StoreAdapter{store: store}
}

func (a *StoreAdapter) CreateAutomationJob(ctx context.Context, job Job) (Job, error) {
	result, err := a.store.CreateAutomationJob(ctx, toExternalJob(job))
	if err != nil {
		return Job{}, err
	}
	return fromExternalJob(result), nil
}

func (a *StoreAdapter) UpdateAutomationJob(ctx context.Context, job Job) (Job, error) {
	result, err := a.store.UpdateAutomationJob(ctx, toExternalJob(job))
	if err != nil {
		return Job{}, err
	}
	return fromExternalJob(result), nil
}

func (a *StoreAdapter) GetAutomationJob(ctx context.Context, id string) (Job, error) {
	result, err := a.store.GetAutomationJob(ctx, id)
	if err != nil {
		return Job{}, err
	}
	return fromExternalJob(result), nil
}

func (a *StoreAdapter) ListAutomationJobs(ctx context.Context, accountID string) ([]Job, error) {
	results, err := a.store.ListAutomationJobs(ctx, accountID)
	if err != nil {
		return nil, err
	}
	jobs := make([]Job, len(results))
	for i, r := range results {
		jobs[i] = fromExternalJob(r)
	}
	return jobs, nil
}

// toExternalJob converts local Job to domain.Job for storage layer.
func toExternalJob(j Job) domain.Job {
	return domain.Job{
		ID:          j.ID,
		AccountID:   j.AccountID,
		FunctionID:  j.FunctionID,
		Name:        j.Name,
		Description: j.Description,
		Schedule:    j.Schedule,
		Status:      domain.JobStatus(j.Status),
		Enabled:     j.Enabled,
		RunCount:    j.RunCount,
		MaxRuns:     j.MaxRuns,
		LastRun:     j.LastRun,
		NextRun:     j.NextRun,
		CreatedAt:   j.CreatedAt,
		UpdatedAt:   j.UpdatedAt,
	}
}

// fromExternalJob converts domain.Job to local Job.
func fromExternalJob(j domain.Job) Job {
	return Job{
		ID:          j.ID,
		AccountID:   j.AccountID,
		FunctionID:  j.FunctionID,
		Name:        j.Name,
		Description: j.Description,
		Schedule:    j.Schedule,
		Status:      JobStatus(j.Status),
		Enabled:     j.Enabled,
		RunCount:    j.RunCount,
		MaxRuns:     j.MaxRuns,
		LastRun:     j.LastRun,
		NextRun:     j.NextRun,
		CreatedAt:   j.CreatedAt,
		UpdatedAt:   j.UpdatedAt,
	}
}

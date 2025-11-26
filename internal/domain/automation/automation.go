package automation

import appauto "github.com/R3E-Network/service_layer/internal/app/domain/automation"

type (
	Job       = appauto.Job
	JobStatus = appauto.JobStatus
)

const (
	JobStatusActive    = appauto.JobStatusActive
	JobStatusCompleted = appauto.JobStatusCompleted
	JobStatusPaused    = appauto.JobStatusPaused
)

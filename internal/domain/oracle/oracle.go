package oracle

import apporacle "github.com/R3E-Network/service_layer/internal/app/domain/oracle"

type (
	DataSource    = apporacle.DataSource
	Request       = apporacle.Request
	RequestStatus = apporacle.RequestStatus
)

const (
	StatusPending   = apporacle.StatusPending
	StatusRunning   = apporacle.StatusRunning
	StatusSucceeded = apporacle.StatusSucceeded
	StatusFailed    = apporacle.StatusFailed
)

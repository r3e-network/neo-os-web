package datafeeds

import appdf "github.com/R3E-Network/service_layer/internal/app/domain/datafeeds"

type (
	Feed         = appdf.Feed
	Update       = appdf.Update
	UpdateStatus = appdf.UpdateStatus
)

const (
	UpdateStatusPending  = appdf.UpdateStatusPending
	UpdateStatusAccepted = appdf.UpdateStatusAccepted
	UpdateStatusRejected = appdf.UpdateStatusRejected
)

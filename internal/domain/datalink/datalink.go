package datalink

import appdl "github.com/R3E-Network/service_layer/internal/app/domain/datalink"

type (
	Channel        = appdl.Channel
	Delivery       = appdl.Delivery
	ChannelStatus  = appdl.ChannelStatus
	DeliveryStatus = appdl.DeliveryStatus
)

const (
	ChannelStatusInactive  = appdl.ChannelStatusInactive
	ChannelStatusActive    = appdl.ChannelStatusActive
	ChannelStatusSuspended = appdl.ChannelStatusSuspended

	DeliveryStatusPending    = appdl.DeliveryStatusPending
	DeliveryStatusDispatched = appdl.DeliveryStatusDispatched
	DeliveryStatusSucceeded  = appdl.DeliveryStatusSucceeded
	DeliveryStatusFailed     = appdl.DeliveryStatusFailed
)

package ccip

import appccip "github.com/R3E-Network/service_layer/internal/app/domain/ccip"

type (
	Lane          = appccip.Lane
	Message       = appccip.Message
	MessageStatus = appccip.MessageStatus
	TokenTransfer = appccip.TokenTransfer
)

const (
	MessageStatusPending     = appccip.MessageStatusPending
	MessageStatusDispatching = appccip.MessageStatusDispatching
	MessageStatusDelivered   = appccip.MessageStatusDelivered
	MessageStatusFailed      = appccip.MessageStatusFailed
)

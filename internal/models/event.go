package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// SubscriptionStatus represents the status of an event subscription
type SubscriptionStatus string

// Subscription statuses
const (
	SubscriptionStatusActive    SubscriptionStatus = "active"
	SubscriptionStatusPaused    SubscriptionStatus = "paused"
	SubscriptionStatusDeleted   SubscriptionStatus = "deleted"
	SubscriptionStatusError     SubscriptionStatus = "error"
)

// NotificationType represents the type of notification for an event subscription
type NotificationType string

// Notification types
const (
	NotificationTypeWebhook     NotificationType = "webhook"
	NotificationTypeEmail       NotificationType = "email"
	NotificationTypeInApp       NotificationType = "in-app"
	NotificationTypeAutomation  NotificationType = "automation"
)

// NotificationStatus represents the status of an event notification
type NotificationStatus string

// Notification statuses
const (
	NotificationStatusPending   NotificationStatus = "pending"
	NotificationStatusDelivered NotificationStatus = "delivered"
	NotificationStatusFailed    NotificationStatus = "failed"
	NotificationStatusRetrying  NotificationStatus = "retrying"
)

// EventSubscription represents a subscription to blockchain events
type EventSubscription struct {
	ID              uuid.UUID         `json:"id" db:"id"`
	UserID          int               `json:"userId" db:"user_id"`
	Name            string            `json:"name" db:"name"`
	Description     string            `json:"description" db:"description"`
	ContractAddress string            `json:"contractAddress" db:"contract_address"`
	EventName       string            `json:"eventName" db:"event_name"`
	Parameters      json.RawMessage   `json:"parameters" db:"parameters"`
	StartBlock      *int              `json:"startBlock" db:"start_block"`
	EndBlock        *int              `json:"endBlock" db:"end_block"`
	CallbackURL     string            `json:"callbackUrl" db:"callback_url"`
	NotificationType NotificationType  `json:"notificationType" db:"notification_type"`
	Status          SubscriptionStatus `json:"status" db:"status"`
	CreatedAt       time.Time         `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time         `json:"updatedAt" db:"updated_at"`
	LastTriggeredAt *time.Time        `json:"lastTriggeredAt" db:"last_triggered_at"`
	TriggerCount    int               `json:"triggerCount" db:"trigger_count"`
}

// NewEventSubscription creates a new event subscription
func NewEventSubscription(
	userID int,
	name string,
	description string,
	contractAddress string,
	eventName string,
	parameters json.RawMessage,
	startBlock *int,
	endBlock *int,
	callbackURL string,
	notificationType NotificationType,
) *EventSubscription {
	now := time.Now()
	return &EventSubscription{
		ID:              uuid.New(),
		UserID:          userID,
		Name:            name,
		Description:     description,
		ContractAddress: contractAddress,
		EventName:       eventName,
		Parameters:      parameters,
		StartBlock:      startBlock,
		EndBlock:        endBlock,
		CallbackURL:     callbackURL,
		NotificationType: notificationType,
		Status:          SubscriptionStatusActive,
		CreatedAt:       now,
		UpdatedAt:       now,
		TriggerCount:    0,
	}
}

// BlockchainEvent represents an event from the blockchain
type BlockchainEvent struct {
	ID              uuid.UUID       `json:"id" db:"id"`
	ContractAddress string          `json:"contractAddress" db:"contract_address"`
	EventName       string          `json:"eventName" db:"event_name"`
	Parameters      json.RawMessage `json:"parameters" db:"parameters"`
	TransactionHash string          `json:"transactionHash" db:"transaction_hash"`
	BlockNumber     int             `json:"blockNumber" db:"block_number"`
	BlockHash       string          `json:"blockHash" db:"block_hash"`
	Timestamp       time.Time       `json:"timestamp" db:"timestamp"`
	CreatedAt       time.Time       `json:"createdAt" db:"created_at"`
}

// NewBlockchainEvent creates a new blockchain event
func NewBlockchainEvent(
	contractAddress string,
	eventName string,
	parameters json.RawMessage,
	transactionHash string,
	blockNumber int,
	blockHash string,
	timestamp time.Time,
) *BlockchainEvent {
	return &BlockchainEvent{
		ID:              uuid.New(),
		ContractAddress: contractAddress,
		EventName:       eventName,
		Parameters:      parameters,
		TransactionHash: transactionHash,
		BlockNumber:     blockNumber,
		BlockHash:       blockHash,
		Timestamp:       timestamp,
		CreatedAt:       time.Now(),
	}
}

// EventNotification represents a notification for a blockchain event
type EventNotification struct {
	ID              uuid.UUID         `json:"id" db:"id"`
	SubscriptionID  uuid.UUID         `json:"subscriptionId" db:"subscription_id"`
	EventID         uuid.UUID         `json:"eventId" db:"event_id"`
	Status          NotificationStatus `json:"status" db:"status"`
	DeliveryAttempts int               `json:"deliveryAttempts" db:"delivery_attempts"`
	LastAttemptAt   *time.Time        `json:"lastAttemptAt" db:"last_attempt_at"`
	DeliveredAt     *time.Time        `json:"deliveredAt" db:"delivered_at"`
	Response        string            `json:"response" db:"response"`
	CreatedAt       time.Time         `json:"createdAt" db:"created_at"`
}

// NewEventNotification creates a new event notification
func NewEventNotification(subscriptionID, eventID uuid.UUID) *EventNotification {
	return &EventNotification{
		ID:              uuid.New(),
		SubscriptionID:  subscriptionID,
		EventID:         eventID,
		Status:          NotificationStatusPending,
		DeliveryAttempts: 0,
		CreatedAt:       time.Now(),
	}
}

// BlockProcessing represents the block processing state for a network
type BlockProcessing struct {
	ID              int       `json:"id" db:"id"`
	Network         string    `json:"network" db:"network"`
	LastProcessedBlock int    `json:"lastProcessedBlock" db:"last_processed_block"`
	IsProcessing    bool      `json:"isProcessing" db:"is_processing"`
	LastProcessedAt time.Time `json:"lastProcessedAt" db:"last_processed_at"`
	CreatedAt       time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time `json:"updatedAt" db:"updated_at"`
}

// EventSubscriptionRequest represents a request to create or update an event subscription
type EventSubscriptionRequest struct {
	Name            string                 `json:"name" validate:"required"`
	Description     string                 `json:"description"`
	ContractAddress string                 `json:"contractAddress"`
	EventName       string                 `json:"eventName"`
	Parameters      map[string]interface{} `json:"parameters"`
	StartBlock      *int                   `json:"startBlock"`
	EndBlock        *int                   `json:"endBlock"`
	CallbackURL     string                 `json:"callbackUrl"`
	NotificationType string                 `json:"notificationType" validate:"required,oneof=webhook email in-app automation"`
}

// EventSubscriptionResponse represents a response for an event subscription
type EventSubscriptionResponse struct {
	ID              string            `json:"id"`
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	ContractAddress string            `json:"contractAddress"`
	EventName       string            `json:"eventName"`
	Parameters      interface{}       `json:"parameters"`
	StartBlock      *int              `json:"startBlock"`
	EndBlock        *int              `json:"endBlock"`
	CallbackURL     string            `json:"callbackUrl"`
	NotificationType string            `json:"notificationType"`
	Status          string            `json:"status"`
	CreatedAt       time.Time         `json:"createdAt"`
	UpdatedAt       time.Time         `json:"updatedAt"`
	LastTriggeredAt *time.Time        `json:"lastTriggeredAt,omitempty"`
	TriggerCount    int               `json:"triggerCount"`
}

// BlockchainEventResponse represents a response for a blockchain event
type BlockchainEventResponse struct {
	ID              string      `json:"id"`
	ContractAddress string      `json:"contractAddress"`
	EventName       string      `json:"eventName"`
	Parameters      interface{} `json:"parameters"`
	TransactionHash string      `json:"transactionHash"`
	BlockNumber     int         `json:"blockNumber"`
	BlockHash       string      `json:"blockHash"`
	Timestamp       time.Time   `json:"timestamp"`
}

// ToResponse converts an event subscription to an event subscription response
func (s *EventSubscription) ToResponse() *EventSubscriptionResponse {
	var parameters interface{}
	if s.Parameters != nil {
		if err := json.Unmarshal(s.Parameters, &parameters); err != nil {
			parameters = string(s.Parameters)
		}
	}

	return &EventSubscriptionResponse{
		ID:              s.ID.String(),
		Name:            s.Name,
		Description:     s.Description,
		ContractAddress: s.ContractAddress,
		EventName:       s.EventName,
		Parameters:      parameters,
		StartBlock:      s.StartBlock,
		EndBlock:        s.EndBlock,
		CallbackURL:     s.CallbackURL,
		NotificationType: string(s.NotificationType),
		Status:          string(s.Status),
		CreatedAt:       s.CreatedAt,
		UpdatedAt:       s.UpdatedAt,
		LastTriggeredAt: s.LastTriggeredAt,
		TriggerCount:    s.TriggerCount,
	}
}

// ToResponse converts a blockchain event to a blockchain event response
func (e *BlockchainEvent) ToResponse() *BlockchainEventResponse {
	var parameters interface{}
	if e.Parameters != nil {
		if err := json.Unmarshal(e.Parameters, &parameters); err != nil {
			parameters = string(e.Parameters)
		}
	}

	return &BlockchainEventResponse{
		ID:              e.ID.String(),
		ContractAddress: e.ContractAddress,
		EventName:       e.EventName,
		Parameters:      parameters,
		TransactionHash: e.TransactionHash,
		BlockNumber:     e.BlockNumber,
		BlockHash:       e.BlockHash,
		Timestamp:       e.Timestamp,
	}
} 
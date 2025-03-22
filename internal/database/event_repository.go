package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// EventRepository provides access to event storage
type EventRepository struct {
	db *sqlx.DB
}

// NewEventRepository creates a new event repository
func NewEventRepository(db *sqlx.DB) *EventRepository {
	return &EventRepository{
		db: db,
	}
}

// CreateSubscription creates a new event subscription
func (r *EventRepository) CreateSubscription(ctx context.Context, subscription *models.EventSubscription) error {
	query := `
		INSERT INTO event_subscriptions (
			id, user_id, name, description, contract_address, event_name,
			parameters, start_block, end_block, callback_url, notification_type,
			status, created_at, updated_at, last_triggered_at, trigger_count
		) VALUES (
			:id, :user_id, :name, :description, :contract_address, :event_name,
			:parameters, :start_block, :end_block, :callback_url, :notification_type,
			:status, :created_at, :updated_at, :last_triggered_at, :trigger_count
		)
	`

	_, err := r.db.NamedExecContext(ctx, query, subscription)
	if err != nil {
		return fmt.Errorf("failed to create event subscription: %w", err)
	}

	return nil
}

// GetSubscriptionByID retrieves an event subscription by ID
func (r *EventRepository) GetSubscriptionByID(ctx context.Context, id uuid.UUID) (*models.EventSubscription, error) {
	query := `
		SELECT * FROM event_subscriptions
		WHERE id = $1
	`

	var subscription models.EventSubscription
	if err := r.db.GetContext(ctx, &subscription, query, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("event subscription not found: %w", err)
		}
		return nil, fmt.Errorf("failed to get event subscription: %w", err)
	}

	return &subscription, nil
}

// GetSubscriptionsByUserID retrieves event subscriptions by user ID
func (r *EventRepository) GetSubscriptionsByUserID(ctx context.Context, userID int) ([]*models.EventSubscription, error) {
	query := `
		SELECT * FROM event_subscriptions
		WHERE user_id = $1 AND status != 'deleted'
		ORDER BY created_at DESC
	`

	var subscriptions []*models.EventSubscription
	if err := r.db.SelectContext(ctx, &subscriptions, query, userID); err != nil {
		return nil, fmt.Errorf("failed to get event subscriptions: %w", err)
	}

	return subscriptions, nil
}

// GetActiveSubscriptions retrieves all active event subscriptions
func (r *EventRepository) GetActiveSubscriptions(ctx context.Context) ([]*models.EventSubscription, error) {
	query := `
		SELECT * FROM event_subscriptions
		WHERE status = 'active'
	`

	var subscriptions []*models.EventSubscription
	if err := r.db.SelectContext(ctx, &subscriptions, query); err != nil {
		return nil, fmt.Errorf("failed to get active subscriptions: %w", err)
	}

	return subscriptions, nil
}

// GetMatchingSubscriptions retrieves subscriptions matching event criteria
func (r *EventRepository) GetMatchingSubscriptions(
	ctx context.Context,
	contractAddress string,
	eventName string,
	blockNumber int,
) ([]*models.EventSubscription, error) {
	query := `
		SELECT * FROM event_subscriptions
		WHERE status = 'active'
		AND (contract_address = $1 OR contract_address IS NULL OR contract_address = '')
		AND (event_name = $2 OR event_name IS NULL OR event_name = '')
		AND (start_block IS NULL OR start_block <= $3)
		AND (end_block IS NULL OR end_block >= $3)
	`

	var subscriptions []*models.EventSubscription
	if err := r.db.SelectContext(ctx, &subscriptions, query, contractAddress, eventName, blockNumber); err != nil {
		return nil, fmt.Errorf("failed to get matching subscriptions: %w", err)
	}

	return subscriptions, nil
}

// UpdateSubscription updates an event subscription
func (r *EventRepository) UpdateSubscription(ctx context.Context, subscription *models.EventSubscription) error {
	query := `
		UPDATE event_subscriptions
		SET
			name = :name,
			description = :description,
			contract_address = :contract_address,
			event_name = :event_name,
			parameters = :parameters,
			start_block = :start_block,
			end_block = :end_block,
			callback_url = :callback_url,
			notification_type = :notification_type,
			status = :status,
			updated_at = :updated_at,
			last_triggered_at = :last_triggered_at,
			trigger_count = :trigger_count
		WHERE id = :id
	`

	subscription.UpdatedAt = time.Now()
	_, err := r.db.NamedExecContext(ctx, query, subscription)
	if err != nil {
		return fmt.Errorf("failed to update event subscription: %w", err)
	}

	return nil
}

// DeleteSubscription marks an event subscription as deleted
func (r *EventRepository) DeleteSubscription(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE event_subscriptions
		SET status = 'deleted', updated_at = $1
		WHERE id = $2
	`

	_, err := r.db.ExecContext(ctx, query, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to delete event subscription: %w", err)
	}

	return nil
}

// CreateEvent creates a new blockchain event
func (r *EventRepository) CreateEvent(ctx context.Context, event *models.BlockchainEvent) error {
	query := `
		INSERT INTO blockchain_events (
			id, contract_address, event_name, parameters, transaction_hash,
			block_number, block_hash, timestamp, created_at
		) VALUES (
			:id, :contract_address, :event_name, :parameters, :transaction_hash,
			:block_number, :block_hash, :timestamp, :created_at
		)
	`

	_, err := r.db.NamedExecContext(ctx, query, event)
	if err != nil {
		return fmt.Errorf("failed to create blockchain event: %w", err)
	}

	return nil
}

// GetEventByID retrieves a blockchain event by ID
func (r *EventRepository) GetEventByID(ctx context.Context, id uuid.UUID) (*models.BlockchainEvent, error) {
	query := `
		SELECT * FROM blockchain_events
		WHERE id = $1
	`

	var event models.BlockchainEvent
	if err := r.db.GetContext(ctx, &event, query, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("blockchain event not found: %w", err)
		}
		return nil, fmt.Errorf("failed to get blockchain event: %w", err)
	}

	return &event, nil
}

// GetEvents retrieves blockchain events based on filter criteria
func (r *EventRepository) GetEvents(
	ctx context.Context,
	contractAddress string,
	eventName string,
	fromBlock int,
	toBlock int,
	limit int,
	offset int,
) ([]*models.BlockchainEvent, error) {
	query := `
		SELECT * FROM blockchain_events
		WHERE ($1 = '' OR contract_address = $1)
		AND ($2 = '' OR event_name = $2)
		AND ($3 = 0 OR block_number >= $3)
		AND ($4 = 0 OR block_number <= $4)
		ORDER BY block_number DESC, timestamp DESC
		LIMIT $5 OFFSET $6
	`

	var events []*models.BlockchainEvent
	if err := r.db.SelectContext(ctx, &events, query, contractAddress, eventName, fromBlock, toBlock, limit, offset); err != nil {
		return nil, fmt.Errorf("failed to get blockchain events: %w", err)
	}

	return events, nil
}

// CountEvents counts blockchain events based on filter criteria
func (r *EventRepository) CountEvents(
	ctx context.Context,
	contractAddress string,
	eventName string,
	fromBlock int,
	toBlock int,
) (int, error) {
	query := `
		SELECT COUNT(*) FROM blockchain_events
		WHERE ($1 = '' OR contract_address = $1)
		AND ($2 = '' OR event_name = $2)
		AND ($3 = 0 OR block_number >= $3)
		AND ($4 = 0 OR block_number <= $4)
	`

	var count int
	if err := r.db.GetContext(ctx, &count, query, contractAddress, eventName, fromBlock, toBlock); err != nil {
		return 0, fmt.Errorf("failed to count blockchain events: %w", err)
	}

	return count, nil
}

// CreateNotification creates a new event notification
func (r *EventRepository) CreateNotification(ctx context.Context, notification *models.EventNotification) error {
	query := `
		INSERT INTO event_notifications (
			id, subscription_id, event_id, status, delivery_attempts,
			last_attempt_at, delivered_at, response, created_at
		) VALUES (
			:id, :subscription_id, :event_id, :status, :delivery_attempts,
			:last_attempt_at, :delivered_at, :response, :created_at
		)
	`

	_, err := r.db.NamedExecContext(ctx, query, notification)
	if err != nil {
		return fmt.Errorf("failed to create event notification: %w", err)
	}

	return nil
}

// UpdateNotification updates an event notification
func (r *EventRepository) UpdateNotification(ctx context.Context, notification *models.EventNotification) error {
	query := `
		UPDATE event_notifications
		SET
			status = :status,
			delivery_attempts = :delivery_attempts,
			last_attempt_at = :last_attempt_at,
			delivered_at = :delivered_at,
			response = :response
		WHERE id = :id
	`

	_, err := r.db.NamedExecContext(ctx, query, notification)
	if err != nil {
		return fmt.Errorf("failed to update event notification: %w", err)
	}

	return nil
}

// GetPendingNotifications retrieves pending event notifications
func (r *EventRepository) GetPendingNotifications(ctx context.Context, limit int) ([]*models.EventNotification, error) {
	query := `
		SELECT n.*, s.notification_type, s.callback_url
		FROM event_notifications n
		JOIN event_subscriptions s ON n.subscription_id = s.id
		WHERE n.status IN ('pending', 'retrying')
		ORDER BY n.created_at ASC
		LIMIT $1
	`

	var notifications []*models.EventNotification
	if err := r.db.SelectContext(ctx, &notifications, query, limit); err != nil {
		return nil, fmt.Errorf("failed to get pending notifications: %w", err)
	}

	return notifications, nil
}

// GetBlockProcessing retrieves the block processing state for a network
func (r *EventRepository) GetBlockProcessing(ctx context.Context, network string) (*models.BlockProcessing, error) {
	query := `
		SELECT * FROM block_processing
		WHERE network = $1
	`

	var blockProcessing models.BlockProcessing
	if err := r.db.GetContext(ctx, &blockProcessing, query, network); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("block processing not found for network %s: %w", network, err)
		}
		return nil, fmt.Errorf("failed to get block processing: %w", err)
	}

	return &blockProcessing, nil
}

// UpdateBlockProcessing updates the block processing state for a network
func (r *EventRepository) UpdateBlockProcessing(ctx context.Context, blockProcessing *models.BlockProcessing) error {
	query := `
		UPDATE block_processing
		SET
			last_processed_block = :last_processed_block,
			is_processing = :is_processing,
			last_processed_at = :last_processed_at,
			updated_at = :updated_at
		WHERE id = :id
	`

	blockProcessing.UpdatedAt = time.Now()
	_, err := r.db.NamedExecContext(ctx, query, blockProcessing)
	if err != nil {
		return fmt.Errorf("failed to update block processing: %w", err)
	}

	return nil
}

// ParametersToJSON converts parameters to JSON
func ParametersToJSON(parameters map[string]interface{}) (json.RawMessage, error) {
	if parameters == nil {
		return nil, nil
	}
	return json.Marshal(parameters)
}

// JSONToParameters converts JSON to parameters
func JSONToParameters(data json.RawMessage) (map[string]interface{}, error) {
	if len(data) == 0 {
		return nil, nil
	}
	var parameters map[string]interface{}
	if err := json.Unmarshal(data, &parameters); err != nil {
		return nil, err
	}
	return parameters, nil
}

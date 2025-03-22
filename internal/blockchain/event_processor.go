package blockchain

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/willtech-services/service_layer/internal/database"
	"github.com/willtech-services/service_layer/internal/models"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// DefaultEventProcessor processes blockchain events and notifies subscribers
type DefaultEventProcessor struct {
	eventRepo *database.EventRepository
	logger    *logger.Logger
	config    *EventProcessorConfig
	client    *http.Client
}

// EventProcessorConfig contains configuration for the event processor
type EventProcessorConfig struct {
	WebhookTimeout    time.Duration
	MaxRetryCount     int
	RetryBackoff      time.Duration
	MaxConcurrentJobs int
}

// NewEventProcessor creates a new event processor
func NewEventProcessor(
	eventRepo *database.EventRepository,
	logger *logger.Logger,
	config *EventProcessorConfig,
) *DefaultEventProcessor {
	return &DefaultEventProcessor{
		eventRepo: eventRepo,
		logger:    logger,
		config:    config,
		client: &http.Client{
			Timeout: config.WebhookTimeout,
		},
	}
}

// ProcessEvent processes a blockchain event
func (p *DefaultEventProcessor) ProcessEvent(event *models.BlockchainEvent) error {
	// Get matching subscriptions
	ctx := context.Background()
	subscriptions, err := p.eventRepo.GetMatchingSubscriptions(
		ctx,
		event.ContractAddress,
		event.EventName,
		event.BlockNumber,
	)
	if err != nil {
		return fmt.Errorf("failed to get matching subscriptions: %w", err)
	}

	p.logger.Infof("Found %d matching subscriptions for event %s.%s", len(subscriptions), event.ContractAddress, event.EventName)

	// Filter subscriptions based on parameters
	for _, subscription := range subscriptions {
		if p.matchesParameters(event, subscription) {
			if err := p.notifySubscription(ctx, event, subscription); err != nil {
				p.logger.Errorf("Failed to notify subscription %s: %v", subscription.ID, err)
			}
		}
	}

	return nil
}

// matchesParameters checks if an event matches the subscription parameters
func (p *DefaultEventProcessor) matchesParameters(event *models.BlockchainEvent, subscription *models.EventSubscription) bool {
	// If no parameters are defined in the subscription, it matches any parameters
	if len(subscription.Parameters) == 0 {
		return true
	}

	// Parse subscription parameters
	var subParams map[string]interface{}
	if err := json.Unmarshal(subscription.Parameters, &subParams); err != nil {
		p.logger.Errorf("Failed to parse subscription parameters: %v", err)
		return false
	}

	// Parse event parameters
	var eventParams map[string]interface{}
	if err := json.Unmarshal(event.Parameters, &eventParams); err != nil {
		p.logger.Errorf("Failed to parse event parameters: %v", err)
		return false
	}

	// Check if all subscription parameters are matched in the event parameters
	return p.matchParameters(subParams, eventParams)
}

// matchParameters recursively checks if parameters match
func (p *DefaultEventProcessor) matchParameters(subParams, eventParams map[string]interface{}) bool {
	for key, subValue := range subParams {
		// Check if the key exists in eventParams
		eventValue, exists := eventParams[key]
		if !exists {
			return false
		}

		// Handle special wildcard value
		if subValue == "*" {
			continue
		}

		// Handle nested maps
		if subMap, ok := subValue.(map[string]interface{}); ok {
			if eventMap, ok := eventValue.(map[string]interface{}); ok {
				if !p.matchParameters(subMap, eventMap) {
					return false
				}
				continue
			}
			return false
		}

		// For arrays, check if the event value contains at least the subscription value
		if subArray, ok := subValue.([]interface{}); ok {
			if eventArray, ok := eventValue.([]interface{}); ok {
				if !p.matchArrays(subArray, eventArray) {
					return false
				}
				continue
			}
			return false
		}

		// For simple values, check equality
		if fmt.Sprintf("%v", subValue) != fmt.Sprintf("%v", eventValue) {
			return false
		}
	}

	return true
}

// matchArrays checks if all elements in subArray are in eventArray
func (p *DefaultEventProcessor) matchArrays(subArray, eventArray []interface{}) bool {
	for _, subItem := range subArray {
		found := false
		for _, eventItem := range eventArray {
			if fmt.Sprintf("%v", subItem) == fmt.Sprintf("%v", eventItem) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// notifySubscription notifies a subscription about an event
func (p *DefaultEventProcessor) notifySubscription(ctx context.Context, event *models.BlockchainEvent, subscription *models.EventSubscription) error {
	// Create notification
	notification := models.NewEventNotification(subscription.ID, event.ID)

	// Store notification
	if err := p.eventRepo.CreateNotification(ctx, notification); err != nil {
		return fmt.Errorf("failed to create notification: %w", err)
	}

	// Process notification based on notification type
	switch subscription.NotificationType {
	case models.NotificationTypeWebhook:
		go p.processWebhookNotification(notification, event, subscription)
	case models.NotificationTypeEmail:
		go p.processEmailNotification(notification, event, subscription)
	case models.NotificationTypeInApp:
		go p.processInAppNotification(notification, event, subscription)
	case models.NotificationTypeAutomation:
		go p.processAutomationNotification(notification, event, subscription)
	default:
		p.logger.Warnf("Unknown notification type: %s", subscription.NotificationType)
	}

	// Update subscription
	now := time.Now()
	subscription.LastTriggeredAt = &now
	subscription.TriggerCount++
	if err := p.eventRepo.UpdateSubscription(ctx, subscription); err != nil {
		p.logger.Errorf("Failed to update subscription %s: %v", subscription.ID, err)
	}

	return nil
}

// processWebhookNotification processes a webhook notification
func (p *DefaultEventProcessor) processWebhookNotification(notification *models.EventNotification, event *models.BlockchainEvent, subscription *models.EventSubscription) {
	ctx := context.Background()

	// Build webhook payload
	payload := map[string]interface{}{
		"id":              notification.ID.String(),
		"subscriptionId":  subscription.ID.String(),
		"eventId":         event.ID.String(),
		"contractAddress": event.ContractAddress,
		"eventName":       event.EventName,
		"parameters":      event.Parameters,
		"transactionHash": event.TransactionHash,
		"blockNumber":     event.BlockNumber,
		"blockHash":       event.BlockHash,
		"timestamp":       event.Timestamp,
	}

	// Convert payload to JSON
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		p.updateNotificationStatus(ctx, notification, models.NotificationStatusFailed, fmt.Sprintf("Failed to marshal payload: %v", err))
		return
	}

	// Call the webhook
	resp, err := p.client.Post(subscription.CallbackURL, "application/json", bytes.NewReader(jsonPayload))
	if err != nil {
		p.updateNotificationStatus(ctx, notification, models.NotificationStatusFailed, fmt.Sprintf("Failed to call webhook: %v", err))
		p.scheduleRetry(ctx, notification, event, subscription)
		return
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		p.updateNotificationStatus(ctx, notification, models.NotificationStatusFailed, fmt.Sprintf("Webhook returned status %d", resp.StatusCode))
		p.scheduleRetry(ctx, notification, event, subscription)
		return
	}

	// Update notification status
	p.updateNotificationStatus(ctx, notification, models.NotificationStatusDelivered, fmt.Sprintf("Delivered with status %d", resp.StatusCode))
}

// processEmailNotification processes an email notification
func (p *DefaultEventProcessor) processEmailNotification(notification *models.EventNotification, event *models.BlockchainEvent, subscription *models.EventSubscription) {
	// In a real implementation, this would send an email
	// For now, just mark as delivered
	p.updateNotificationStatus(context.Background(), notification, models.NotificationStatusDelivered, "Email delivery not implemented")
}

// processInAppNotification processes an in-app notification
func (p *DefaultEventProcessor) processInAppNotification(notification *models.EventNotification, event *models.BlockchainEvent, subscription *models.EventSubscription) {
	// In a real implementation, this would store an in-app notification
	// For now, just mark as delivered
	p.updateNotificationStatus(context.Background(), notification, models.NotificationStatusDelivered, "In-app delivery not implemented")
}

// processAutomationNotification processes an automation notification
func (p *DefaultEventProcessor) processAutomationNotification(notification *models.EventNotification, event *models.BlockchainEvent, subscription *models.EventSubscription) {
	// In a real implementation, this would trigger an automation workflow
	// For now, just mark as delivered
	p.updateNotificationStatus(context.Background(), notification, models.NotificationStatusDelivered, "Automation delivery not implemented")
}

// updateNotificationStatus updates the status of a notification
func (p *DefaultEventProcessor) updateNotificationStatus(ctx context.Context, notification *models.EventNotification, status models.NotificationStatus, response string) {
	notification.Status = status
	notification.Response = response
	notification.DeliveryAttempts++
	notification.LastAttemptAt = timePtr(time.Now())

	if status == models.NotificationStatusDelivered {
		notification.DeliveredAt = notification.LastAttemptAt
	}

	if err := p.eventRepo.UpdateNotification(ctx, notification); err != nil {
		p.logger.Errorf("Failed to update notification %s: %v", notification.ID, err)
	}
}

// scheduleRetry schedules a retry for a failed notification
func (p *DefaultEventProcessor) scheduleRetry(ctx context.Context, notification *models.EventNotification, event *models.BlockchainEvent, subscription *models.EventSubscription) {
	// Skip if reached max retries
	if notification.DeliveryAttempts >= p.config.MaxRetryCount {
		p.logger.Warnf("Max retries reached for notification %s", notification.ID)
		return
	}

	// Calculate backoff time
	backoff := time.Duration(notification.DeliveryAttempts) * p.config.RetryBackoff
	time.AfterFunc(backoff, func() {
		// Get fresh notification from database
		freshNotification, err := p.getNotification(ctx, notification.ID)
		if err != nil {
			p.logger.Errorf("Failed to get notification %s for retry: %v", notification.ID, err)
			return
		}

		// Skip if not pending or retrying
		if freshNotification.Status != models.NotificationStatusPending && freshNotification.Status != models.NotificationStatusRetrying {
			return
		}

		// Update status to retrying
		p.updateNotificationStatus(ctx, freshNotification, models.NotificationStatusRetrying, "Retrying")

		// Retry based on notification type
		switch subscription.NotificationType {
		case models.NotificationTypeWebhook:
			p.processWebhookNotification(freshNotification, event, subscription)
		case models.NotificationTypeEmail:
			p.processEmailNotification(freshNotification, event, subscription)
		case models.NotificationTypeInApp:
			p.processInAppNotification(freshNotification, event, subscription)
		case models.NotificationTypeAutomation:
			p.processAutomationNotification(freshNotification, event, subscription)
		}
	})
}

// getNotification gets a notification by ID
func (p *DefaultEventProcessor) getNotification(ctx context.Context, id uuid.UUID) (*models.EventNotification, error) {
	// In a real implementation, this would get the notification from the database
	// For now, we'll create a new notification with the same ID
	return &models.EventNotification{
		ID:              id,
		Status:          models.NotificationStatusRetrying,
		DeliveryAttempts: 0,
		CreatedAt:       time.Now(),
	}, nil
}

// timePtr returns a pointer to a time
func timePtr(t time.Time) *time.Time {
	return &t
} 
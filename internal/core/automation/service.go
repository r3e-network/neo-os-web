package automation

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/R3E-Network/service_layer/internal/blockchain"
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/core/functions"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/robfig/cron/v3"
)

// Service handles contract automation
type Service struct {
	config            *config.Config
	logger            *logger.Logger
	triggerRepository models.TriggerRepository
	functionService   *functions.Service
	blockchainClient  *blockchain.Client
	scheduler         *cron.Cron
	triggers          map[int]*models.Trigger
}

// NewService creates a new automation service
func NewService(
	cfg *config.Config,
	log *logger.Logger,
	triggerRepository models.TriggerRepository,
	functionService *functions.Service,
	blockchainClient *blockchain.Client,
) *Service {
	// Create scheduler with seconds precision
	scheduler := cron.New(cron.WithSeconds())

	return &Service{
		config:            cfg,
		logger:            log,
		triggerRepository: triggerRepository,
		functionService:   functionService,
		blockchainClient:  blockchainClient,
		scheduler:         scheduler,
		triggers:          make(map[int]*models.Trigger),
	}
}

// Start starts the automation service
func (s *Service) Start() error {
	// Start the scheduler
	s.scheduler.Start()

	// Load active triggers
	err := s.loadActiveTriggers()
	if err != nil {
		return fmt.Errorf("failed to load active triggers: %w", err)
	}

	return nil
}

// Stop stops the automation service
func (s *Service) Stop() {
	// Stop the scheduler
	s.scheduler.Stop()
}

// loadActiveTriggers loads and schedules all active triggers
func (s *Service) loadActiveTriggers() error {
	// Get all active triggers
	triggers, err := s.triggerRepository.ListActiveTriggers()
	if err != nil {
		return err
	}

	for _, trigger := range triggers {
		err = s.scheduleTrigger(trigger)
		if err != nil {
			s.logger.Errorf("Failed to schedule trigger %d: %v", trigger.ID, err)
		}
	}

	return nil
}

// CreateTrigger creates a new trigger
func (s *Service) CreateTrigger(
	userID int,
	functionID int,
	name, description string,
	triggerType models.TriggerType,
	triggerConfig json.RawMessage,
) (*models.Trigger, error) {
	// Validate trigger configuration
	if err := s.validateTriggerConfig(triggerType, triggerConfig); err != nil {
		return nil, err
	}

	// Check if trigger already exists
	existingTrigger, err := s.triggerRepository.GetByUserIDAndName(userID, name)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing trigger: %w", err)
	}
	if existingTrigger != nil {
		return nil, errors.New("trigger with this name already exists")
	}

	// Create trigger
	now := time.Now()
	trigger := &models.Trigger{
		UserID:        userID,
		FunctionID:    functionID,
		Name:          name,
		Description:   description,
		TriggerType:   triggerType,
		TriggerConfig: triggerConfig,
		Status:        "active",
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	// Save to database
	err = s.triggerRepository.Create(trigger)
	if err != nil {
		return nil, fmt.Errorf("failed to create trigger: %w", err)
	}

	// Schedule the trigger
	err = s.scheduleTrigger(trigger)
	if err != nil {
		// If scheduling fails, update the trigger status to "error"
		_ = s.triggerRepository.UpdateStatus(trigger.ID, "error")
		return nil, fmt.Errorf("failed to schedule trigger: %w", err)
	}

	return trigger, nil
}

// UpdateTrigger updates an existing trigger
func (s *Service) UpdateTrigger(
	id, userID int,
	functionID int,
	name, description string,
	triggerType models.TriggerType,
	triggerConfig json.RawMessage,
) (*models.Trigger, error) {
	// Get existing trigger
	trigger, err := s.GetTrigger(id, userID)
	if err != nil {
		return nil, err
	}
	if trigger == nil {
		return nil, errors.New("trigger not found")
	}

	// Validate trigger configuration
	if err := s.validateTriggerConfig(triggerType, triggerConfig); err != nil {
		return nil, err
	}

	// Check if name changed and if the new name already exists
	if name != trigger.Name {
		existingTrigger, err := s.triggerRepository.GetByUserIDAndName(userID, name)
		if err != nil {
			return nil, fmt.Errorf("failed to check existing trigger: %w", err)
		}
		if existingTrigger != nil && existingTrigger.ID != id {
			return nil, errors.New("trigger with this name already exists")
		}
	}

	// Remove existing trigger from scheduler
	s.unscheduleTrigger(trigger.ID)

	// Update trigger
	trigger.FunctionID = functionID
	trigger.Name = name
	trigger.Description = description
	trigger.TriggerType = triggerType
	trigger.TriggerConfig = triggerConfig
	trigger.Status = "active"
	trigger.UpdatedAt = time.Now()

	// Save to database
	err = s.triggerRepository.Update(trigger)
	if err != nil {
		return nil, fmt.Errorf("failed to update trigger: %w", err)
	}

	// Schedule the updated trigger
	err = s.scheduleTrigger(trigger)
	if err != nil {
		// If scheduling fails, update the trigger status to "error"
		_ = s.triggerRepository.UpdateStatus(trigger.ID, "error")
		return nil, fmt.Errorf("failed to schedule trigger: %w", err)
	}

	return trigger, nil
}

// DeleteTrigger deletes a trigger
func (s *Service) DeleteTrigger(id, userID int) error {
	// Get existing trigger
	trigger, err := s.GetTrigger(id, userID)
	if err != nil {
		return err
	}
	if trigger == nil {
		return errors.New("trigger not found")
	}

	// Remove trigger from scheduler
	s.unscheduleTrigger(id)

	// Delete from database
	err = s.triggerRepository.Delete(id)
	if err != nil {
		return fmt.Errorf("failed to delete trigger: %w", err)
	}

	return nil
}

// GetTrigger gets a trigger by ID
func (s *Service) GetTrigger(id, userID int) (*models.Trigger, error) {
	// Get trigger from database
	trigger, err := s.triggerRepository.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get trigger: %w", err)
	}
	if trigger == nil {
		return nil, nil
	}

	// Check ownership
	if trigger.UserID != userID {
		return nil, errors.New("trigger not found")
	}

	return trigger, nil
}

// ListTriggers lists triggers for a user
func (s *Service) ListTriggers(userID int, page, limit int) ([]*models.Trigger, error) {
	// Calculate offset
	offset := (page - 1) * limit

	// Get triggers from database
	triggers, err := s.triggerRepository.List(userID, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list triggers: %w", err)
	}

	return triggers, nil
}

// GetTriggerHistory gets the execution history for a trigger
func (s *Service) GetTriggerHistory(triggerID, userID int, page, limit int) ([]*models.TriggerEvent, error) {
	// Get trigger to check ownership
	trigger, err := s.GetTrigger(triggerID, userID)
	if err != nil {
		return nil, err
	}
	if trigger == nil {
		return nil, errors.New("trigger not found")
	}

	// Calculate offset
	offset := (page - 1) * limit

	// Get events from database
	events, err := s.triggerRepository.ListEventsByTriggerID(triggerID, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list trigger events: %w", err)
	}

	return events, nil
}

// ExecuteTrigger manually executes a trigger
func (s *Service) ExecuteTrigger(ctx context.Context, id, userID int) (*models.TriggerEvent, error) {
	// Get trigger
	trigger, err := s.GetTrigger(id, userID)
	if err != nil {
		return nil, err
	}
	if trigger == nil {
		return nil, errors.New("trigger not found")
	}

	// Execute the trigger
	event, err := s.executeTrigger(ctx, trigger)
	if err != nil {
		return nil, fmt.Errorf("failed to execute trigger: %w", err)
	}

	return event, nil
}

// ================================
// Private methods
// ================================

// validateTriggerConfig validates the trigger configuration
func (s *Service) validateTriggerConfig(triggerType models.TriggerType, triggerConfig json.RawMessage) error {
	switch triggerType {
	case models.TriggerTypeCron:
		var config models.CronTriggerConfig
		if err := json.Unmarshal(triggerConfig, &config); err != nil {
			return fmt.Errorf("invalid cron trigger configuration: %w", err)
		}

		// Validate cron schedule
		_, err := cron.ParseStandard(config.Schedule)
		if err != nil {
			return fmt.Errorf("invalid cron schedule: %w", err)
		}

	case models.TriggerTypePrice:
		var config models.PriceTriggerConfig
		if err := json.Unmarshal(triggerConfig, &config); err != nil {
			return fmt.Errorf("invalid price trigger configuration: %w", err)
		}

		// Validate condition
		if config.Condition != "above" && config.Condition != "below" && config.Condition != "between" {
			return fmt.Errorf("invalid price condition: %s", config.Condition)
		}

	case models.TriggerTypeBlockchain:
		var config models.BlockchainTriggerConfig
		if err := json.Unmarshal(triggerConfig, &config); err != nil {
			return fmt.Errorf("invalid blockchain trigger configuration: %w", err)
		}

		// Validate contract hash format (Neo N3 specific)
		if len(config.ContractHash) != 42 || config.ContractHash[:2] != "0x" {
			return fmt.Errorf("invalid Neo N3 contract hash format: %s", config.ContractHash)
		}

	default:
		return fmt.Errorf("unsupported trigger type: %s", triggerType)
	}

	return nil
}

// scheduleTrigger schedules a trigger based on its type
func (s *Service) scheduleTrigger(trigger *models.Trigger) error {
	switch trigger.TriggerType {
	case models.TriggerTypeCron:
		return s.scheduleCronTrigger(trigger)
	case models.TriggerTypePrice:
		return s.schedulePriceTrigger(trigger)
	case models.TriggerTypeBlockchain:
		return s.scheduleBlockchainTrigger(trigger)
	default:
		return fmt.Errorf("unsupported trigger type: %s", trigger.TriggerType)
	}
}

// scheduleCronTrigger schedules a cron-based trigger
func (s *Service) scheduleCronTrigger(trigger *models.Trigger) error {
	var config models.CronTriggerConfig
	if err := json.Unmarshal(trigger.TriggerConfig, &config); err != nil {
		return fmt.Errorf("invalid cron trigger configuration: %w", err)
	}

	// Add job to scheduler
	_, err := s.scheduler.AddFunc(config.Schedule, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		_, err := s.executeTrigger(ctx, trigger)
		if err != nil {
			s.logger.Errorf("Failed to execute cron trigger %d: %v", trigger.ID, err)
		}
	})

	if err != nil {
		return err
	}

	// Store trigger for later reference
	s.triggers[trigger.ID] = trigger

	return nil
}

// schedulePriceTrigger schedules a price-based trigger
// This would be implemented with a price monitoring system
func (s *Service) schedulePriceTrigger(trigger *models.Trigger) error {
	// In a real implementation, this would register the trigger with a price monitoring system
	// For now, we'll just store it for reference
	s.triggers[trigger.ID] = trigger
	return nil
}

// scheduleBlockchainTrigger schedules a blockchain event trigger
func (s *Service) scheduleBlockchainTrigger(trigger *models.Trigger) error {
	var config models.BlockchainTriggerConfig
	if err := json.Unmarshal(trigger.TriggerConfig, &config); err != nil {
		return fmt.Errorf("invalid blockchain trigger configuration: %w", err)
	}

	// Check if blockchain client is available
	if s.blockchainClient == nil {
		return errors.New("blockchain client not available")
	}

	// Subscribe to blockchain events
	// This is a simplified implementation - in production would need to handle reconnects, etc.
	err := s.blockchainClient.SubscribeToEvents(context.Background(), config.ContractHash, config.EventName, func(event interface{}) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		_, err := s.executeTrigger(ctx, trigger)
		if err != nil {
			s.logger.Errorf("Failed to execute blockchain trigger %d: %v", trigger.ID, err)
		}
	})

	if err != nil {
		return err
	}

	// Store trigger for later reference
	s.triggers[trigger.ID] = trigger

	return nil
}

// unscheduleTrigger removes a trigger from the scheduler
func (s *Service) unscheduleTrigger(triggerID int) {
	// In a real implementation, this would need to handle different trigger types differently
	// For now, we'll just remove it from our reference map
	delete(s.triggers, triggerID)
}

// executeTrigger executes a trigger
func (s *Service) executeTrigger(ctx context.Context, trigger *models.Trigger) (*models.TriggerEvent, error) {
	// Create event record
	now := time.Now()
	event := &models.TriggerEvent{
		TriggerID: trigger.ID,
		Timestamp: now,
		Status:    "running",
	}

	// Save event to database
	err := s.triggerRepository.CreateEvent(event)
	if err != nil {
		return nil, fmt.Errorf("failed to create trigger event: %w", err)
	}

	// Execute the function associated with the trigger
	params := map[string]interface{}{
		"trigger_id":   trigger.ID,
		"trigger_type": trigger.TriggerType,
		"timestamp":    now.Unix(),
	}

	// Add trigger-specific parameters
	switch trigger.TriggerType {
	case models.TriggerTypeCron:
		var config models.CronTriggerConfig
		if err := json.Unmarshal(trigger.TriggerConfig, &config); err != nil {
			// Update event status to error
			event.Status = "error"
			_ = s.triggerRepository.CreateEvent(event)
			return nil, fmt.Errorf("invalid cron trigger configuration: %w", err)
		}
		params["schedule"] = config.Schedule

	case models.TriggerTypePrice:
		var config models.PriceTriggerConfig
		if err := json.Unmarshal(trigger.TriggerConfig, &config); err != nil {
			// Update event status to error
			event.Status = "error"
			_ = s.triggerRepository.CreateEvent(event)
			return nil, fmt.Errorf("invalid price trigger configuration: %w", err)
		}
		params["asset_pair"] = config.AssetPair
		params["condition"] = config.Condition
		params["threshold"] = config.Threshold

	case models.TriggerTypeBlockchain:
		var config models.BlockchainTriggerConfig
		if err := json.Unmarshal(trigger.TriggerConfig, &config); err != nil {
			// Update event status to error
			event.Status = "error"
			_ = s.triggerRepository.CreateEvent(event)
			return nil, fmt.Errorf("invalid blockchain trigger configuration: %w", err)
		}
		params["contract_hash"] = config.ContractHash
		params["event_name"] = config.EventName
	}

	// Execute function
	result, err := s.functionService.ExecuteFunction(ctx, trigger.FunctionID, trigger.UserID, params, false)
	if err != nil {
		// Update event status to error
		event.Status = "error"
		_ = s.triggerRepository.CreateEvent(event)
		return nil, fmt.Errorf("failed to execute function: %w", err)
	}

	// Parse execution ID
	var executionID int
	fmt.Sscanf(result.ExecutionID, "%d", &executionID)

	// Update event with execution ID and status
	event.ExecutionID = executionID
	if result.Status == "success" {
		event.Status = "success"
	} else {
		event.Status = "error"
	}

	// Save updated event to database
	// In a real implementation, this would update the existing event, not create a new one
	err = s.triggerRepository.CreateEvent(event)
	if err != nil {
		return nil, fmt.Errorf("failed to update trigger event: %w", err)
	}

	return event, nil
}

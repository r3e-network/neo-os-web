package blockchain

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/core/block"
	"github.com/nspcc-dev/neo-go/pkg/core/state"
	"github.com/nspcc-dev/neo-go/pkg/core/transaction"
	"github.com/willtech-services/service_layer/internal/database"
	"github.com/willtech-services/service_layer/internal/models"
	"github.com/willtech-services/service_layer/pkg/logger"
)

// EventProcessor processes blockchain events and notifies subscribers
type EventProcessor interface {
	ProcessEvent(event *models.BlockchainEvent) error
}

// EventMonitor continuously monitors the blockchain for events
type EventMonitor struct {
	client         *Client
	eventRepo      *database.EventRepository
	eventProcessor EventProcessor
	logger         *logger.Logger
	config         *EventMonitorConfig
	network        string
	syncInterval   time.Duration
	stopCh         chan struct{}
	wg             sync.WaitGroup
	running        bool
	mu             sync.Mutex
}

// EventMonitorConfig contains configuration for the event monitor
type EventMonitorConfig struct {
	Network          string
	SyncInterval     time.Duration
	BatchSize        int
	ReorgThreshold   int
	MaxRetries       int
	RetryInterval    time.Duration
	StartBlockOffset int
}

// NewEventMonitor creates a new event monitor
func NewEventMonitor(
	client *Client,
	eventRepo *database.EventRepository,
	eventProcessor EventProcessor,
	logger *logger.Logger,
	config *EventMonitorConfig,
) *EventMonitor {
	return &EventMonitor{
		client:         client,
		eventRepo:      eventRepo,
		eventProcessor: eventProcessor,
		logger:         logger,
		config:         config,
		network:        config.Network,
		syncInterval:   config.SyncInterval,
		stopCh:         make(chan struct{}),
	}
}

// Start starts the event monitor
func (m *EventMonitor) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running {
		return nil
	}

	m.logger.Infof("Starting event monitor for network %s", m.network)
	m.running = true
	m.stopCh = make(chan struct{})

	// Start the main monitoring goroutine
	m.wg.Add(1)
	go m.monitorBlocks()

	return nil
}

// Stop stops the event monitor
func (m *EventMonitor) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.running {
		return nil
	}

	m.logger.Infof("Stopping event monitor for network %s", m.network)
	close(m.stopCh)
	m.wg.Wait()
	m.running = false

	return nil
}

// monitorBlocks continuously monitors new blocks for events
func (m *EventMonitor) monitorBlocks() {
	defer m.wg.Done()

	ticker := time.NewTicker(m.syncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-m.stopCh:
			return
		case <-ticker.C:
			if err := m.syncBlocks(); err != nil {
				m.logger.Errorf("Failed to sync blocks: %v", err)
			}
		}
	}
}

// syncBlocks syncs blocks with the database
func (m *EventMonitor) syncBlocks() error {
	ctx, cancel := context.WithTimeout(context.Background(), m.syncInterval)
	defer cancel()

	// Get current block processing state
	blockProcessing, err := m.eventRepo.GetBlockProcessing(ctx, m.network)
	if err != nil {
		return fmt.Errorf("failed to get block processing state: %w", err)
	}

	// Check if already processing
	if blockProcessing.IsProcessing {
		m.logger.Warnf("Block processing already in progress for network %s", m.network)
		return nil
	}

	// Update block processing state
	blockProcessing.IsProcessing = true
	if err := m.eventRepo.UpdateBlockProcessing(ctx, blockProcessing); err != nil {
		return fmt.Errorf("failed to update block processing state: %w", err)
	}

	// Get the current block height from the blockchain
	currentHeight, err := m.client.GetBlockHeight()
	if err != nil {
		// Update block processing state
		blockProcessing.IsProcessing = false
		_ = m.eventRepo.UpdateBlockProcessing(ctx, blockProcessing)
		return fmt.Errorf("failed to get current block height: %w", err)
	}

	// Determine the starting block
	startBlock := blockProcessing.LastProcessedBlock + 1
	endBlock := int(currentHeight)

	// Apply the reorg threshold
	if startBlock > m.config.ReorgThreshold {
		startBlock -= m.config.ReorgThreshold
	}

	// If we're catching up, limit the number of blocks to process at once
	if endBlock-startBlock > m.config.BatchSize {
		endBlock = startBlock + m.config.BatchSize - 1
	}

	// Check if there are any blocks to process
	if startBlock > endBlock {
		// No blocks to process, update state and return
		blockProcessing.IsProcessing = false
		blockProcessing.LastProcessedAt = time.Now()
		_ = m.eventRepo.UpdateBlockProcessing(ctx, blockProcessing)
		return nil
	}

	m.logger.Infof("Processing blocks %d to %d for network %s", startBlock, endBlock, m.network)

	// Process blocks
	for blockNum := startBlock; blockNum <= endBlock; blockNum++ {
		if err := m.processBlock(ctx, blockNum); err != nil {
			m.logger.Errorf("Failed to process block %d: %v", blockNum, err)
			
			// If we fail to process a block, update the block processing state and return
			blockProcessing.IsProcessing = false
			blockProcessing.LastProcessedAt = time.Now()
			_ = m.eventRepo.UpdateBlockProcessing(ctx, blockProcessing)
			return fmt.Errorf("failed to process block %d: %w", blockNum, err)
		}

		// Update the last processed block
		blockProcessing.LastProcessedBlock = blockNum
	}

	// Update block processing state
	blockProcessing.IsProcessing = false
	blockProcessing.LastProcessedAt = time.Now()
	if err := m.eventRepo.UpdateBlockProcessing(ctx, blockProcessing); err != nil {
		return fmt.Errorf("failed to update block processing state: %w", err)
	}

	return nil
}

// processBlock processes a single block
func (m *EventMonitor) processBlock(ctx context.Context, blockNum int) error {
	// Get the block from the blockchain
	block, err := m.client.GetBlock(uint32(blockNum))
	if err != nil {
		return fmt.Errorf("failed to get block %d: %w", blockNum, err)
	}

	// Process the block
	for _, tx := range block.Transactions {
		if err := m.processTransaction(ctx, tx, block); err != nil {
			return fmt.Errorf("failed to process transaction %s: %w", tx.Hash().StringLE(), err)
		}
	}

	return nil
}

// processTransaction processes a single transaction
func (m *EventMonitor) processTransaction(ctx context.Context, tx *transaction.Transaction, blk *block.Block) error {
	// Get the application log for the transaction
	appLog, err := m.client.rpcClient.GetApplicationLog(tx.Hash(), nil)
	if err != nil {
		// If there's no application log, the transaction didn't execute successfully or didn't generate events
		return nil
	}

	// Process each execution in the application log
	for _, execution := range appLog.Executions {
		for _, notification := range execution.Notifications {
			// Create a blockchain event
			event, err := m.createBlockchainEvent(notification, tx, blk)
			if err != nil {
				m.logger.Errorf("Failed to create blockchain event: %v", err)
				continue
			}

			// Store the event in the database
			if err := m.eventRepo.CreateEvent(ctx, event); err != nil {
				return fmt.Errorf("failed to store blockchain event: %w", err)
			}

			// Process the event
			if err := m.eventProcessor.ProcessEvent(event); err != nil {
				m.logger.Errorf("Failed to process blockchain event: %v", err)
			}
		}
	}

	return nil
}

// createBlockchainEvent creates a blockchain event from a notification
func (m *EventMonitor) createBlockchainEvent(
	notification *state.NotificationEvent,
	tx *transaction.Transaction,
	blk *block.Block,
) (*models.BlockchainEvent, error) {
	// Convert notification.Item to Go value
	var parameters interface{}
	if notification.Item != nil {
		// In a production implementation, we would convert the notification.Item
		// to a proper Go value. For now, we'll use a simplified approach.
		parameters = map[string]interface{}{
			"type": notification.Item.Type().String(),
			"value": fmt.Sprintf("%v", notification.Item),
		}
	}

	// Convert parameters to JSON
	parametersJSON, err := json.Marshal(parameters)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal parameters: %w", err)
	}

	// Create blockchain event
	timestamp := time.Unix(int64(blk.Timestamp), 0)
	return models.NewBlockchainEvent(
		notification.Contract.StringLE(),
		notification.Name,
		parametersJSON,
		tx.Hash().StringLE(),
		int(blk.Index),
		blk.Hash().StringLE(),
		timestamp,
	), nil
} 
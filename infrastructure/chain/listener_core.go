// Package chain provides event listening for Neo N3 contracts.
package chain

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/logging"
)

// EventListener listens for contract events on Neo N3.
type EventListener struct {
	mu             sync.RWMutex
	client         *Client
	contractHashes map[string]bool // Multiple contracts to monitor
	handlers       map[string][]EventHandler
	txHandlers     []TxHandler
	pollInterval   time.Duration
	lastBlock      uint64
	confirmations  uint64
	running        bool
	stopCh         chan struct{}
	logger         *logging.Logger
}

// EventHandler is a callback for contract events.
type EventHandler func(event *ContractEvent) error

// TxHandler is a callback for transaction-level events.
type TxHandler func(event *TransactionEvent) error

// ContractEvent represents a contract event.
type ContractEvent struct {
	TxHash     string
	BlockIndex uint64
	BlockHash  string
	Contract   string
	EventName  string
	State      []StackItem
	Timestamp  time.Time
	Sender     string
	LogIndex   int
}

// TransactionEvent represents a transaction invocation.
type TransactionEvent struct {
	TxHash     string
	BlockIndex uint64
	BlockHash  string
	Sender     string
	Timestamp  time.Time
	Script     string
	Contracts  []string
}

// ListenerConfig holds event listener configuration.
type ListenerConfig struct {
	Client        *Client
	Contracts     ContractAddresses // All contract addresses to monitor
	PollInterval  time.Duration
	StartBlock    uint64
	Confirmations uint64
	Logger        *logging.Logger
}

// NewEventListener creates a new event listener.
func NewEventListener(cfg *ListenerConfig) *EventListener {
	if cfg == nil {
		return nil
	}

	interval := cfg.PollInterval
	if interval == 0 {
		interval = 5 * time.Second
	}

	// Build contract hash map for filtering
	contractHashes := make(map[string]bool)
	for _, contractHash := range []string{
		cfg.Contracts.PaymentHub,
		cfg.Contracts.Governance,
		cfg.Contracts.PriceFeed,
		cfg.Contracts.RandomnessLog,
		cfg.Contracts.AppRegistry,
		cfg.Contracts.AutomationAnchor,
		cfg.Contracts.ServiceLayerGateway,
	} {
		if normalized := normalizeContractHash(contractHash); normalized != "" {
			contractHashes[normalized] = true
		}
	}

	logger := cfg.Logger
	if logger == nil {
		logger = logging.NewFromEnv("chain")
	}

	return &EventListener{
		client:         cfg.Client,
		contractHashes: contractHashes,
		handlers:       make(map[string][]EventHandler),
		pollInterval:   interval,
		lastBlock:      cfg.StartBlock,
		confirmations:  cfg.Confirmations,
		stopCh:         make(chan struct{}),
		logger:         logger,
	}
}

// On registers an event handler.
func (l *EventListener) On(eventName string, handler EventHandler) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.handlers[eventName] = append(l.handlers[eventName], handler)
}

// OnTransaction registers a transaction-level handler.
func (l *EventListener) OnTransaction(handler TxHandler) {
	if handler == nil {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.txHandlers = append(l.txHandlers, handler)
}

// Start starts the event listener.
func (l *EventListener) Start(ctx context.Context) error {
	l.mu.Lock()
	if l.running {
		l.mu.Unlock()
		return fmt.Errorf("listener already running")
	}
	l.running = true
	l.mu.Unlock()

	go l.poll(ctx)
	return nil
}

// Stop stops the event listener.
func (l *EventListener) Stop() {
	l.mu.Lock()
	defer l.mu.Unlock()

	if !l.running {
		return
	}

	l.running = false
	close(l.stopCh)
}

// poll continuously polls for new blocks and events.
func (l *EventListener) poll(ctx context.Context) {
	ticker := time.NewTicker(l.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-l.stopCh:
			return
		case <-ticker.C:
			l.processNewBlocks(ctx)
		}
	}
}

// processNewBlocks processes new blocks for events.
func (l *EventListener) processNewBlocks(ctx context.Context) {
	// Get current block height
	currentBlock, err := l.client.GetBlockCount(ctx)
	if err != nil {
		return
	}
	if l.confirmations > 0 {
		if currentBlock <= l.confirmations {
			return
		}
		currentBlock -= l.confirmations
	}

	l.mu.RLock()
	lastBlock := l.lastBlock
	l.mu.RUnlock()

	if lastBlock >= currentBlock {
		return
	}

	// Process new blocks
	for blockIndex := lastBlock + 1; blockIndex < currentBlock; blockIndex++ {
		block, err := l.client.GetBlock(ctx, blockIndex)
		if err != nil {
			continue
		}

		blockTime := time.Unix(int64(block.Time), 0).UTC()
		// Process each transaction in the block
		for i := range block.Tx {
			l.processTransaction(ctx, block.Tx[i], blockIndex, block.Hash, blockTime)
		}

		l.mu.Lock()
		l.lastBlock = blockIndex
		l.mu.Unlock()
	}
}

// processTransaction processes a transaction for events.
func (l *EventListener) processTransaction(
	ctx context.Context,
	tx Transaction,
	blockIndex uint64,
	blockHash string,
	blockTime time.Time,
) {
	txHash := tx.Hash
	appLog, err := l.client.GetApplicationLog(ctx, txHash)
	if err != nil {
		return
	}

	timestamp := blockTime
	if timestamp.IsZero() {
		timestamp = time.Now().UTC()
	}

	l.mu.RLock()
	txHandlers := append([]TxHandler(nil), l.txHandlers...)
	l.mu.RUnlock()
	if len(txHandlers) > 0 {
		contracts, parseErr := ExtractContractCallTargets(tx.Script)
		if parseErr != nil {
			l.logger.WithFields(map[string]interface{}{
				"tx_hash": txHash,
			}).WithError(parseErr).Warn("failed to parse tx script")
		} else if len(contracts) > 0 {
			txEvent := &TransactionEvent{
				TxHash:     txHash,
				BlockIndex: blockIndex,
				BlockHash:  blockHash,
				Sender:     tx.Sender,
				Timestamp:  timestamp,
				Script:     tx.Script,
				Contracts:  contracts,
			}
			for _, handler := range txHandlers {
				go func(h TxHandler, e *TransactionEvent) {
					if err := h(e); err != nil {
						l.logger.WithFields(map[string]interface{}{
							"tx_hash": e.TxHash,
						}).WithError(err).Warn("transaction handler failed")
					}
				}(handler, txEvent)
			}
		}
	}

	logIndex := 0
	for _, exec := range appLog.Executions {
		if exec.VMState != "HALT" {
			continue
		}

		for _, notif := range exec.Notifications {
			contractHash := normalizeContractHash(notif.Contract)

			// Filter by contract (if we have contracts configured)
			if len(l.contractHashes) > 0 && !l.contractHashes[contractHash] {
				continue
			}

			event := &ContractEvent{
				TxHash:     txHash,
				BlockIndex: blockIndex,
				BlockHash:  blockHash,
				Contract:   contractHash,
				EventName:  notif.EventName,
				Timestamp:  timestamp,
				Sender:     tx.Sender,
				LogIndex:   logIndex,
			}
			logIndex++

			// Parse state array
			if notif.State.Type == "Array" {
				var items []StackItem
				if err := json.Unmarshal(notif.State.Value, &items); err == nil {
					event.State = items
				}
			}

			// Call handlers
			l.mu.RLock()
			handlers := l.handlers[notif.EventName]
			l.mu.RUnlock()

			for _, handler := range handlers {
				go func(h EventHandler, e *ContractEvent) {
					if err := h(e); err != nil {
						l.logger.WithFields(map[string]interface{}{
							"event":     e.EventName,
							"contract":  e.Contract,
							"tx_hash":   e.TxHash,
							"block_idx": e.BlockIndex,
						}).WithError(err).Warn("event handler failed")
					}
				}(handler, event)
			}
		}
	}
}

func normalizeContractHash(value string) string {
	trimmed := strings.TrimSpace(value)
	trimmed = strings.TrimPrefix(trimmed, "0x")
	trimmed = strings.TrimPrefix(trimmed, "0X")
	trimmed = strings.ToLower(trimmed)
	if len(trimmed) != 40 {
		return ""
	}
	for _, ch := range trimmed {
		if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') {
			return ""
		}
	}
	return trimmed
}

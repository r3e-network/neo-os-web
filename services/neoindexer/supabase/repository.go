package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/R3E-Network/service_layer/internal/database"
)

const processedEventsTable = "processed_events"

// Repository defines the persistence surface NeoIndexer needs for durable event idempotency.
type Repository interface {
	// Exists returns true when the event is already recorded as processed.
	Exists(ctx context.Context, chainID, txHash string, logIndex int) (bool, error)
	// Insert records an event as processed.
	Insert(ctx context.Context, record *ProcessedEventRecord) error
}

// SupabaseRepository implements Repository using Supabase PostgREST.
type SupabaseRepository struct {
	base *database.Repository
}

func NewRepository(base *database.Repository) *SupabaseRepository {
	return &SupabaseRepository{base: base}
}

func (r *SupabaseRepository) Exists(ctx context.Context, chainID, txHash string, logIndex int) (bool, error) {
	if r == nil || r.base == nil {
		return false, fmt.Errorf("neoindexer: database not configured")
	}
	chainID = strings.TrimSpace(chainID)
	txHash = strings.TrimSpace(txHash)
	if chainID == "" || txHash == "" {
		return false, fmt.Errorf("chain_id and tx_hash are required")
	}
	if logIndex < 0 {
		return false, fmt.Errorf("log_index must be >= 0")
	}

	query := database.NewQuery().
		Eq("chain_id", chainID).
		Eq("tx_hash", txHash).
		Eq("log_index", strconv.Itoa(logIndex)).
		Limit(1).
		Build()

	data, err := r.base.Request(ctx, "GET", processedEventsTable, nil, query)
	if err != nil {
		return false, fmt.Errorf("get %s: %w", processedEventsTable, err)
	}

	var rows []ProcessedEventRecord
	if err := json.Unmarshal(data, &rows); err != nil {
		return false, fmt.Errorf("unmarshal %s: %w", processedEventsTable, err)
	}
	return len(rows) > 0, nil
}

func (r *SupabaseRepository) Insert(ctx context.Context, record *ProcessedEventRecord) error {
	if r == nil || r.base == nil {
		return fmt.Errorf("neoindexer: database not configured")
	}
	if record == nil {
		return fmt.Errorf("record is required")
	}

	chainID := strings.TrimSpace(record.ChainID)
	txHash := strings.TrimSpace(record.TxHash)
	contract := strings.TrimSpace(record.ContractAddress)
	eventName := strings.TrimSpace(record.EventName)

	if chainID == "" || txHash == "" || contract == "" || eventName == "" {
		return fmt.Errorf("chain_id, tx_hash, contract_address, and event_name are required")
	}
	if record.LogIndex < 0 {
		return fmt.Errorf("log_index must be >= 0")
	}
	if record.BlockHeight < 0 {
		return fmt.Errorf("block_height must be >= 0")
	}
	if len(record.Payload) == 0 {
		record.Payload = json.RawMessage("null")
	}

	payload := map[string]any{
		"chain_id":         chainID,
		"tx_hash":          txHash,
		"log_index":        record.LogIndex,
		"block_height":     record.BlockHeight,
		"block_hash":       strings.TrimSpace(record.BlockHash),
		"contract_address": contract,
		"event_name":       eventName,
		"payload":          json.RawMessage(record.Payload),
		"confirmations":    record.Confirmations,
	}

	_, err := r.base.Request(ctx, "POST", processedEventsTable, payload, "")
	if err == nil {
		return nil
	}

	// PostgREST returns 409 on unique constraint violations. Treat it as a no-op so
	// multiple indexers can race safely.
	if strings.Contains(err.Error(), "supabase API error 409") {
		return nil
	}

	return fmt.Errorf("insert %s: %w", processedEventsTable, err)
}


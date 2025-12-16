package supabase

import (
	"encoding/json"
	"time"
)

// ProcessedEventRecord represents a row in the processed_events table.
// It is used by NeoIndexer for durable idempotency.
type ProcessedEventRecord struct {
	ID              int64           `json:"id,omitempty"`
	ChainID         string          `json:"chain_id"`
	TxHash          string          `json:"tx_hash"`
	LogIndex        int             `json:"log_index"`
	BlockHeight     int64           `json:"block_height"`
	BlockHash       string          `json:"block_hash"`
	ContractAddress string          `json:"contract_address"`
	EventName       string          `json:"event_name"`
	Payload         json.RawMessage `json:"payload"`
	Confirmations   int             `json:"confirmations"`
	ProcessedAt     time.Time       `json:"processed_at,omitempty"`
}


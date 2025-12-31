// Package execution provides MiniApp execution tracking via Supabase.
package execution

import (
	"time"
)

// Status represents the execution status.
type Status string

const (
	StatusPending    Status = "pending"
	StatusProcessing Status = "processing"
	StatusSuccess    Status = "success"
	StatusFailed     Status = "failed"
	StatusTimeout    Status = "timeout"
)

// Execution represents a MiniApp execution record.
type Execution struct {
	ID           int64                  `json:"id,omitempty"`
	RequestID    string                 `json:"request_id"`
	AppID        string                 `json:"app_id"`
	UserAddress  string                 `json:"user_address,omitempty"`
	SessionID    string                 `json:"session_id,omitempty"`
	Status       Status                 `json:"status"`
	Method       string                 `json:"method"`
	Params       map[string]interface{} `json:"params,omitempty"`
	Result       map[string]interface{} `json:"result,omitempty"`
	ErrorMessage string                 `json:"error_message,omitempty"`
	ErrorCode    string                 `json:"error_code,omitempty"`
	TxHash       string                 `json:"tx_hash,omitempty"`
	TxStatus     string                 `json:"tx_status,omitempty"`
	CreatedAt    *time.Time             `json:"created_at,omitempty"`
	StartedAt    *time.Time             `json:"started_at,omitempty"`
	CompletedAt  *time.Time             `json:"completed_at,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// CreateRequest is the request to create a new execution.
type CreateRequest struct {
	RequestID   string                 `json:"request_id"`
	AppID       string                 `json:"app_id"`
	UserAddress string                 `json:"user_address,omitempty"`
	SessionID   string                 `json:"session_id,omitempty"`
	Method      string                 `json:"method"`
	Params      map[string]interface{} `json:"params,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateRequest is the request to update an execution.
type UpdateRequest struct {
	Status       *Status                `json:"status,omitempty"`
	Result       map[string]interface{} `json:"result,omitempty"`
	ErrorMessage *string                `json:"error_message,omitempty"`
	ErrorCode    *string                `json:"error_code,omitempty"`
	TxHash       *string                `json:"tx_hash,omitempty"`
	TxStatus     *string                `json:"tx_status,omitempty"`
	StartedAt    *time.Time             `json:"started_at,omitempty"`
	CompletedAt  *time.Time             `json:"completed_at,omitempty"`
}

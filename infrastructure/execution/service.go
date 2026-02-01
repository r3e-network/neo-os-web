// Package execution provides MiniApp execution tracking via Supabase.
package execution

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
)

// Service handles execution tracking operations.
type Service struct {
	db *database.Client
}

// NewService creates a new execution service.
func NewService(db *database.Client) *Service {
	return &Service{db: db}
}

const tableName = "miniapp_executions"

// Create creates a new execution record with pending status.
func (s *Service) Create(ctx context.Context, req CreateRequest) (*Execution, error) {
	now := time.Now()
	exec := &Execution{
		RequestID:   req.RequestID,
		AppID:       req.AppID,
		UserAddress: req.UserAddress,
		SessionID:   req.SessionID,
		Status:      StatusPending,
		Method:      req.Method,
		Params:      req.Params,
		Metadata:    req.Metadata,
		CreatedAt:   &now,
	}

	data, err := s.db.Insert(ctx, tableName, exec)
	if err != nil {
		return nil, fmt.Errorf("insert execution: %w", err)
	}

	var result []Execution
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("unmarshal result: %w", err)
	}

	if len(result) == 0 {
		return exec, nil
	}
	return &result[0], nil
}

// MarkProcessing marks an execution as processing.
func (s *Service) MarkProcessing(ctx context.Context, requestID string) error {
	now := time.Now()
	update := map[string]interface{}{
		"status":     StatusProcessing,
		"started_at": now,
	}
	query := fmt.Sprintf("request_id=eq.%s", requestID)
	_, err := s.db.Update(ctx, tableName, update, query)
	return err
}

// MarkSuccess marks an execution as successful with result.
func (s *Service) MarkSuccess(ctx context.Context, requestID string, result map[string]interface{}) error {
	now := time.Now()
	update := map[string]interface{}{
		"status":       StatusSuccess,
		"result":       result,
		"completed_at": now,
	}
	query := fmt.Sprintf("request_id=eq.%s", requestID)
	_, err := s.db.Update(ctx, tableName, update, query)
	return err
}

// MarkFailed marks an execution as failed with error info.
func (s *Service) MarkFailed(ctx context.Context, requestID, errMsg, errCode string) error {
	now := time.Now()
	update := map[string]interface{}{
		"status":        StatusFailed,
		"error_message": errMsg,
		"error_code":    errCode,
		"completed_at":  now,
	}
	query := fmt.Sprintf("request_id=eq.%s", requestID)
	_, err := s.db.Update(ctx, tableName, update, query)
	return err
}

// UpdateTxStatus updates the transaction status.
func (s *Service) UpdateTxStatus(ctx context.Context, requestID, txHash, txStatus string) error {
	update := map[string]interface{}{
		"tx_hash":   txHash,
		"tx_status": txStatus,
	}
	query := fmt.Sprintf("request_id=eq.%s", requestID)
	_, err := s.db.Update(ctx, tableName, update, query)
	return err
}

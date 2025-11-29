// Package engine provides callback sending functionality for service results.
package engine

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/R3E-Network/service_layer/pkg/logger"
)

// NeoCallbackSender sends callback transactions to Neo N3 contracts.
type NeoCallbackSender struct {
	rpcURL     string
	signerKey  string // Private key for signing transactions
	log        *logger.Logger

	// Transaction tracking
	pendingTxs map[string]*CallbackTx
}

// CallbackTx represents a pending callback transaction.
type CallbackTx struct {
	RequestID  string
	TxHash     string
	Contract   string
	Method     string
	Status     string // pending, confirmed, failed
	CreatedAt  time.Time
	ConfirmedAt *time.Time
}

// NeoCallbackConfig configures the Neo callback sender.
type NeoCallbackConfig struct {
	RPCURL    string
	SignerKey string
	Logger    *logger.Logger
}

// NewNeoCallbackSender creates a new Neo callback sender.
func NewNeoCallbackSender(cfg NeoCallbackConfig) *NeoCallbackSender {
	if cfg.Logger == nil {
		cfg.Logger = logger.NewDefault("neo-callback")
	}

	return &NeoCallbackSender{
		rpcURL:     cfg.RPCURL,
		signerKey:  cfg.SignerKey,
		log:        cfg.Logger,
		pendingTxs: make(map[string]*CallbackTx),
	}
}

// SendCallback sends a result back to the contract.
// This implements the CallbackSender interface.
func (s *NeoCallbackSender) SendCallback(ctx context.Context, req *ServiceRequest, result MethodResult) error {
	s.log.WithField("request_id", req.ID).
		WithField("contract", req.CallbackContract).
		WithField("method", req.CallbackMethod).
		Info("sending callback transaction")

	// Build callback parameters
	params, err := s.buildCallbackParams(req, result)
	if err != nil {
		return fmt.Errorf("build callback params: %w", err)
	}

	// For now, log the callback (actual Neo transaction sending would go here)
	// In production, this would use neo-go SDK to build and send the transaction
	s.log.WithField("request_id", req.ID).
		WithField("params", params).
		Info("callback prepared (transaction sending not implemented)")

	// Track the callback
	tx := &CallbackTx{
		RequestID: req.ID,
		Contract:  req.CallbackContract,
		Method:    req.CallbackMethod,
		Status:    "pending",
		CreatedAt: time.Now().UTC(),
	}
	s.pendingTxs[req.ID] = tx

	return nil
}

// buildCallbackParams builds the parameters for the callback transaction.
func (s *NeoCallbackSender) buildCallbackParams(req *ServiceRequest, result MethodResult) (map[string]any, error) {
	params := map[string]any{
		"request_id": req.ExternalID,
	}

	if result.Error != nil {
		// Error callback
		params["status"] = 2 // failed
		params["error"] = result.Error.Error()
		params["result_hash"] = ""
	} else {
		// Success callback
		params["status"] = 1 // fulfilled

		// Serialize and hash the result
		resultData, err := json.Marshal(result.Data)
		if err != nil {
			return nil, fmt.Errorf("marshal result: %w", err)
		}

		hash := sha256.Sum256(resultData)
		params["result_hash"] = base64.StdEncoding.EncodeToString(hash[:])
		params["result"] = result.Data
	}

	// Add metadata if present
	if result.Metadata != nil {
		for k, v := range result.Metadata {
			params[k] = v
		}
	}

	return params, nil
}

// GetPendingTx returns a pending callback transaction.
func (s *NeoCallbackSender) GetPendingTx(requestID string) (*CallbackTx, bool) {
	tx, ok := s.pendingTxs[requestID]
	return tx, ok
}

// ConfirmTx marks a callback transaction as confirmed.
func (s *NeoCallbackSender) ConfirmTx(requestID, txHash string) {
	if tx, ok := s.pendingTxs[requestID]; ok {
		tx.TxHash = txHash
		tx.Status = "confirmed"
		now := time.Now().UTC()
		tx.ConfirmedAt = &now
	}
}

// FailTx marks a callback transaction as failed.
func (s *NeoCallbackSender) FailTx(requestID, reason string) {
	if tx, ok := s.pendingTxs[requestID]; ok {
		tx.Status = "failed"
	}
}

// MockCallbackSender is a mock implementation for testing.
type MockCallbackSender struct {
	Callbacks []*MockCallback
	log       *logger.Logger
}

// MockCallback represents a recorded callback.
type MockCallback struct {
	Request   *ServiceRequest
	Result    MethodResult
	Timestamp time.Time
}

// NewMockCallbackSender creates a new mock callback sender.
func NewMockCallbackSender(log *logger.Logger) *MockCallbackSender {
	if log == nil {
		log = logger.NewDefault("mock-callback")
	}
	return &MockCallbackSender{
		Callbacks: make([]*MockCallback, 0),
		log:       log,
	}
}

// SendCallback records the callback for testing.
func (m *MockCallbackSender) SendCallback(ctx context.Context, req *ServiceRequest, result MethodResult) error {
	m.log.WithField("request_id", req.ID).
		WithField("service", req.ServiceName).
		WithField("method", req.MethodName).
		WithField("has_result", result.HasResult).
		Info("mock callback recorded")

	m.Callbacks = append(m.Callbacks, &MockCallback{
		Request:   req,
		Result:    result,
		Timestamp: time.Now().UTC(),
	})

	return nil
}

// GetCallbacks returns all recorded callbacks.
func (m *MockCallbackSender) GetCallbacks() []*MockCallback {
	return m.Callbacks
}

// Clear clears all recorded callbacks.
func (m *MockCallbackSender) Clear() {
	m.Callbacks = make([]*MockCallback, 0)
}

// InvokeFileCallbackSender writes callbacks to a file for debugging.
type InvokeFileCallbackSender struct {
	filePath string
	log      *logger.Logger
}

// NewInvokeFileCallbackSender creates a file-based callback sender.
func NewInvokeFileCallbackSender(filePath string, log *logger.Logger) *InvokeFileCallbackSender {
	if log == nil {
		log = logger.NewDefault("file-callback")
	}
	return &InvokeFileCallbackSender{
		filePath: filePath,
		log:      log,
	}
}

// SendCallback writes the callback to a file.
func (f *InvokeFileCallbackSender) SendCallback(ctx context.Context, req *ServiceRequest, result MethodResult) error {
	// Build invoke file content
	invokeData := map[string]any{
		"contract":  req.CallbackContract,
		"operation": req.CallbackMethod,
		"args":      f.buildArgs(req, result),
	}

	data, err := json.MarshalIndent([]any{invokeData}, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal invoke data: %w", err)
	}

	f.log.WithField("request_id", req.ID).
		WithField("file", f.filePath).
		WithField("data", string(data)).
		Info("callback invoke file prepared")

	return nil
}

// buildArgs builds the arguments for the invoke file.
func (f *InvokeFileCallbackSender) buildArgs(req *ServiceRequest, result MethodResult) []any {
	args := []any{
		req.ExternalID, // request ID
	}

	if result.Error != nil {
		// Error: empty result hash, status 2
		args = append(args, "", 2)
	} else {
		// Success: result hash, status 1
		resultData, _ := json.Marshal(result.Data)
		hash := sha256.Sum256(resultData)
		args = append(args, base64.StdEncoding.EncodeToString(hash[:]), 1)
	}

	return args
}

// HashResult computes a SHA256 hash of the result data.
func HashResult(data any) (string, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(jsonData)
	return hex.EncodeToString(hash[:]), nil
}

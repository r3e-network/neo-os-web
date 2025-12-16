package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/internal/database"
)

const chainTxsTable = "chain_txs"

// =============================================================================
// Repository Interface
// =============================================================================

// Repository defines the interface for chain_txs operations.
type Repository interface {
	// Create creates a new transaction record.
	Create(ctx context.Context, req *CreateTxRequest) (*ChainTxRecord, error)

	// UpdateStatus updates the status of a transaction.
	UpdateStatus(ctx context.Context, req *UpdateTxStatusRequest) error

	// GetByID retrieves a transaction by ID.
	GetByID(ctx context.Context, id int64) (*ChainTxRecord, error)

	// GetByRequestID retrieves a transaction by request ID and service.
	GetByRequestID(ctx context.Context, fromService, requestID string) (*ChainTxRecord, error)

	// GetByTxHash retrieves a transaction by tx hash.
	GetByTxHash(ctx context.Context, txHash string) (*ChainTxRecord, error)

	// ListPending lists transactions with pending or submitted status.
	ListPending(ctx context.Context, limit int) ([]*ChainTxRecord, error)

	// ListByService lists transactions by service.
	ListByService(ctx context.Context, fromService string, limit int) ([]*ChainTxRecord, error)
}

// =============================================================================
// Supabase Repository Implementation
// =============================================================================

// SupabaseRepository implements Repository using Supabase PostgREST.
type SupabaseRepository struct {
	base *database.Repository
}

// NewRepository creates a new Supabase repository.
func NewRepository(base *database.Repository) *SupabaseRepository {
	return &SupabaseRepository{base: base}
}

// Create creates a new transaction record (idempotent by from_service+request_id).
func (r *SupabaseRepository) Create(ctx context.Context, req *CreateTxRequest) (*ChainTxRecord, error) {
	if r == nil || r.base == nil {
		return nil, fmt.Errorf("txsubmitter: database not configured")
	}
	if req == nil {
		return nil, fmt.Errorf("request is required")
	}

	fromService := strings.TrimSpace(req.FromService)
	requestID := strings.TrimSpace(req.RequestID)
	txType := strings.TrimSpace(req.TxType)
	contractAddress := strings.TrimSpace(req.ContractAddress)
	methodName := strings.TrimSpace(req.MethodName)

	if requestID == "" {
		return nil, fmt.Errorf("request_id is required")
	}
	if fromService == "" {
		return nil, fmt.Errorf("from_service is required")
	}
	if txType == "" {
		return nil, fmt.Errorf("tx_type is required")
	}
	if contractAddress == "" {
		return nil, fmt.Errorf("contract_address is required")
	}
	if methodName == "" {
		return nil, fmt.Errorf("method_name is required")
	}

	// Idempotency: if a record already exists for (from_service, request_id), return it.
	if existing, err := r.GetByRequestID(ctx, fromService, requestID); err == nil && existing != nil {
		return existing, nil
	} else if err != nil && !database.IsNotFound(err) {
		return nil, fmt.Errorf("lookup existing record: %w", err)
	}

	params := req.Params
	if len(params) == 0 {
		params = json.RawMessage("{}")
	}

	payload := map[string]any{
		"request_id":       requestID,
		"from_service":     fromService,
		"tx_type":          txType,
		"contract_address": contractAddress,
		"method_name":      methodName,
		"params":           params,
		"status":           string(StatusPending),
		"retry_count":      0,
	}

	data, err := r.base.Request(ctx, "POST", chainTxsTable, payload, "")
	if err != nil {
		return nil, fmt.Errorf("create %s: %w", chainTxsTable, err)
	}

	var rows []ChainTxRecord
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", chainTxsTable, err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("create %s: empty response", chainTxsTable)
	}
	return &rows[0], nil
}

// UpdateStatus updates a transaction's status and metadata.
func (r *SupabaseRepository) UpdateStatus(ctx context.Context, req *UpdateTxStatusRequest) error {
	if r == nil || r.base == nil {
		return fmt.Errorf("txsubmitter: database not configured")
	}
	if req == nil {
		return fmt.Errorf("request is required")
	}
	if req.ID <= 0 {
		return fmt.Errorf("id is required")
	}

	update := map[string]any{}
	if strings.TrimSpace(req.TxHash) != "" {
		update["tx_hash"] = strings.TrimSpace(req.TxHash)
	}
	if req.Status != "" {
		update["status"] = string(req.Status)
	}
	if req.RetryCount > 0 {
		update["retry_count"] = req.RetryCount
	}
	if strings.TrimSpace(req.ErrorMessage) != "" {
		update["error_message"] = strings.TrimSpace(req.ErrorMessage)
	}
	if strings.TrimSpace(req.RPCEndpoint) != "" {
		update["rpc_endpoint"] = strings.TrimSpace(req.RPCEndpoint)
	}
	if req.GasConsumed > 0 {
		update["gas_consumed"] = req.GasConsumed
	}
	if req.ConfirmedAt != nil {
		update["confirmed_at"] = req.ConfirmedAt
	}

	if len(update) == 0 {
		return nil
	}

	query := "id=eq." + strconv.FormatInt(req.ID, 10)
	_, err := r.base.Request(ctx, "PATCH", chainTxsTable, update, query)
	if err != nil {
		return fmt.Errorf("update %s: %w", chainTxsTable, err)
	}
	return nil
}

// GetByID retrieves a transaction by ID.
func (r *SupabaseRepository) GetByID(ctx context.Context, id int64) (*ChainTxRecord, error) {
	if r == nil || r.base == nil {
		return nil, fmt.Errorf("txsubmitter: database not configured")
	}
	if id <= 0 {
		return nil, fmt.Errorf("invalid id")
	}

	query := "id=eq." + strconv.FormatInt(id, 10) + "&limit=1"
	data, err := r.base.Request(ctx, "GET", chainTxsTable, nil, query)
	if err != nil {
		return nil, fmt.Errorf("get %s: %w", chainTxsTable, err)
	}

	var rows []ChainTxRecord
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", chainTxsTable, err)
	}
	if len(rows) == 0 {
		return nil, database.NewNotFoundError(chainTxsTable, strconv.FormatInt(id, 10))
	}
	return &rows[0], nil
}

// GetByRequestID retrieves a transaction by request ID and service.
func (r *SupabaseRepository) GetByRequestID(ctx context.Context, fromService, requestID string) (*ChainTxRecord, error) {
	if r == nil || r.base == nil {
		return nil, fmt.Errorf("txsubmitter: database not configured")
	}

	fromService = strings.TrimSpace(fromService)
	requestID = strings.TrimSpace(requestID)
	if fromService == "" || requestID == "" {
		return nil, fmt.Errorf("from_service and request_id are required")
	}

	query := database.NewQuery().
		Eq("from_service", fromService).
		Eq("request_id", requestID).
		Limit(1).
		Build()

	data, err := r.base.Request(ctx, "GET", chainTxsTable, nil, query)
	if err != nil {
		return nil, fmt.Errorf("get %s: %w", chainTxsTable, err)
	}

	var rows []ChainTxRecord
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", chainTxsTable, err)
	}
	if len(rows) == 0 {
		return nil, database.NewNotFoundError(chainTxsTable, fromService+":"+requestID)
	}
	return &rows[0], nil
}

// GetByTxHash retrieves a transaction by tx hash.
func (r *SupabaseRepository) GetByTxHash(ctx context.Context, txHash string) (*ChainTxRecord, error) {
	if r == nil || r.base == nil {
		return nil, fmt.Errorf("txsubmitter: database not configured")
	}
	txHash = strings.TrimSpace(txHash)
	if txHash == "" {
		return nil, fmt.Errorf("tx_hash is required")
	}

	query := "tx_hash=eq." + url.QueryEscape(txHash) + "&limit=1"
	data, err := r.base.Request(ctx, "GET", chainTxsTable, nil, query)
	if err != nil {
		return nil, fmt.Errorf("get %s: %w", chainTxsTable, err)
	}

	var rows []ChainTxRecord
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", chainTxsTable, err)
	}
	if len(rows) == 0 {
		return nil, database.NewNotFoundError(chainTxsTable, txHash)
	}
	return &rows[0], nil
}

// ListPending lists transactions with pending/submitted status.
func (r *SupabaseRepository) ListPending(ctx context.Context, limit int) ([]*ChainTxRecord, error) {
	if r == nil || r.base == nil {
		return nil, fmt.Errorf("txsubmitter: database not configured")
	}
	limit = database.ValidateLimit(limit, 100, 1000)

	query := fmt.Sprintf("status=in.(%s,%s)&order=submitted_at.asc&limit=%d",
		string(StatusPending),
		string(StatusSubmitted),
		limit,
	)
	data, err := r.base.Request(ctx, "GET", chainTxsTable, nil, query)
	if err != nil {
		return nil, fmt.Errorf("list %s: %w", chainTxsTable, err)
	}

	var rows []*ChainTxRecord
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", chainTxsTable, err)
	}
	return rows, nil
}

// ListByService lists transactions by from_service.
func (r *SupabaseRepository) ListByService(ctx context.Context, fromService string, limit int) ([]*ChainTxRecord, error) {
	if r == nil || r.base == nil {
		return nil, fmt.Errorf("txsubmitter: database not configured")
	}
	fromService = strings.TrimSpace(fromService)
	if fromService == "" {
		return nil, fmt.Errorf("from_service is required")
	}
	limit = database.ValidateLimit(limit, 100, 1000)

	query := fmt.Sprintf("from_service=eq.%s&order=submitted_at.desc&limit=%d", url.QueryEscape(fromService), limit)
	data, err := r.base.Request(ctx, "GET", chainTxsTable, nil, query)
	if err != nil {
		return nil, fmt.Errorf("list %s: %w", chainTxsTable, err)
	}

	var rows []*ChainTxRecord
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", chainTxsTable, err)
	}
	return rows, nil
}

// =============================================================================
// Mock Repository for Testing
// =============================================================================

// MockRepository is a mock implementation for testing.
type MockRepository struct {
	records map[int64]*ChainTxRecord
	byReq   map[string]*ChainTxRecord // key: fromService:requestID
	nextID  int64
}

// NewMockRepository creates a new mock repository.
func NewMockRepository() *MockRepository {
	return &MockRepository{
		records: make(map[int64]*ChainTxRecord),
		byReq:   make(map[string]*ChainTxRecord),
		nextID:  1,
	}
}

// Create creates a new transaction record.
func (m *MockRepository) Create(ctx context.Context, req *CreateTxRequest) (*ChainTxRecord, error) {
	if req.RequestID == "" {
		return nil, fmt.Errorf("request_id is required")
	}
	if req.FromService == "" {
		return nil, fmt.Errorf("from_service is required")
	}

	key := req.FromService + ":" + req.RequestID
	if existing, ok := m.byReq[key]; ok {
		return existing, nil
	}

	record := &ChainTxRecord{
		ID:              m.nextID,
		RequestID:       req.RequestID,
		FromService:     req.FromService,
		TxType:          req.TxType,
		ContractAddress: req.ContractAddress,
		MethodName:      req.MethodName,
		Params:          req.Params,
		Status:          StatusPending,
		RetryCount:      0,
		SubmittedAt:     time.Now(),
	}

	m.records[m.nextID] = record
	m.byReq[key] = record
	m.nextID++

	return record, nil
}

// UpdateStatus updates the status of a transaction.
func (m *MockRepository) UpdateStatus(ctx context.Context, req *UpdateTxStatusRequest) error {
	record, ok := m.records[req.ID]
	if !ok {
		return fmt.Errorf("record not found")
	}

	if req.TxHash != "" {
		record.TxHash = req.TxHash
	}
	record.Status = req.Status
	if req.RetryCount > 0 {
		record.RetryCount = req.RetryCount
	}
	if req.ErrorMessage != "" {
		record.ErrorMessage = req.ErrorMessage
	}
	if req.RPCEndpoint != "" {
		record.RPCEndpoint = req.RPCEndpoint
	}
	if req.GasConsumed > 0 {
		record.GasConsumed = req.GasConsumed
	}
	if req.ConfirmedAt != nil {
		record.ConfirmedAt = req.ConfirmedAt
	}

	return nil
}

// GetByID retrieves a transaction by ID.
func (m *MockRepository) GetByID(ctx context.Context, id int64) (*ChainTxRecord, error) {
	record, ok := m.records[id]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return record, nil
}

// GetByRequestID retrieves a transaction by request ID and service.
func (m *MockRepository) GetByRequestID(ctx context.Context, fromService, requestID string) (*ChainTxRecord, error) {
	key := fromService + ":" + requestID
	record, ok := m.byReq[key]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return record, nil
}

// GetByTxHash retrieves a transaction by tx hash.
func (m *MockRepository) GetByTxHash(ctx context.Context, txHash string) (*ChainTxRecord, error) {
	for _, record := range m.records {
		if record.TxHash == txHash {
			return record, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

// ListPending lists transactions with pending or submitted status.
func (m *MockRepository) ListPending(ctx context.Context, limit int) ([]*ChainTxRecord, error) {
	var result []*ChainTxRecord
	for _, record := range m.records {
		if record.Status == StatusPending || record.Status == StatusSubmitted {
			result = append(result, record)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

// ListByService lists transactions by service.
func (m *MockRepository) ListByService(ctx context.Context, fromService string, limit int) ([]*ChainTxRecord, error) {
	var result []*ChainTxRecord
	for _, record := range m.records {
		if record.FromService == fromService {
			result = append(result, record)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

// Ensure implementations satisfy Repository.
var _ Repository = (*SupabaseRepository)(nil)
var _ Repository = (*MockRepository)(nil)

// MarshalParams marshals params for convenience in tests.
func MarshalParams(v any) json.RawMessage {
	data, _ := json.Marshal(v)
	return data
}


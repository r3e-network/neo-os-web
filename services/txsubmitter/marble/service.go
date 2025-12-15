// Package txsubmitter provides the unified transaction submission service.
//
// Architecture: Centralized Chain Write Authority
// - ONLY service with chain write permission
// - All other services submit transactions through TxSubmitter
// - Runs in TEE (Marble/EGo) for key protection
// - Provides rate limiting, retry, and audit logging
package txsubmitter

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"math/rand"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/internal/chain"
	"github.com/R3E-Network/service_layer/internal/database"
	"github.com/R3E-Network/service_layer/internal/logging"
	"github.com/R3E-Network/service_layer/internal/marble"
	commonservice "github.com/R3E-Network/service_layer/services/common/service"
	"github.com/R3E-Network/service_layer/services/txsubmitter/supabase"
)

// =============================================================================
// Service Definition
// =============================================================================

// Service implements the unified transaction submission service.
type Service struct {
	*commonservice.BaseService
	mu sync.RWMutex

	// Configuration
	retryConfig *RetryConfig

	// Chain interaction
	rpcPool     *chain.RPCPool
	chainClient *chain.Client
	fulfiller   *chain.TEEFulfiller

	// Rate limiting
	rateLimiter *RateLimiter

	// Repository
	repo supabase.Repository

	// Metrics
	txsSubmitted int64
	txsConfirmed int64
	txsFailed    int64
	startTime    time.Time

	// Pending transactions for confirmation tracking
	pendingTxs map[int64]*supabase.ChainTxRecord
}

// Config holds TxSubmitter service configuration.
type Config struct {
	Marble          *marble.Marble
	DB              database.RepositoryInterface
	ChainClient     *chain.Client
	RPCPool         *chain.RPCPool
	Fulfiller       *chain.TEEFulfiller
	Repository      supabase.Repository
	RateLimitConfig *RateLimitConfig
	RetryConfig     *RetryConfig
}

// =============================================================================
// Constructor
// =============================================================================

// New creates a new TxSubmitter service.
func New(cfg Config) (*Service, error) {
	if cfg.RateLimitConfig == nil {
		cfg.RateLimitConfig = DefaultRateLimitConfig()
	}
	if cfg.RetryConfig == nil {
		cfg.RetryConfig = DefaultRetryConfig()
	}

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
		DB:      cfg.DB,
		RequiredSecrets: []string{
			"TEE_PRIVATE_KEY",
			"NEO_RPC_URL",
		},
	})

	s := &Service{
		BaseService: base,
		retryConfig: cfg.RetryConfig,
		rpcPool:     cfg.RPCPool,
		chainClient: cfg.ChainClient,
		fulfiller:   cfg.Fulfiller,
		rateLimiter: NewRateLimiter(cfg.RateLimitConfig),
		repo:        cfg.Repository,
		startTime:   time.Now(),
		pendingTxs:  make(map[int64]*supabase.ChainTxRecord),
	}

	// Set up hydration to load pending transactions on startup
	s.WithHydrate(s.hydrate)

	// Set up statistics provider
	s.WithStats(s.statistics)

	// Add confirmation tracking worker
	s.AddTickerWorker(5*time.Second, s.confirmationWorkerWithError)

	// Attach ServeMux routes to the marble router.
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)
	s.Router().NotFoundHandler = mux

	return s, nil
}

// =============================================================================
// Lifecycle
// =============================================================================

func (s *Service) Start(ctx context.Context) error {
	if err := s.BaseService.Start(ctx); err != nil {
		return err
	}

	if s.rpcPool != nil {
		s.rpcPool.Start(ctx)
	}

	return nil
}

func (s *Service) Stop() error {
	if s.rpcPool != nil {
		s.rpcPool.Stop()
	}
	return s.BaseService.Stop()
}

// hydrate loads pending transactions from the database.
func (s *Service) hydrate(ctx context.Context) error {
	s.Logger().Info(ctx, "Hydrating TxSubmitter state...", nil)

	if s.repo == nil {
		return nil
	}

	// Load pending transactions
	pending, err := s.repo.ListPending(ctx, 1000)
	if err != nil {
		s.Logger().Warn(ctx, "Failed to load pending transactions", map[string]interface{}{"error": err.Error()})
		return nil
	}

	s.mu.Lock()
	for _, tx := range pending {
		s.pendingTxs[tx.ID] = tx
	}
	s.mu.Unlock()

	s.Logger().Info(ctx, "Loaded pending transactions", map[string]interface{}{"count": len(pending)})
	return nil
}

// statistics returns service statistics for the /info endpoint.
func (s *Service) statistics() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return map[string]any{
		"txs_submitted": s.txsSubmitted,
		"txs_confirmed": s.txsConfirmed,
		"txs_failed":    s.txsFailed,
		"pending_txs":   len(s.pendingTxs),
		"uptime":        time.Since(s.startTime).String(),
		"rate_limit":    s.rateLimiter.Status(),
		"rpc_healthy":   s.rpcPool != nil && s.rpcPool.HealthyCount() > 0,
		"rpc_endpoints": s.rpcPool.HealthyCount(),
	}
}

// =============================================================================
// Transaction Submission
// =============================================================================

// Submit submits a transaction to the blockchain.
func (s *Service) Submit(ctx context.Context, fromService string, req *TxRequest) (*TxResponse, error) {
	// Authorization check
	if !IsAuthorized(fromService, req.TxType) {
		return nil, fmt.Errorf("service %s not authorized for tx type %s", fromService, req.TxType)
	}

	// Rate limit check
	if !s.rateLimiter.Allow(fromService) {
		return nil, fmt.Errorf("rate limit exceeded for service %s", fromService)
	}

	// Create audit record
	record, err := s.repo.Create(ctx, &supabase.CreateTxRequest{
		RequestID:       req.RequestID,
		FromService:     fromService,
		TxType:          req.TxType,
		ContractAddress: req.ContractAddress,
		MethodName:      req.MethodName,
		Params:          req.Params,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create audit record: %w", err)
	}

	// Submit with retry
	txHash, err := s.submitWithRetry(ctx, fromService, req, record.ID)
	if err != nil {
		// Update status to failed
		s.repo.UpdateStatus(ctx, &supabase.UpdateTxStatusRequest{
			ID:           record.ID,
			Status:       supabase.StatusFailed,
			ErrorMessage: err.Error(),
		})

		s.mu.Lock()
		s.txsFailed++
		s.mu.Unlock()

		return &TxResponse{
			ID:          record.ID,
			Status:      string(supabase.StatusFailed),
			Error:       err.Error(),
			SubmittedAt: record.SubmittedAt,
		}, err
	}

	// Update status to submitted
	s.repo.UpdateStatus(ctx, &supabase.UpdateTxStatusRequest{
		ID:     record.ID,
		TxHash: txHash,
		Status: supabase.StatusSubmitted,
	})

	s.mu.Lock()
	s.txsSubmitted++
	record.TxHash = txHash
	record.Status = supabase.StatusSubmitted
	s.pendingTxs[record.ID] = record
	s.mu.Unlock()

	response := &TxResponse{
		ID:          record.ID,
		TxHash:      txHash,
		Status:      string(supabase.StatusSubmitted),
		SubmittedAt: record.SubmittedAt,
	}

	// Wait for confirmation if requested
	if req.WaitForConfirmation {
		if err := s.waitForConfirmation(ctx, record.ID, req.Timeout); err != nil {
			response.Error = err.Error()
		} else {
			response.Status = string(supabase.StatusConfirmed)
		}
	}

	return response, nil
}

// submitWithRetry submits a transaction with retry logic.
func (s *Service) submitWithRetry(ctx context.Context, fromService string, req *TxRequest, recordID int64) (string, error) {
	var lastErr error
	backoff := s.retryConfig.InitialBackoff

	for attempt := 0; attempt <= s.retryConfig.MaxRetries; attempt++ {
		if attempt > 0 {
			// Update retry count
			s.repo.UpdateStatus(ctx, &supabase.UpdateTxStatusRequest{
				ID:         recordID,
				RetryCount: attempt,
			})

			// Wait with backoff
			jitter := time.Duration(float64(backoff) * s.retryConfig.Jitter * (rand.Float64()*2 - 1))
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(backoff + jitter):
			}

			// Increase backoff for next attempt
			backoff = time.Duration(float64(backoff) * s.retryConfig.BackoffMultiplier)
			if backoff > s.retryConfig.MaxBackoff {
				backoff = s.retryConfig.MaxBackoff
			}
		}

		// Execute with RPC failover
		var txHash string
		var err error
		if s.rpcPool == nil {
			txHash, err = s.doSubmit(ctx, "", fromService, req)
		} else {
			poolRetries := 0
			if endpoints := s.rpcPool.GetEndpoints(); len(endpoints) > 1 {
				poolRetries = len(endpoints) - 1
			}

			err = s.rpcPool.ExecuteWithFailover(ctx, poolRetries, func(rpcURL string) error {
				// Update RPC endpoint in record
				s.repo.UpdateStatus(ctx, &supabase.UpdateTxStatusRequest{
					ID:          recordID,
					RPCEndpoint: rpcURL,
				})

				// Submit transaction via fulfiller or chain client
				hash, submitErr := s.doSubmit(ctx, rpcURL, fromService, req)
				if submitErr != nil {
					return submitErr
				}
				txHash = hash
				return nil
			})
		}

		if err == nil {
			return txHash, nil
		}

		lastErr = err
		s.Logger().Warn(ctx, "Transaction submission failed", map[string]interface{}{
			"attempt":     attempt + 1,
			"max_retries": s.retryConfig.MaxRetries,
			"error":       err.Error(),
		})
	}

	return "", fmt.Errorf("max retries exceeded: %w", lastErr)
}

// doSubmit performs the actual transaction submission.
func (s *Service) doSubmit(ctx context.Context, rpcURL string, fromService string, req *TxRequest) (string, error) {
	if s.fulfiller == nil {
		return "", fmt.Errorf("fulfiller not configured")
	}

	fulfiller := s.fulfiller
	if rpcURL != "" && s.chainClient != nil {
		client, err := s.chainClient.CloneWithRPCURL(rpcURL)
		if err != nil {
			return "", fmt.Errorf("clone chain client: %w", err)
		}
		fulfiller = fulfiller.WithClient(client)
	}

	switch req.TxType {
	case "fulfill_request", "fail_request":
		return s.submitFulfillRequest(ctx, fulfiller, req)
	case "set_tee_master_key":
		return s.submitSetTEEMasterKey(ctx, fulfiller, req)
	case "update_price", "update_prices":
		return s.submitPriceUpdate(ctx, fulfiller, req)
	case "execute_trigger":
		return s.submitExecuteTrigger(ctx, fulfiller, req)
	case "resolve_dispute":
		return s.submitResolveDispute(ctx, fulfiller, fromService, req)
	case "generic":
		return s.submitGenericInvoke(ctx, fulfiller, req)
	default:
		return "", fmt.Errorf("unsupported transaction type: %s", req.TxType)
	}
}

// submitFulfillRequest submits a fulfill/fail request transaction.
func (s *Service) submitFulfillRequest(ctx context.Context, fulfiller *chain.TEEFulfiller, req *TxRequest) (string, error) {
	switch req.TxType {
	case "fulfill_request":
		var params struct {
			RequestID *big.Int `json:"request_id"`
			Result    string   `json:"result"` // hex
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return "", fmt.Errorf("invalid params: %w", err)
		}

		result, err := hex.DecodeString(params.Result)
		if err != nil {
			return "", fmt.Errorf("invalid result hex: %w", err)
		}

		txHash, err := fulfiller.FulfillRequestNoWait(ctx, params.RequestID, result)
		if err != nil {
			return "", fmt.Errorf("fulfill request failed: %w", err)
		}

		return txHash, nil
	case "fail_request":
		var params struct {
			RequestID *big.Int `json:"request_id"`
			Reason    string   `json:"reason,omitempty"`
			// Backward compatibility for older clients that send `result`.
			Result string `json:"result,omitempty"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return "", fmt.Errorf("invalid params: %w", err)
		}

		reason := params.Reason
		if reason == "" {
			reason = params.Result
		}
		if reason == "" {
			return "", fmt.Errorf("missing reason")
		}

		txHash, err := fulfiller.FailRequestNoWait(ctx, params.RequestID, reason)
		if err != nil {
			return "", fmt.Errorf("fail request failed: %w", err)
		}
		return txHash, nil
	default:
		return "", fmt.Errorf("unsupported tx type for submitFulfillRequest: %s", req.TxType)
	}
}

// submitSetTEEMasterKey submits a set_tee_master_key transaction.
func (s *Service) submitSetTEEMasterKey(ctx context.Context, fulfiller *chain.TEEFulfiller, req *TxRequest) (string, error) {
	var params struct {
		PubKey     string `json:"pubkey"`
		PubKeyHash string `json:"pubkey_hash"`
		AttestHash string `json:"attest_hash"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return "", fmt.Errorf("invalid params: %w", err)
	}

	pubKey, err := hex.DecodeString(params.PubKey)
	if err != nil {
		return "", fmt.Errorf("invalid pubkey hex: %w", err)
	}

	pubKeyHash, err := hex.DecodeString(params.PubKeyHash)
	if err != nil {
		return "", fmt.Errorf("invalid pubkey_hash hex: %w", err)
	}

	attestHash, err := hex.DecodeString(params.AttestHash)
	if err != nil {
		return "", fmt.Errorf("invalid attest_hash hex: %w", err)
	}

	txResult, err := fulfiller.SetTEEMasterKeyNoWait(ctx, pubKey, pubKeyHash, attestHash)
	if err != nil {
		return "", fmt.Errorf("set tee master key failed: %w", err)
	}

	return txResult.TxHash, nil
}

// submitPriceUpdate submits a price update transaction.
func (s *Service) submitPriceUpdate(ctx context.Context, fulfiller *chain.TEEFulfiller, req *TxRequest) (string, error) {
	type updatePriceParams struct {
		FeedID    string `json:"feed_id"`
		Price     string `json:"price"`
		Timestamp uint64 `json:"timestamp"`
	}
	type updatePricesParams struct {
		FeedIDs    []string `json:"feed_ids"`
		Prices     []string `json:"prices"`
		Timestamps []uint64 `json:"timestamps"`
	}

	contractHash := req.ContractAddress
	if contractHash == "" {
		contractHash = chain.ContractAddressesFromEnv().NeoFeeds
	}
	if contractHash == "" {
		return "", fmt.Errorf("neofeeds contract hash not configured (set request.contract_address or CONTRACT_NEOFEEDS_HASH)")
	}

	switch req.TxType {
	case "update_price":
		var params updatePriceParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return "", fmt.Errorf("invalid params: %w", err)
		}

		price := new(big.Int)
		if _, ok := price.SetString(params.Price, 10); !ok {
			return "", fmt.Errorf("invalid price: %q", params.Price)
		}

		return fulfiller.UpdatePriceNoWait(ctx, contractHash, params.FeedID, price, params.Timestamp)
	case "update_prices":
		var params updatePricesParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return "", fmt.Errorf("invalid params: %w", err)
		}
		if len(params.FeedIDs) != len(params.Prices) || len(params.FeedIDs) != len(params.Timestamps) {
			return "", fmt.Errorf("array length mismatch")
		}

		prices := make([]*big.Int, len(params.Prices))
		for i, raw := range params.Prices {
			value := new(big.Int)
			if _, ok := value.SetString(raw, 10); !ok {
				return "", fmt.Errorf("invalid price at index %d: %q", i, raw)
			}
			prices[i] = value
		}

		return fulfiller.UpdatePricesNoWait(ctx, contractHash, params.FeedIDs, prices, params.Timestamps)
	default:
		return "", fmt.Errorf("unsupported price update tx type: %s", req.TxType)
	}
}

// submitExecuteTrigger submits an execute trigger transaction.
func (s *Service) submitExecuteTrigger(ctx context.Context, fulfiller *chain.TEEFulfiller, req *TxRequest) (string, error) {
	type executeTriggerParams struct {
		TriggerID      string `json:"trigger_id"`
		ExecutionData  string `json:"execution_data"`            // hex
		ContractHash   string `json:"contract_hash,omitempty"`   // optional override
		ContractMethod string `json:"contract_method,omitempty"` // reserved
	}

	contractHash := req.ContractAddress
	if contractHash == "" {
		contractHash = chain.ContractAddressesFromEnv().NeoFlow
	}

	var params executeTriggerParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return "", fmt.Errorf("invalid params: %w", err)
	}
	if params.ContractHash != "" {
		contractHash = params.ContractHash
	}
	if contractHash == "" {
		return "", fmt.Errorf("neoflow contract hash not configured (set request.contract_address or CONTRACT_NEOFLOW_HASH)")
	}

	triggerID := new(big.Int)
	if _, ok := triggerID.SetString(params.TriggerID, 10); !ok {
		if _, ok := triggerID.SetString(params.TriggerID, 16); !ok {
			return "", fmt.Errorf("invalid trigger_id: %q", params.TriggerID)
		}
	}

	executionData, err := hex.DecodeString(params.ExecutionData)
	if err != nil {
		return "", fmt.Errorf("invalid execution_data hex: %w", err)
	}

	return fulfiller.ExecuteTriggerNoWait(ctx, contractHash, triggerID, executionData)
}

// submitResolveDispute submits a resolve dispute transaction.
func (s *Service) submitResolveDispute(ctx context.Context, fulfiller *chain.TEEFulfiller, fromService string, req *TxRequest) (string, error) {
	type resolveDisputeParams struct {
		ServiceID       string `json:"service_id,omitempty"`
		RequestHash     string `json:"request_hash"`     // hex (32 bytes)
		CompletionProof string `json:"completion_proof"` // hex
	}

	contractHash := req.ContractAddress
	if contractHash == "" {
		contractHash = chain.ContractAddressesFromEnv().NeoVault
	}
	if contractHash == "" {
		return "", fmt.Errorf("neovault contract hash not configured (set request.contract_address or CONTRACT_NEOVAULT_HASH)")
	}

	var params resolveDisputeParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return "", fmt.Errorf("invalid params: %w", err)
	}

	serviceID := params.ServiceID
	if serviceID == "" {
		serviceID = fromService
	}

	requestHash, err := hex.DecodeString(params.RequestHash)
	if err != nil {
		return "", fmt.Errorf("invalid request_hash hex: %w", err)
	}

	completionProof, err := hex.DecodeString(params.CompletionProof)
	if err != nil {
		return "", fmt.Errorf("invalid completion_proof hex: %w", err)
	}

	return fulfiller.ResolveDisputeNoWait(ctx, contractHash, []byte(serviceID), requestHash, completionProof)
}

// submitGenericInvoke submits a generic contract invocation.
func (s *Service) submitGenericInvoke(ctx context.Context, fulfiller *chain.TEEFulfiller, req *TxRequest) (string, error) {
	if fulfiller == nil {
		return "", fmt.Errorf("fulfiller not configured")
	}
	if req.ContractAddress == "" || req.MethodName == "" {
		return "", fmt.Errorf("contract_address and method_name are required for generic invokes")
	}

	var params []chain.ContractParam
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return "", fmt.Errorf("invalid contract params: %w", err)
	}

	s.Logger().Info(ctx, "Generic invoke", map[string]interface{}{
		"contract":     req.ContractAddress,
		"method":       req.MethodName,
		"params_count": len(params),
	})

	txResult, err := fulfiller.InvokeContract(ctx, req.ContractAddress, req.MethodName, params, false)
	if err != nil {
		return "", err
	}

	return txResult.TxHash, nil
}

// =============================================================================
// Confirmation Tracking
// =============================================================================

// confirmationWorkerWithError periodically checks for transaction confirmations.
func (s *Service) confirmationWorkerWithError(ctx context.Context) error {
	s.mu.RLock()
	pending := make([]*supabase.ChainTxRecord, 0, len(s.pendingTxs))
	for _, tx := range s.pendingTxs {
		pending = append(pending, tx)
	}
	s.mu.RUnlock()

	for _, tx := range pending {
		if tx.TxHash == "" {
			continue
		}

		confirmed, gasConsumed, err := s.checkConfirmation(ctx, tx.TxHash)
		if err != nil {
			s.Logger().Debug(ctx, "Confirmation check failed", map[string]interface{}{"tx": tx.TxHash, "error": err.Error()})
			continue
		}

		if confirmed {
			now := time.Now()
			s.repo.UpdateStatus(ctx, &supabase.UpdateTxStatusRequest{
				ID:          tx.ID,
				Status:      supabase.StatusConfirmed,
				GasConsumed: gasConsumed,
				ConfirmedAt: &now,
			})

			s.mu.Lock()
			delete(s.pendingTxs, tx.ID)
			s.txsConfirmed++
			s.mu.Unlock()

			s.Logger().Info(ctx, "Transaction confirmed", map[string]interface{}{"tx": tx.TxHash, "gas": gasConsumed})
		}
	}
	return nil
}

// checkConfirmation checks if a transaction is confirmed.
func (s *Service) checkConfirmation(ctx context.Context, txHash string) (bool, int64, error) {
	if s.chainClient == nil {
		// Fallback: assume confirmed after submission
		return true, 0, nil
	}

	appLog, err := s.getApplicationLog(ctx, txHash)
	if err != nil {
		return false, 0, err
	}

	// Check if transaction succeeded
	if appLog == nil {
		return false, 0, nil
	}

	// Extract gas consumed from application log
	var gasConsumed int64
	if len(appLog.Executions) > 0 {
		exec := appLog.Executions[0]
		// Check VM state - HALT means success
		if exec.VMState != "HALT" {
			return false, 0, fmt.Errorf("transaction failed with state: %s", exec.VMState)
		}
		// Parse gas consumed from string
		if gas, err := strconv.ParseInt(exec.GasConsumed, 10, 64); err == nil {
			gasConsumed = gas
		}
	}

	return true, gasConsumed, nil
}

func (s *Service) getApplicationLog(ctx context.Context, txHash string) (*chain.ApplicationLog, error) {
	if s.chainClient == nil {
		return nil, fmt.Errorf("chain client not configured")
	}

	if s.rpcPool == nil {
		log, err := s.chainClient.GetApplicationLog(ctx, txHash)
		if err != nil {
			if isTxNotFoundError(err) {
				return nil, nil
			}
			return nil, err
		}
		return log, nil
	}

	endpoints := s.rpcPool.GetEndpoints()
	if len(endpoints) == 0 {
		log, err := s.chainClient.GetApplicationLog(ctx, txHash)
		if err != nil {
			if isTxNotFoundError(err) {
				return nil, nil
			}
			return nil, err
		}
		return log, nil
	}

	sort.Slice(endpoints, func(i, j int) bool {
		if endpoints[i].Healthy != endpoints[j].Healthy {
			return endpoints[i].Healthy
		}
		if endpoints[i].AvgLatency != endpoints[j].AvgLatency {
			return endpoints[i].AvgLatency < endpoints[j].AvgLatency
		}
		return endpoints[i].Priority < endpoints[j].Priority
	})

	var lastErr error
	notFound := false

	for _, ep := range endpoints {
		if ep.URL == "" {
			continue
		}

		start := time.Now()
		client, err := s.chainClient.CloneWithRPCURL(ep.URL)
		if err != nil {
			lastErr = err
			continue
		}

		log, err := client.GetApplicationLog(ctx, txHash)
		latency := time.Since(start)

		if err == nil {
			s.rpcPool.MarkHealthy(ep.URL, latency)
			return log, nil
		}

		if isTxNotFoundError(err) {
			s.rpcPool.MarkHealthy(ep.URL, latency)
			notFound = true
			continue
		}

		s.rpcPool.MarkUnhealthy(ep.URL)
		lastErr = err
	}

	if notFound {
		return nil, nil
	}
	if lastErr == nil {
		return nil, nil
	}
	return nil, lastErr
}

func isTxNotFoundError(err error) bool {
	rpcErr, ok := err.(*chain.RPCError)
	if !ok {
		return false
	}

	if rpcErr.Code == -100 {
		return true
	}
	msg := strings.ToLower(rpcErr.Message)
	return strings.Contains(msg, "unknown transaction")
}

// waitForConfirmation waits for a transaction to be confirmed.
func (s *Service) waitForConfirmation(ctx context.Context, recordID int64, timeout time.Duration) error {
	if timeout == 0 {
		timeout = 2 * time.Minute
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			record, err := s.repo.GetByID(ctx, recordID)
			if err != nil {
				continue
			}
			if record.Status == supabase.StatusConfirmed {
				return nil
			}
			if record.Status == supabase.StatusFailed {
				return fmt.Errorf("transaction failed: %s", record.ErrorMessage)
			}
		}
	}
}

// =============================================================================
// Logger Helper
// =============================================================================

// Logger returns the service logger.
func (s *Service) Logger() *logging.Logger {
	return s.BaseService.Logger()
}

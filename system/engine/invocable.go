// Package engine provides the service invocation framework.
// Services implement InvocableService to expose methods that can be called
// automatically by the ServiceEngine when contract events are received.
package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/R3E-Network/service_layer/system/framework"
)

// MethodResult represents the result of a service method invocation.
// If HasResult is true, the engine will send a callback transaction.
// If HasResult is false (void), no callback is sent.
type MethodResult struct {
	HasResult bool           // Whether this method returns a result
	Data      any            // The result data (nil for void methods)
	Error     error          // Error if execution failed
	Metadata  map[string]any // Additional metadata for the callback
}

// Void returns a MethodResult indicating no callback is needed.
func Void() MethodResult {
	return MethodResult{HasResult: false}
}

// Result returns a MethodResult with data that triggers a callback.
func Result(data any) MethodResult {
	return MethodResult{HasResult: true, Data: data}
}

// ResultWithMeta returns a MethodResult with data and metadata.
func ResultWithMeta(data any, meta map[string]any) MethodResult {
	return MethodResult{HasResult: true, Data: data, Metadata: meta}
}

// ErrorResult returns a MethodResult indicating an error.
func ErrorResult(err error) MethodResult {
	return MethodResult{HasResult: true, Error: err}
}

// ServiceRequest represents a request parsed from a contract event.
// The contract event must specify:
// - Service name (which service to invoke)
// - Method name (which method on the service)
// - Parameters (method arguments)
// - Callback info (where to send the result)
type ServiceRequest struct {
	// Request identification
	ID         string `json:"id"`          // Unique request ID from contract
	ExternalID string `json:"external_id"` // On-chain request ID
	TxHash     string `json:"tx_hash"`     // Originating transaction hash

	// Service routing
	ServiceName string `json:"service_name"` // Target service (e.g., "oracle", "vrf")
	MethodName  string `json:"method_name"`  // Target method (e.g., "fetch", "generate")

	// Request data
	AccountID string         `json:"account_id"` // Account making the request
	Params    map[string]any `json:"params"`     // Method parameters
	Fee       int64          `json:"fee"`        // Fee paid for this request

	// Callback configuration
	CallbackContract string `json:"callback_contract"` // Contract to call with result
	CallbackMethod   string `json:"callback_method"`   // Method to call on callback contract

	// Timing
	CreatedAt time.Time     `json:"created_at"`
	Timeout   time.Duration `json:"timeout,omitempty"` // Optional timeout
}

// CallbackSender sends callback transactions to contracts.
type CallbackSender interface {
	// SendCallback sends a result back to the contract.
	SendCallback(ctx context.Context, req *ServiceRequest, result MethodResult) error
}

// ServiceEngine manages service invocation and callback handling.
// It uses InvocableServiceV2 interface with explicit method declarations.
type ServiceEngine struct {
	services       map[string]framework.InvocableServiceV2
	callbackSender CallbackSender
	log            *logger.Logger

	// Request tracking
	pendingRequests map[string]*ServiceRequest
	requestTimeout  time.Duration

	mu      sync.RWMutex
	running bool
	stopCh  chan struct{}
	doneCh  chan struct{}

	// Metrics
	requestsProcessed int64
	requestsFailed    int64
	callbacksSent     int64
}

// ServiceEngineConfig configures the service engine.
type ServiceEngineConfig struct {
	CallbackSender CallbackSender
	Logger         *logger.Logger
	RequestTimeout time.Duration
}

// NewServiceEngine creates a new service engine.
func NewServiceEngine(cfg ServiceEngineConfig) *ServiceEngine {
	if cfg.Logger == nil {
		cfg.Logger = logger.NewDefault("service-engine")
	}
	if cfg.RequestTimeout <= 0 {
		cfg.RequestTimeout = 30 * time.Second
	}

	return &ServiceEngine{
		services:        make(map[string]framework.InvocableServiceV2),
		callbackSender:  cfg.CallbackSender,
		log:             cfg.Logger,
		pendingRequests: make(map[string]*ServiceRequest),
		requestTimeout:  cfg.RequestTimeout,
	}
}

// RegisterService registers a service with the engine.
func (e *ServiceEngine) RegisterService(svc framework.InvocableServiceV2) {
	e.mu.Lock()
	defer e.mu.Unlock()

	name := svc.ServiceName()
	e.services[name] = svc

	// Get method names from registry
	registry := svc.MethodRegistry()
	methods := registry.ListInvokeMethods()
	methodNames := make([]string, len(methods))
	for i, m := range methods {
		methodNames[i] = m.Name
	}

	e.log.WithField("service", name).
		WithField("methods", methodNames).
		Info("service registered")
}

// UnregisterService removes a service from the engine.
func (e *ServiceEngine) UnregisterService(name string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.services, name)
	e.log.WithField("service", name).Info("service unregistered")
}

// GetService returns a registered service by name.
func (e *ServiceEngine) GetService(name string) (framework.InvocableServiceV2, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	svc, ok := e.services[name]
	return svc, ok
}

// ListServices returns all registered service names.
func (e *ServiceEngine) ListServices() []string {
	e.mu.RLock()
	defer e.mu.RUnlock()

	names := make([]string, 0, len(e.services))
	for name := range e.services {
		names = append(names, name)
	}
	return names
}

// ProcessRequest processes a service request from a contract event.
// This is the main entry point for the automated workflow:
// 1. Parse the request
// 2. Find the target service
// 3. Validate method declaration
// 4. Invoke the method
// 5. Send callback based on CallbackMode
func (e *ServiceEngine) ProcessRequest(ctx context.Context, req *ServiceRequest) error {
	e.log.WithField("request_id", req.ID).
		WithField("service", req.ServiceName).
		WithField("method", req.MethodName).
		Info("processing service request")

	// Track the request
	e.mu.Lock()
	e.pendingRequests[req.ID] = req
	e.mu.Unlock()

	defer func() {
		e.mu.Lock()
		delete(e.pendingRequests, req.ID)
		e.mu.Unlock()
	}()

	// Find the service
	svc, ok := e.GetService(req.ServiceName)
	if !ok {
		e.mu.Lock()
		e.requestsFailed++
		e.mu.Unlock()
		return fmt.Errorf("service not found: %s", req.ServiceName)
	}

	// Get method declaration from registry
	registry := svc.MethodRegistry()
	methodDecl, ok := registry.GetMethod(req.MethodName)
	if !ok {
		e.mu.Lock()
		e.requestsFailed++
		e.mu.Unlock()
		return fmt.Errorf("method not found: %s.%s", req.ServiceName, req.MethodName)
	}

	// Check if init method (should not be invoked directly)
	if methodDecl.IsInit() {
		e.mu.Lock()
		e.requestsFailed++
		e.mu.Unlock()
		return fmt.Errorf("init method cannot be invoked directly: %s.%s", req.ServiceName, req.MethodName)
	}

	// Apply timeout if configured
	if req.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, req.Timeout)
		defer cancel()
	} else if methodDecl.MaxExecutionTime > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(methodDecl.MaxExecutionTime)*time.Millisecond)
		defer cancel()
	}

	// Invoke the method
	result, err := svc.Invoke(ctx, req.MethodName, req.Params)

	e.mu.Lock()
	e.requestsProcessed++
	e.mu.Unlock()

	// Handle errors
	if err != nil {
		e.mu.Lock()
		e.requestsFailed++
		e.mu.Unlock()

		e.log.WithField("request_id", req.ID).
			WithField("service", req.ServiceName).
			WithField("method", req.MethodName).
			WithError(err).
			Error("service method failed")

		// Send error callback if callback mode requires it
		if shouldSendCallback(methodDecl, true) && req.CallbackContract != "" && e.callbackSender != nil {
			errResult := MethodResult{HasResult: true, Error: err}
			if sendErr := e.callbackSender.SendCallback(ctx, req, errResult); sendErr != nil {
				e.log.WithError(sendErr).Error("failed to send error callback")
			}
		}

		return err
	}

	// Determine if callback should be sent based on CallbackMode
	methodResult := MethodResult{HasResult: result != nil, Data: result}
	if shouldSendCallback(methodDecl, false) && req.CallbackContract != "" && e.callbackSender != nil {
		if err := e.callbackSender.SendCallback(ctx, req, methodResult); err != nil {
			e.log.WithField("request_id", req.ID).
				WithError(err).
				Error("failed to send callback")
			return fmt.Errorf("callback failed: %w", err)
		}

		e.mu.Lock()
		e.callbacksSent++
		e.mu.Unlock()

		e.log.WithField("request_id", req.ID).
			WithField("callback_contract", req.CallbackContract).
			WithField("callback_method", req.CallbackMethod).
			Info("callback sent")
	}

	return nil
}

// shouldSendCallback determines if a callback should be sent based on method declaration.
func shouldSendCallback(decl *framework.MethodDeclaration, isError bool) bool {
	switch decl.CallbackMode {
	case framework.CallbackNone:
		return false
	case framework.CallbackRequired:
		return true
	case framework.CallbackOptional:
		return !isError
	case framework.CallbackOnError:
		return isError
	default:
		return decl.NeedsCallback()
	}
}

// ParseRequestFromEvent parses a ServiceRequest from a contract event.
// The event state must contain:
// - service: service name
// - method: method name
// - params: method parameters (JSON or map)
// - callback_contract: (optional) contract to call with result
// - callback_method: (optional) method to call
func ParseRequestFromEvent(event map[string]any) (*ServiceRequest, error) {
	req := &ServiceRequest{
		CreatedAt: time.Now().UTC(),
		Params:    make(map[string]any),
	}

	// Required fields
	if id, ok := event["id"].(string); ok {
		req.ID = id
		req.ExternalID = id
	} else if id, ok := event["request_id"].(string); ok {
		req.ID = id
		req.ExternalID = id
	} else {
		return nil, fmt.Errorf("missing request id")
	}

	if svc, ok := event["service"].(string); ok {
		req.ServiceName = svc
	} else if svc, ok := event["service_name"].(string); ok {
		req.ServiceName = svc
	} else {
		return nil, fmt.Errorf("missing service name")
	}

	if method, ok := event["method"].(string); ok {
		req.MethodName = method
	} else if method, ok := event["method_name"].(string); ok {
		req.MethodName = method
	} else {
		return nil, fmt.Errorf("missing method name")
	}

	// Optional fields
	if txHash, ok := event["tx_hash"].(string); ok {
		req.TxHash = txHash
	}

	if accountID, ok := event["account_id"].(string); ok {
		req.AccountID = accountID
	}

	if fee, ok := event["fee"].(float64); ok {
		req.Fee = int64(fee)
	} else if fee, ok := event["fee"].(int64); ok {
		req.Fee = fee
	}

	// Parse params
	if params, ok := event["params"].(map[string]any); ok {
		req.Params = params
	} else if paramsStr, ok := event["params"].(string); ok {
		if err := json.Unmarshal([]byte(paramsStr), &req.Params); err != nil {
			// Treat as single param
			req.Params["data"] = paramsStr
		}
	}

	// Callback configuration
	if callback, ok := event["callback_contract"].(string); ok {
		req.CallbackContract = callback
	} else if callback, ok := event["callback"].(string); ok {
		req.CallbackContract = callback
	}

	if method, ok := event["callback_method"].(string); ok {
		req.CallbackMethod = method
	} else {
		// Default callback method based on service
		req.CallbackMethod = "fulfill"
	}

	return req, nil
}

// Stats returns engine statistics.
type EngineStats struct {
	Running           bool     `json:"running"`
	ServicesCount     int      `json:"services_count"`
	Services          []string `json:"services"`
	PendingRequests   int      `json:"pending_requests"`
	RequestsProcessed int64    `json:"requests_processed"`
	RequestsFailed    int64    `json:"requests_failed"`
	CallbacksSent     int64    `json:"callbacks_sent"`
}

func (e *ServiceEngine) Stats() EngineStats {
	e.mu.RLock()
	defer e.mu.RUnlock()

	services := make([]string, 0, len(e.services))
	for name := range e.services {
		services = append(services, name)
	}

	return EngineStats{
		Running:           e.running,
		ServicesCount:     len(e.services),
		Services:          services,
		PendingRequests:   len(e.pendingRequests),
		RequestsProcessed: e.requestsProcessed,
		RequestsFailed:    e.requestsFailed,
		CallbacksSent:     e.callbacksSent,
	}
}

// Start begins the service engine.
func (e *ServiceEngine) Start(ctx context.Context) error {
	e.mu.Lock()
	if e.running {
		e.mu.Unlock()
		return nil
	}
	e.running = true
	e.stopCh = make(chan struct{})
	e.doneCh = make(chan struct{})
	e.mu.Unlock()

	e.log.WithField("services", len(e.services)).Info("service engine started")
	return nil
}

// Stop halts the service engine.
func (e *ServiceEngine) Stop() {
	e.mu.Lock()
	if !e.running {
		e.mu.Unlock()
		return
	}
	e.running = false
	close(e.stopCh)
	e.mu.Unlock()

	e.log.Info("service engine stopped")
}

// MethodInfo returns information about a service method.
func (e *ServiceEngine) MethodInfo(serviceName, methodName string) (*framework.MethodDeclaration, error) {
	svc, ok := e.GetService(serviceName)
	if !ok {
		return nil, fmt.Errorf("service not found: %s", serviceName)
	}

	registry := svc.MethodRegistry()
	decl, ok := registry.GetMethod(methodName)
	if !ok {
		return nil, fmt.Errorf("method not found: %s.%s", serviceName, methodName)
	}

	return decl, nil
}

// ValidateRequest validates a service request before processing.
func (e *ServiceEngine) ValidateRequest(req *ServiceRequest) error {
	if req.ID == "" {
		return fmt.Errorf("request ID is required")
	}
	if req.ServiceName == "" {
		return fmt.Errorf("service name is required")
	}
	if req.MethodName == "" {
		return fmt.Errorf("method name is required")
	}

	// Check service exists
	svc, ok := e.GetService(req.ServiceName)
	if !ok {
		return fmt.Errorf("service not found: %s", req.ServiceName)
	}

	// Check method exists
	registry := svc.MethodRegistry()
	if !registry.HasMethod(req.MethodName) {
		return fmt.Errorf("method not found: %s.%s", req.ServiceName, req.MethodName)
	}

	return nil
}

// GetMethodDeclarations returns all method declarations for a service.
func (e *ServiceEngine) GetMethodDeclarations(serviceName string) ([]*framework.MethodDeclaration, error) {
	svc, ok := e.GetService(serviceName)
	if !ok {
		return nil, fmt.Errorf("service not found: %s", serviceName)
	}

	registry := svc.MethodRegistry()
	return registry.ListMethods(), nil
}

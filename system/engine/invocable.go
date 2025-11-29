// Package engine provides the service invocation framework.
// Services implement InvocableService to expose methods that can be called
// automatically by the ServiceEngine when contract events are received.
package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/pkg/logger"
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
	CreatedAt time.Time `json:"created_at"`
	Timeout   time.Duration `json:"timeout,omitempty"` // Optional timeout
}

// ServiceMethod defines a method that can be invoked on a service.
type ServiceMethod struct {
	Name        string   // Method name
	Description string   // Human-readable description
	ParamNames  []string // Expected parameter names
	HasCallback bool     // Whether this method returns a result
}

// InvocableService is implemented by services that can be invoked by the engine.
// Each service exposes a set of methods that can be called with parameters
// and optionally return results.
type InvocableService interface {
	// ServiceName returns the unique service identifier.
	ServiceName() string

	// Methods returns the list of methods this service exposes.
	Methods() []ServiceMethod

	// Invoke calls a method with the given parameters.
	// The method name and params come from the contract event.
	// Returns MethodResult which may trigger a callback transaction.
	Invoke(ctx context.Context, method string, params map[string]any) MethodResult
}

// CallbackSender sends callback transactions to contracts.
type CallbackSender interface {
	// SendCallback sends a result back to the contract.
	SendCallback(ctx context.Context, req *ServiceRequest, result MethodResult) error
}

// ServiceEngine manages service invocation and callback handling.
type ServiceEngine struct {
	services       map[string]InvocableService
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
		services:        make(map[string]InvocableService),
		callbackSender:  cfg.CallbackSender,
		log:             cfg.Logger,
		pendingRequests: make(map[string]*ServiceRequest),
		requestTimeout:  cfg.RequestTimeout,
	}
}

// RegisterService registers a service with the engine.
func (e *ServiceEngine) RegisterService(svc InvocableService) {
	e.mu.Lock()
	defer e.mu.Unlock()

	name := svc.ServiceName()
	e.services[name] = svc

	methods := svc.Methods()
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
func (e *ServiceEngine) GetService(name string) (InvocableService, bool) {
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
// 3. Invoke the method
// 4. Send callback if result is returned
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

	// Validate method exists
	methods := svc.Methods()
	var methodFound bool
	for _, m := range methods {
		if strings.EqualFold(m.Name, req.MethodName) {
			methodFound = true
			break
		}
	}
	if !methodFound {
		e.mu.Lock()
		e.requestsFailed++
		e.mu.Unlock()
		return fmt.Errorf("method not found: %s.%s", req.ServiceName, req.MethodName)
	}

	// Apply timeout if configured
	if req.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, req.Timeout)
		defer cancel()
	}

	// Invoke the method
	result := svc.Invoke(ctx, req.MethodName, req.Params)

	e.mu.Lock()
	e.requestsProcessed++
	e.mu.Unlock()

	// Handle errors
	if result.Error != nil {
		e.mu.Lock()
		e.requestsFailed++
		e.mu.Unlock()

		e.log.WithField("request_id", req.ID).
			WithField("service", req.ServiceName).
			WithField("method", req.MethodName).
			WithError(result.Error).
			Error("service method failed")

		// Still send callback with error if callback is configured
		if req.CallbackContract != "" && e.callbackSender != nil {
			if err := e.callbackSender.SendCallback(ctx, req, result); err != nil {
				e.log.WithError(err).Error("failed to send error callback")
			}
		}

		return result.Error
	}

	// Send callback if method returns a result
	if result.HasResult && req.CallbackContract != "" && e.callbackSender != nil {
		if err := e.callbackSender.SendCallback(ctx, req, result); err != nil {
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
func (e *ServiceEngine) MethodInfo(serviceName, methodName string) (*ServiceMethod, error) {
	svc, ok := e.GetService(serviceName)
	if !ok {
		return nil, fmt.Errorf("service not found: %s", serviceName)
	}

	for _, m := range svc.Methods() {
		if strings.EqualFold(m.Name, methodName) {
			return &m, nil
		}
	}

	return nil, fmt.Errorf("method not found: %s.%s", serviceName, methodName)
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
	methods := svc.Methods()
	for _, m := range methods {
		if strings.EqualFold(m.Name, req.MethodName) {
			return nil
		}
	}

	return fmt.Errorf("method not found: %s.%s", req.ServiceName, req.MethodName)
}

// ReflectMethods uses reflection to discover methods on a service.
// This is a helper for services that want to auto-register methods.
func ReflectMethods(svc any) []ServiceMethod {
	var methods []ServiceMethod

	t := reflect.TypeOf(svc)
	for i := 0; i < t.NumMethod(); i++ {
		m := t.Method(i)

		// Skip unexported methods
		if !m.IsExported() {
			continue
		}

		// Skip common methods
		switch m.Name {
		case "ServiceName", "Methods", "Invoke", "Start", "Stop", "Ready", "Name", "Domain", "Manifest":
			continue
		}

		methods = append(methods, ServiceMethod{
			Name:        m.Name,
			Description: fmt.Sprintf("Method %s", m.Name),
			HasCallback: true, // Default to true; services can override
		})
	}

	return methods
}

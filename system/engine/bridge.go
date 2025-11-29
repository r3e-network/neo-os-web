// Package engine provides the ServiceBridge that connects contract events to the ServiceEngine.
// This is the glue between the blockchain (IndexerBridge) and the service execution layer.
package engine

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/pkg/logger"
)

// ContractEventType defines the type of contract event.
type ContractEventType string

const (
	// Standard service request events
	EventTypeServiceRequest ContractEventType = "ServiceRequest"

	// Legacy event types (mapped to ServiceRequest)
	EventTypeOracleRequested     ContractEventType = "OracleRequested"
	EventTypeRandomnessRequested ContractEventType = "RandomnessRequested"
	EventTypeJobDue              ContractEventType = "JobDue"
	EventTypeFeedRequested       ContractEventType = "FeedRequested"
)

// ContractEventData represents parsed contract event data.
type ContractEventData struct {
	TxHash    string
	Contract  string
	EventName string
	Height    int64
	Timestamp time.Time
	State     map[string]any
}

// ServiceBridge connects contract events to the ServiceEngine.
// It parses events, creates ServiceRequests, and dispatches them for processing.
type ServiceBridge struct {
	engine         *ServiceEngine
	log            *logger.Logger

	// Contract to service mapping
	contractServices map[string]string // contract hash -> service name

	// Event name to method mapping
	eventMethods map[string]EventMethodMapping

	mu      sync.RWMutex
	running bool
}

// EventMethodMapping maps an event name to a service method.
type EventMethodMapping struct {
	ServiceName    string
	MethodName     string
	ParamExtractor func(map[string]any) map[string]any
}

// ServiceBridgeConfig configures the service bridge.
type ServiceBridgeConfig struct {
	Engine *ServiceEngine
	Logger *logger.Logger
}

// NewServiceBridge creates a new service bridge.
func NewServiceBridge(cfg ServiceBridgeConfig) *ServiceBridge {
	if cfg.Logger == nil {
		cfg.Logger = logger.NewDefault("service-bridge")
	}

	bridge := &ServiceBridge{
		engine:           cfg.Engine,
		log:              cfg.Logger,
		contractServices: make(map[string]string),
		eventMethods:     make(map[string]EventMethodMapping),
	}

	// Register default event mappings
	bridge.registerDefaultMappings()

	return bridge
}

// registerDefaultMappings registers the default event-to-method mappings.
func (b *ServiceBridge) registerDefaultMappings() {
	// Oracle events
	b.eventMethods["OracleRequested"] = EventMethodMapping{
		ServiceName: "oracle",
		MethodName:  "fetch",
		ParamExtractor: func(state map[string]any) map[string]any {
			return map[string]any{
				"url":    state["url"],
				"method": state["http_method"],
				"body":   state["body"],
			}
		},
	}

	// VRF events
	b.eventMethods["RandomnessRequested"] = EventMethodMapping{
		ServiceName: "vrf",
		MethodName:  "generate",
		ParamExtractor: func(state map[string]any) map[string]any {
			return map[string]any{
				"seed":      state["seed"],
				"num_words": state["num_words"],
			}
		},
	}

	// Automation events
	b.eventMethods["JobDue"] = EventMethodMapping{
		ServiceName: "automation",
		MethodName:  "execute",
		ParamExtractor: func(state map[string]any) map[string]any {
			return map[string]any{
				"job_id":  state["job_id"],
				"payload": state["payload"],
			}
		},
	}

	// Generic ServiceRequest event (new format)
	b.eventMethods["ServiceRequest"] = EventMethodMapping{
		ServiceName: "", // Extracted from event
		MethodName:  "", // Extracted from event
		ParamExtractor: func(state map[string]any) map[string]any {
			if params, ok := state["params"].(map[string]any); ok {
				return params
			}
			return state
		},
	}
}

// RegisterContract registers a contract hash with its service.
func (b *ServiceBridge) RegisterContract(contractHash, serviceName string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.contractServices[strings.ToLower(contractHash)] = serviceName
	b.log.WithField("contract", contractHash).
		WithField("service", serviceName).
		Info("contract registered")
}

// RegisterEventMapping registers a custom event-to-method mapping.
func (b *ServiceBridge) RegisterEventMapping(eventName string, mapping EventMethodMapping) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.eventMethods[eventName] = mapping
	b.log.WithField("event", eventName).
		WithField("service", mapping.ServiceName).
		WithField("method", mapping.MethodName).
		Info("event mapping registered")
}

// HandleEvent processes a contract event and dispatches it to the ServiceEngine.
// This is the main entry point called by the IndexerBridge.
func (b *ServiceBridge) HandleEvent(ctx context.Context, event *ContractEventData) error {
	b.log.WithField("event", event.EventName).
		WithField("contract", event.Contract).
		WithField("tx", event.TxHash).
		Debug("handling contract event")

	// Parse the event into a ServiceRequest
	req, err := b.parseEvent(event)
	if err != nil {
		b.log.WithField("event", event.EventName).
			WithError(err).
			Warn("failed to parse event")
		return err
	}

	if req == nil {
		// Event doesn't map to a service request
		return nil
	}

	// Validate the request
	if err := b.engine.ValidateRequest(req); err != nil {
		b.log.WithField("request_id", req.ID).
			WithError(err).
			Warn("invalid service request")
		return err
	}

	// Process the request
	return b.engine.ProcessRequest(ctx, req)
}

// parseEvent parses a contract event into a ServiceRequest.
func (b *ServiceBridge) parseEvent(event *ContractEventData) (*ServiceRequest, error) {
	// Check for new-style ServiceRequest event
	if event.EventName == "ServiceRequest" {
		return b.parseServiceRequestEvent(event)
	}

	// Check for legacy event mappings
	b.mu.RLock()
	mapping, ok := b.eventMethods[event.EventName]
	b.mu.RUnlock()

	if !ok {
		// Unknown event type, skip
		return nil, nil
	}

	// Determine service name
	serviceName := mapping.ServiceName
	if serviceName == "" {
		// Try to get from contract mapping
		b.mu.RLock()
		serviceName = b.contractServices[strings.ToLower(event.Contract)]
		b.mu.RUnlock()
	}

	if serviceName == "" {
		return nil, fmt.Errorf("cannot determine service for event %s", event.EventName)
	}

	// Extract request ID
	requestID := extractRequestID(event.State)
	if requestID == "" {
		return nil, fmt.Errorf("missing request ID in event")
	}

	// Extract parameters
	params := event.State
	if mapping.ParamExtractor != nil {
		params = mapping.ParamExtractor(event.State)
	}

	// Build the request
	req := &ServiceRequest{
		ID:               requestID,
		ExternalID:       requestID,
		TxHash:           event.TxHash,
		ServiceName:      serviceName,
		MethodName:       mapping.MethodName,
		AccountID:        extractString(event.State, "account_id", "service_id"),
		Params:           params,
		Fee:              extractInt64(event.State, "fee"),
		CallbackContract: event.Contract,
		CallbackMethod:   "fulfill",
		CreatedAt:        event.Timestamp,
	}

	return req, nil
}

// parseServiceRequestEvent parses the new-style ServiceRequest event.
// Event format:
// {
//   "id": "request-123",
//   "service": "oracle",
//   "method": "fetch",
//   "params": { ... },
//   "callback_contract": "0x...",
//   "callback_method": "fulfill"
// }
func (b *ServiceBridge) parseServiceRequestEvent(event *ContractEventData) (*ServiceRequest, error) {
	state := event.State

	// Required fields
	requestID := extractString(state, "id", "request_id")
	if requestID == "" {
		return nil, fmt.Errorf("missing request ID")
	}

	serviceName := extractString(state, "service", "service_name")
	if serviceName == "" {
		return nil, fmt.Errorf("missing service name")
	}

	methodName := extractString(state, "method", "method_name")
	if methodName == "" {
		return nil, fmt.Errorf("missing method name")
	}

	// Extract params
	var params map[string]any
	if p, ok := state["params"].(map[string]any); ok {
		params = p
	} else if pStr, ok := state["params"].(string); ok {
		// Try to parse as JSON
		if err := json.Unmarshal([]byte(pStr), &params); err != nil {
			params = map[string]any{"data": pStr}
		}
	} else {
		params = make(map[string]any)
	}

	// Callback configuration
	callbackContract := extractString(state, "callback_contract", "callback")
	if callbackContract == "" {
		callbackContract = event.Contract // Default to source contract
	}

	callbackMethod := extractString(state, "callback_method")
	if callbackMethod == "" {
		callbackMethod = "fulfill" // Default callback method
	}

	return &ServiceRequest{
		ID:               requestID,
		ExternalID:       requestID,
		TxHash:           event.TxHash,
		ServiceName:      serviceName,
		MethodName:       methodName,
		AccountID:        extractString(state, "account_id", "sender"),
		Params:           params,
		Fee:              extractInt64(state, "fee"),
		CallbackContract: callbackContract,
		CallbackMethod:   callbackMethod,
		CreatedAt:        event.Timestamp,
	}, nil
}

// Helper functions

func extractRequestID(state map[string]any) string {
	// Try various field names
	for _, key := range []string{"id", "request_id", "requestId", "ID"} {
		if v, ok := state[key]; ok {
			switch val := v.(type) {
			case string:
				return val
			case []byte:
				return string(val)
			}
		}
	}
	return ""
}

func extractString(state map[string]any, keys ...string) string {
	for _, key := range keys {
		if v, ok := state[key]; ok {
			switch val := v.(type) {
			case string:
				return val
			case []byte:
				return string(val)
			}
		}
	}
	return ""
}

func extractInt64(state map[string]any, keys ...string) int64 {
	for _, key := range keys {
		if v, ok := state[key]; ok {
			switch val := v.(type) {
			case int64:
				return val
			case int:
				return int64(val)
			case float64:
				return int64(val)
			case string:
				// Try to parse
				var i int64
				fmt.Sscanf(val, "%d", &i)
				return i
			}
		}
	}
	return 0
}

// DecodeBase64Value decodes a base64-encoded value from Neo events.
func DecodeBase64Value(value any) (string, error) {
	switch v := value.(type) {
	case string:
		decoded, err := base64.StdEncoding.DecodeString(v)
		if err != nil {
			return v, nil // Return as-is if not base64
		}
		return string(decoded), nil
	case []byte:
		return string(v), nil
	default:
		return fmt.Sprintf("%v", v), nil
	}
}

// Stats returns bridge statistics.
type BridgeStats struct {
	ContractsRegistered int      `json:"contracts_registered"`
	EventMappings       int      `json:"event_mappings"`
	Services            []string `json:"services"`
}

func (b *ServiceBridge) Stats() BridgeStats {
	b.mu.RLock()
	defer b.mu.RUnlock()

	services := make(map[string]bool)
	for _, svc := range b.contractServices {
		services[svc] = true
	}
	for _, mapping := range b.eventMethods {
		if mapping.ServiceName != "" {
			services[mapping.ServiceName] = true
		}
	}

	serviceList := make([]string, 0, len(services))
	for svc := range services {
		serviceList = append(serviceList, svc)
	}

	return BridgeStats{
		ContractsRegistered: len(b.contractServices),
		EventMappings:       len(b.eventMethods),
		Services:            serviceList,
	}
}

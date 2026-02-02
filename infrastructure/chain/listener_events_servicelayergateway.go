package chain

import "fmt"

// =============================================================================
// ServiceLayerGateway Events
// =============================================================================

// ServiceRequestedEvent represents a ServiceRequested event.
// Event: ServiceRequested(requestId, appId, serviceType, requester, callbackContract, callbackMethod, payload)
type ServiceRequestedEvent struct {
	ChainID          string
	RequestID        string
	AppID            string
	ServiceType      string
	Requester        string
	CallbackContract string
	CallbackMethod   string
	Payload          []byte
}

func ParseServiceRequestedEvent(event *ContractEvent) (*ServiceRequestedEvent, error) {
	if event.EventName != "ServiceRequested" {
		return nil, fmt.Errorf("not a ServiceRequested event")
	}
	if len(event.State) < 7 {
		return nil, fmt.Errorf("invalid event state: expected 7 items, got %d", len(event.State))
	}

	requestID, err := ParseInteger(event.State[0])
	if err != nil {
		return nil, fmt.Errorf("parse requestId: %w", err)
	}

	appID, err := ParseStringFromItem(event.State[1])
	if err != nil {
		return nil, fmt.Errorf("parse appId: %w", err)
	}

	serviceType, err := ParseStringFromItem(event.State[2])
	if err != nil {
		return nil, fmt.Errorf("parse serviceType: %w", err)
	}

	requester, err := ParseHash160(event.State[3])
	if err != nil {
		return nil, fmt.Errorf("parse requester: %w", err)
	}

	callbackContract, err := ParseHash160(event.State[4])
	if err != nil {
		return nil, fmt.Errorf("parse callbackContract: %w", err)
	}

	callbackMethod, err := ParseStringFromItem(event.State[5])
	if err != nil {
		return nil, fmt.Errorf("parse callbackMethod: %w", err)
	}

	payload, err := ParseByteArray(event.State[6])
	if err != nil {
		return nil, fmt.Errorf("parse payload: %w", err)
	}

	return &ServiceRequestedEvent{
		ChainID:          event.ChainID,
		RequestID:        requestID.String(),
		AppID:            appID,
		ServiceType:      serviceType,
		Requester:        requester,
		CallbackContract: callbackContract,
		CallbackMethod:   callbackMethod,
		Payload:          payload,
	}, nil
}

// ServiceFulfilledEvent represents a ServiceFulfilled event.
// Event: ServiceFulfilled(requestId, success, result, error)
type ServiceFulfilledEvent struct {
	ChainID   string
	RequestID string
	Success   bool
	Result    []byte
	Error     string
}

func ParseServiceFulfilledEvent(event *ContractEvent) (*ServiceFulfilledEvent, error) {
	if event.EventName != "ServiceFulfilled" {
		return nil, fmt.Errorf("not a ServiceFulfilled event")
	}
	if len(event.State) < 4 {
		return nil, fmt.Errorf("invalid event state: expected 4 items, got %d", len(event.State))
	}

	requestID, err := ParseInteger(event.State[0])
	if err != nil {
		return nil, fmt.Errorf("parse requestId: %w", err)
	}

	success, err := ParseBoolean(event.State[1])
	if err != nil {
		return nil, fmt.Errorf("parse success: %w", err)
	}

	result, err := ParseByteArray(event.State[2])
	if err != nil {
		return nil, fmt.Errorf("parse result: %w", err)
	}

	errorMsg, err := ParseStringFromItem(event.State[3])
	if err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}

	return &ServiceFulfilledEvent{
		ChainID:   event.ChainID,
		RequestID: requestID.String(),
		Success:   success,
		Result:    result,
		Error:     errorMsg,
	}, nil
}

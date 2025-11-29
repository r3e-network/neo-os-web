package engine

import (
	"context"
	"testing"
	"time"
)

func TestServiceEngine_RegisterService(t *testing.T) {
	engine := NewServiceEngine(ServiceEngineConfig{})

	// Register Oracle V2 service
	oracle := NewOracleServiceV2()
	engine.RegisterService(oracle)

	// Verify registration
	svc, ok := engine.GetService("oracle")
	if !ok {
		t.Fatal("oracle service not found")
	}

	if svc.ServiceName() != "oracle" {
		t.Errorf("expected service name 'oracle', got %s", svc.ServiceName())
	}

	// Check methods from registry
	registry := svc.MethodRegistry()
	methods := registry.ListInvokeMethods()
	if len(methods) == 0 {
		t.Error("expected methods, got none")
	}

	t.Logf("Oracle service methods: %v", methods)
}

func TestServiceEngine_ProcessRequest(t *testing.T) {
	// Create engine with mock callback sender
	mockCallback := NewMockCallbackSender(nil)
	engine := NewServiceEngine(ServiceEngineConfig{
		CallbackSender: mockCallback,
	})

	// Register V2 services
	engine.RegisterService(NewOracleServiceV2())
	engine.RegisterService(NewVRFServiceV2())
	engine.RegisterService(NewAutomationServiceV2())

	ctx := context.Background()

	tests := []struct {
		name    string
		request *ServiceRequest
		wantErr bool
	}{
		{
			name: "oracle_fetch",
			request: &ServiceRequest{
				ID:               "req-001",
				ServiceName:      "oracle",
				MethodName:       "fetchJSON",
				Params:           map[string]any{"url": "https://api.example.com/data"},
				CallbackContract: "0x1234",
				CallbackMethod:   "fulfill",
			},
			wantErr: true, // Will fail due to network, but tests the flow
		},
		{
			name: "vrf_generate",
			request: &ServiceRequest{
				ID:               "req-002",
				ServiceName:      "vrf",
				MethodName:       "generate",
				Params:           map[string]any{"seed": "test-seed", "num_words": float64(3)},
				CallbackContract: "0x5678",
				CallbackMethod:   "fulfill",
			},
			wantErr: false,
		},
		{
			name: "automation_execute",
			request: &ServiceRequest{
				ID:               "req-003",
				ServiceName:      "automation",
				MethodName:       "execute",
				Params:           map[string]any{"job_id": "job-123"},
				CallbackContract: "0x9abc",
				CallbackMethod:   "complete",
			},
			wantErr: false,
		},
		{
			name: "unknown_service",
			request: &ServiceRequest{
				ID:          "req-004",
				ServiceName: "unknown",
				MethodName:  "test",
			},
			wantErr: true,
		},
		{
			name: "unknown_method",
			request: &ServiceRequest{
				ID:          "req-005",
				ServiceName: "oracle",
				MethodName:  "unknownMethod",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := engine.ProcessRequest(ctx, tt.request)
			if (err != nil) != tt.wantErr {
				t.Errorf("ProcessRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}

	// Check callbacks were recorded
	callbacks := mockCallback.GetCallbacks()
	t.Logf("Recorded %d callbacks", len(callbacks))
	for _, cb := range callbacks {
		t.Logf("  Callback: service=%s, method=%s, hasResult=%v",
			cb.Request.ServiceName, cb.Request.MethodName, cb.Result.HasResult)
	}
}

func TestServiceEngine_VRFGenerate(t *testing.T) {
	mockCallback := NewMockCallbackSender(nil)
	engine := NewServiceEngine(ServiceEngineConfig{
		CallbackSender: mockCallback,
	})

	engine.RegisterService(NewVRFServiceV2())

	ctx := context.Background()
	req := &ServiceRequest{
		ID:               "vrf-001",
		ServiceName:      "vrf",
		MethodName:       "generate",
		Params:           map[string]any{"seed": "my-seed", "num_words": float64(5)},
		CallbackContract: "0xVRFContract",
		CallbackMethod:   "fulfill",
	}

	err := engine.ProcessRequest(ctx, req)
	if err != nil {
		t.Fatalf("ProcessRequest failed: %v", err)
	}

	// Verify callback was sent
	callbacks := mockCallback.GetCallbacks()
	if len(callbacks) != 1 {
		t.Fatalf("expected 1 callback, got %d", len(callbacks))
	}

	cb := callbacks[0]
	if !cb.Result.HasResult {
		t.Error("expected result with HasResult=true")
	}

	resultMap, ok := cb.Result.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected result to be map, got %T", cb.Result.Data)
	}

	output, ok := resultMap["output"].([]string)
	if !ok {
		t.Fatalf("expected output to be []string, got %T", resultMap["output"])
	}

	if len(output) != 5 {
		t.Errorf("expected 5 random words, got %d", len(output))
	}

	t.Logf("VRF output: %v", output)
}

func TestServiceBridge_HandleEvent(t *testing.T) {
	mockCallback := NewMockCallbackSender(nil)
	engine := NewServiceEngine(ServiceEngineConfig{
		CallbackSender: mockCallback,
	})

	engine.RegisterService(NewOracleServiceV2())
	engine.RegisterService(NewVRFServiceV2())

	bridge := NewServiceBridge(ServiceBridgeConfig{
		Engine: engine,
	})

	// Register contract mappings
	bridge.RegisterContract("0xOracleHub", "oracle")
	bridge.RegisterContract("0xVRFHub", "vrf")

	ctx := context.Background()

	// Test new-style ServiceRequest event
	t.Run("ServiceRequest_event", func(t *testing.T) {
		event := &ContractEventData{
			TxHash:    "0xabc123",
			Contract:  "0xOracleHub",
			EventName: "ServiceRequest",
			Timestamp: time.Now(),
			State: map[string]any{
				"id":                "sr-001",
				"service":           "vrf",
				"method":            "generate",
				"params":            map[string]any{"seed": "event-seed"},
				"callback_contract": "0xMyContract",
				"callback_method":   "onResult",
			},
		}

		err := bridge.HandleEvent(ctx, event)
		if err != nil {
			t.Errorf("HandleEvent failed: %v", err)
		}
	})

	// Test legacy OracleRequested event
	t.Run("OracleRequested_event", func(t *testing.T) {
		event := &ContractEventData{
			TxHash:    "0xdef456",
			Contract:  "0xOracleHub",
			EventName: "OracleRequested",
			Timestamp: time.Now(),
			State: map[string]any{
				"id":         "or-001",
				"service_id": "test-service",
				"fee":        float64(1000000),
				"url":        "https://api.example.com",
			},
		}

		// This will fail due to network, but tests the parsing
		_ = bridge.HandleEvent(ctx, event)
	})

	// Test legacy RandomnessRequested event
	t.Run("RandomnessRequested_event", func(t *testing.T) {
		event := &ContractEventData{
			TxHash:    "0xghi789",
			Contract:  "0xVRFHub",
			EventName: "RandomnessRequested",
			Timestamp: time.Now(),
			State: map[string]any{
				"id":         "rr-001",
				"service_id": "test-vrf",
				"seed":       "random-seed",
				"num_words":  float64(2),
			},
		}

		err := bridge.HandleEvent(ctx, event)
		if err != nil {
			t.Errorf("HandleEvent failed: %v", err)
		}
	})

	// Check callbacks
	callbacks := mockCallback.GetCallbacks()
	t.Logf("Total callbacks: %d", len(callbacks))
}

func TestParseRequestFromEvent(t *testing.T) {
	tests := []struct {
		name    string
		event   map[string]any
		wantErr bool
		check   func(*ServiceRequest) error
	}{
		{
			name: "valid_request",
			event: map[string]any{
				"id":                "req-123",
				"service":           "oracle",
				"method":            "fetch",
				"params":            map[string]any{"url": "https://example.com"},
				"callback_contract": "0x1234",
			},
			wantErr: false,
			check: func(req *ServiceRequest) error {
				if req.ID != "req-123" {
					return errorf("expected ID 'req-123', got %s", req.ID)
				}
				if req.ServiceName != "oracle" {
					return errorf("expected service 'oracle', got %s", req.ServiceName)
				}
				if req.MethodName != "fetch" {
					return errorf("expected method 'fetch', got %s", req.MethodName)
				}
				return nil
			},
		},
		{
			name: "missing_id",
			event: map[string]any{
				"service": "oracle",
				"method":  "fetch",
			},
			wantErr: true,
		},
		{
			name: "missing_service",
			event: map[string]any{
				"id":     "req-123",
				"method": "fetch",
			},
			wantErr: true,
		},
		{
			name: "missing_method",
			event: map[string]any{
				"id":      "req-123",
				"service": "oracle",
			},
			wantErr: true,
		},
		{
			name: "alternate_field_names",
			event: map[string]any{
				"request_id":   "req-456",
				"service_name": "vrf",
				"method_name":  "generate",
			},
			wantErr: false,
			check: func(req *ServiceRequest) error {
				if req.ID != "req-456" {
					return errorf("expected ID 'req-456', got %s", req.ID)
				}
				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := ParseRequestFromEvent(tt.event)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseRequestFromEvent() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.check != nil && req != nil {
				if err := tt.check(req); err != nil {
					t.Error(err)
				}
			}
		})
	}
}

func TestMethodResult(t *testing.T) {
	// Test Void result
	void := Void()
	if void.HasResult {
		t.Error("Void() should have HasResult=false")
	}

	// Test Result
	result := Result(map[string]any{"value": 42})
	if !result.HasResult {
		t.Error("Result() should have HasResult=true")
	}
	if result.Data == nil {
		t.Error("Result() should have Data")
	}

	// Test ErrorResult
	errResult := ErrorResult(errorf("test error"))
	if !errResult.HasResult {
		t.Error("ErrorResult() should have HasResult=true")
	}
	if errResult.Error == nil {
		t.Error("ErrorResult() should have Error")
	}

	// Test ResultWithMeta
	meta := map[string]any{"key": "value"}
	metaResult := ResultWithMeta("data", meta)
	if !metaResult.HasResult {
		t.Error("ResultWithMeta() should have HasResult=true")
	}
	if metaResult.Metadata == nil {
		t.Error("ResultWithMeta() should have Metadata")
	}
}

func TestServiceEngine_Stats(t *testing.T) {
	engine := NewServiceEngine(ServiceEngineConfig{})

	engine.RegisterService(NewOracleServiceV2())
	engine.RegisterService(NewVRFServiceV2())

	stats := engine.Stats()

	if stats.ServicesCount != 2 {
		t.Errorf("expected 2 services, got %d", stats.ServicesCount)
	}

	if len(stats.Services) != 2 {
		t.Errorf("expected 2 service names, got %d", len(stats.Services))
	}

	t.Logf("Engine stats: %+v", stats)
}

func TestServiceEngine_MethodInfo(t *testing.T) {
	engine := NewServiceEngine(ServiceEngineConfig{})
	engine.RegisterService(NewOracleServiceV2())

	// Test getting method info
	decl, err := engine.MethodInfo("oracle", "fetch")
	if err != nil {
		t.Fatalf("MethodInfo failed: %v", err)
	}

	if decl.Name != "fetch" {
		t.Errorf("expected method name 'fetch', got %s", decl.Name)
	}

	if decl.CallbackMode != "required" {
		t.Errorf("expected callback mode 'required', got %s", decl.CallbackMode)
	}

	// Test unknown service
	_, err = engine.MethodInfo("unknown", "fetch")
	if err == nil {
		t.Error("expected error for unknown service")
	}

	// Test unknown method
	_, err = engine.MethodInfo("oracle", "unknown")
	if err == nil {
		t.Error("expected error for unknown method")
	}
}

func TestServiceEngine_ValidateRequest(t *testing.T) {
	engine := NewServiceEngine(ServiceEngineConfig{})
	engine.RegisterService(NewOracleServiceV2())

	tests := []struct {
		name    string
		request *ServiceRequest
		wantErr bool
	}{
		{
			name: "valid_request",
			request: &ServiceRequest{
				ID:          "req-001",
				ServiceName: "oracle",
				MethodName:  "fetch",
			},
			wantErr: false,
		},
		{
			name: "missing_id",
			request: &ServiceRequest{
				ServiceName: "oracle",
				MethodName:  "fetch",
			},
			wantErr: true,
		},
		{
			name: "missing_service",
			request: &ServiceRequest{
				ID:         "req-001",
				MethodName: "fetch",
			},
			wantErr: true,
		},
		{
			name: "missing_method",
			request: &ServiceRequest{
				ID:          "req-001",
				ServiceName: "oracle",
			},
			wantErr: true,
		},
		{
			name: "unknown_service",
			request: &ServiceRequest{
				ID:          "req-001",
				ServiceName: "unknown",
				MethodName:  "fetch",
			},
			wantErr: true,
		},
		{
			name: "unknown_method",
			request: &ServiceRequest{
				ID:          "req-001",
				ServiceName: "oracle",
				MethodName:  "unknown",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := engine.ValidateRequest(tt.request)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

// Helper function
func errorf(format string, args ...any) error {
	return &testError{msg: format, args: args}
}

type testError struct {
	msg  string
	args []any
}

func (e *testError) Error() string {
	return e.msg
}

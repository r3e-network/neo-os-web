package tee

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/dop251/goja"
)

// mockSecretStore is a simplified implementation of the SecretStore interface for testing
type mockSecretStore struct {
	secrets map[int]map[string]string
}

func newMockSecretStore() *mockSecretStore {
	return &mockSecretStore{
		secrets: make(map[int]map[string]string),
	}
}

func (m *mockSecretStore) GetSecret(ctx context.Context, userID int, name string) (string, error) {
	if userSecrets, ok := m.secrets[userID]; ok {
		if secret, ok := userSecrets[name]; ok {
			return secret, nil
		}
	}
	return "", nil
}

func (m *mockSecretStore) AddSecret(userID int, name, value string) {
	if _, ok := m.secrets[userID]; !ok {
		m.secrets[userID] = make(map[string]string)
	}
	m.secrets[userID][name] = value
}

func TestInterruptHandler_Timeout(t *testing.T) {
	// Create a SecretStore mock
	secretStore := newMockSecretStore()

	// Create a runtime with a short timeout (1 second)
	runtime := NewJSRuntime(100, 1, secretStore)

	// Create a function with an infinite loop
	function := &models.Function{
		ID:     1,
		Name:   "InfiniteLoop",
		UserID: 1,
		SourceCode: `
			function main() {
				// Infinite loop
				while(true) {
					// This should be interrupted by timeout
				}
				return "Should never reach here";
			}
		`,
	}

	// Execute the function
	startTime := time.Now()
	result, _ := runtime.ExecuteFunction(context.Background(), function, nil, 1)
	duration := time.Since(startTime)

	// Verify that the function was interrupted due to timeout
	if result.Status != "error" {
		t.Errorf("Expected error status, got %s", result.Status)
	}

	if !strings.Contains(result.Error, "timed out") {
		t.Errorf("Expected timeout error, got: %s", result.Error)
	}

	// Verify that it took approximately 1 second (with some tolerance)
	if duration < 900*time.Millisecond || duration > 2*time.Second {
		t.Errorf("Expected timeout after ~1 second, got %v", duration)
	}
}

func TestInterruptHandler_CompletesBeforeTimeout(t *testing.T) {
	// Create a SecretStore mock
	secretStore := newMockSecretStore()

	// Create a runtime with a reasonable timeout (3 seconds)
	runtime := NewJSRuntime(100, 3, secretStore)

	// Create a function that completes quickly
	function := &models.Function{
		ID:     2,
		Name:   "QuickFunction",
		UserID: 1,
		SourceCode: `
			function main() {
				// Do a simple calculation
				let sum = 0;
				for (let i = 0; i < 1000000; i++) {
					sum += i;
				}
				return sum;
			}
		`,
	}

	// Execute the function
	result, _ := runtime.ExecuteFunction(context.Background(), function, nil, 1)

	// Verify that the function completed successfully
	if result.Status != "success" {
		t.Errorf("Expected success status, got %s", result.Status)
	}
}

func TestInterruptHandler_TimeoutProvidesDiagnostics(t *testing.T) {
	// Create a SecretStore mock
	secretStore := newMockSecretStore()

	// Create a runtime with a short timeout (1 second)
	runtime := NewJSRuntime(100, 1, secretStore)

	// Create a function with an infinite loop
	function := &models.Function{
		ID:     3,
		Name:   "LoopWithCounter",
		UserID: 1,
		SourceCode: `
			function main() {
				// Set the loop counter to track iterations
				__loopCount = 0;
				
				// Loop that increments counter
				while(true) {
					__loopCount++;
				}
				return "Should never reach here";
			}
		`,
	}

	// Execute the function
	result, _ := runtime.ExecuteFunction(context.Background(), function, nil, 1)

	// Verify that the function was interrupted due to timeout
	if result.Status != "error" {
		t.Errorf("Expected error status, got %s", result.Status)
	}

	if !strings.Contains(result.Error, "timed out") {
		t.Errorf("Expected timeout error, got: %s", result.Error)
	}

	// Verify that we got timeout details in the result
	if result.Result == nil || len(result.Result) == 0 {
		t.Error("Expected timeout details in result")
	}

	// The result should be JSON containing timeout_limit_seconds
	if !strings.Contains(string(result.Result), "timeout_limit_seconds") {
		t.Errorf("Expected timeout details, got: %s", string(result.Result))
	}
}

func TestInterruptHandler_Reset(t *testing.T) {
	// Create direct instance of InterruptHandler for unit testing
	vm := goja.New()
	jsRuntime := &JSRuntime{
		vm:           vm,
		timeoutLimit: 5,
	}

	handler := NewInterruptHandler(jsRuntime)

	// Setup should initialize the interrupt channel
	handler.Setup()
	if handler.interruptCh == nil {
		t.Error("Expected interruptCh to be initialized after Setup")
	}

	// Reset should create a new interrupt channel
	oldChannel := handler.interruptCh
	handler.Reset()
	if handler.interruptCh == oldChannel {
		t.Error("Expected Reset to create a new interrupt channel")
	}

	// Reset should reset loop count
	handler.loopCountMutex.Lock()
	handler.loopCount = 1000
	handler.loopCountMutex.Unlock()

	handler.Reset()

	if handler.GetLoopCount() != 0 {
		t.Errorf("Expected Reset to zero loop count, got %d", handler.GetLoopCount())
	}
}

func TestInterruptHandler_CreateTimeoutDetails(t *testing.T) {
	// Create direct instance of InterruptHandler for unit testing
	vm := goja.New()
	jsRuntime := &JSRuntime{
		vm:           vm,
		timeoutLimit: 5,
	}

	handler := NewInterruptHandler(jsRuntime)
	handler.Setup()

	// Set a loop count
	handler.loopCountMutex.Lock()
	handler.loopCount = 1234
	handler.loopCountMutex.Unlock()

	// Get timeout details
	details := handler.CreateTimeoutDetails()

	// Verify details
	if details.TimeoutLimit != 5 {
		t.Errorf("Expected TimeoutLimit=5, got %d", details.TimeoutLimit)
	}

	if details.LoopCount != 1234 {
		t.Errorf("Expected LoopCount=1234, got %d", details.LoopCount)
	}

	if details.Context == "" {
		t.Error("Expected Context to be populated")
	}
}

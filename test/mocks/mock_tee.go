package mocks

import (
	"encoding/json"
	"strconv"
	"sync"
)

// MockTEEManager is a mock implementation of the tee.Manager interface for testing
type MockTEEManager struct {
	mu               sync.Mutex
	oracleResponses  map[string]interface{}
	oracleCalls      map[string]int
	executionResults map[string]interface{}
	secretValues     map[string]string
	secretOperations map[string][]string // track operations on secrets (get, store, delete)
}

// NewMockTEEManager creates a new mock TEE manager
func NewMockTEEManager() *MockTEEManager {
	return &MockTEEManager{
		oracleResponses:  make(map[string]interface{}),
		oracleCalls:      make(map[string]int),
		executionResults: make(map[string]interface{}),
		secretValues:     make(map[string]string),
		secretOperations: make(map[string][]string),
	}
}

// SetOracleResponse sets a mock response for an oracle data source
func (m *MockTEEManager) SetOracleResponse(dataSourceName string, response interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.oracleResponses[dataSourceName] = response
}

// ExecuteFunction mocks executing a function in the TEE
func (m *MockTEEManager) ExecuteFunction(functionCode string, params map[string]interface{}) ([]byte, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Mock function execution
	// For this mock, we'll just return a predefined result or generate one based on the inputs

	// Check if function is trying to access oracle data
	if fetchOracleCalls, ok := params["fetchOracleData"]; ok {
		if callParams, ok := fetchOracleCalls.([]interface{}); ok && len(callParams) > 0 {
			if dataSourceName, ok := callParams[0].(string); ok {
				// Record that this oracle was called
				m.oracleCalls[dataSourceName] = m.oracleCalls[dataSourceName] + 1

				// Provide mocked oracle response if one is configured
				if response, ok := m.oracleResponses[dataSourceName]; ok {
					result := map[string]interface{}{
						"success": true,
						"data":    response,
					}
					resultJSON, _ := json.Marshal(result)
					return resultJSON, nil
				}
			}
		}
	}

	// Default response
	result := map[string]interface{}{
		"success": true,
		"result":  "mock function execution",
	}

	// If we have a predefined result for this function, use that
	if functionName, ok := params["functionName"]; ok {
		if predefResult, exists := m.executionResults[functionName.(string)]; exists {
			result["result"] = predefResult
		}
	}

	resultJSON, _ := json.Marshal(result)
	return resultJSON, nil
}

// WasOracleCalled checks if an oracle data source was called
func (m *MockTEEManager) WasOracleCalled(dataSourceName string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	count, exists := m.oracleCalls[dataSourceName]
	return exists && count > 0
}

// GetOracleCallCount returns the number of times an oracle data source was called
func (m *MockTEEManager) GetOracleCallCount(dataSourceName string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.oracleCalls[dataSourceName]
}

// SetExecutionResult sets a predefined result for a function execution
func (m *MockTEEManager) SetExecutionResult(functionName string, result interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.executionResults[functionName] = result
}

// StoreSecret mocks storing a secret in the TEE
func (m *MockTEEManager) StoreSecret(userID int, secretName string, secretValue string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := getSecretKey(userID, secretName)
	m.secretValues[key] = secretValue

	// Record operation
	if _, exists := m.secretOperations[key]; !exists {
		m.secretOperations[key] = []string{}
	}
	m.secretOperations[key] = append(m.secretOperations[key], "store")

	return nil
}

// GetSecret mocks retrieving a secret from the TEE
func (m *MockTEEManager) GetSecret(userID int, secretName string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := getSecretKey(userID, secretName)

	// Record operation
	if _, exists := m.secretOperations[key]; !exists {
		m.secretOperations[key] = []string{}
	}
	m.secretOperations[key] = append(m.secretOperations[key], "get")

	if value, exists := m.secretValues[key]; exists {
		return value, nil
	}

	return "", nil // Secret not found
}

// DeleteSecret mocks deleting a secret from the TEE
func (m *MockTEEManager) DeleteSecret(userID int, secretName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := getSecretKey(userID, secretName)

	// Record operation
	if _, exists := m.secretOperations[key]; !exists {
		m.secretOperations[key] = []string{}
	}
	m.secretOperations[key] = append(m.secretOperations[key], "delete")

	delete(m.secretValues, key)

	return nil
}

// GetSecretOperations returns a list of operations performed on a secret
func (m *MockTEEManager) GetSecretOperations(userID int, secretName string) []string {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := getSecretKey(userID, secretName)
	if operations, exists := m.secretOperations[key]; exists {
		return operations
	}

	return []string{}
}

// Helper function to generate a unique key for a secret
func getSecretKey(userID int, secretName string) string {
	return strconv.Itoa(userID) + ":" + secretName
}

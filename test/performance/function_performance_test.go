package performance_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestConfig contains configuration for performance tests
type TestConfig struct {
	BaseURL         string
	AuthToken       string
	ConcurrentUsers int
	Duration        time.Duration
	RampUp          time.Duration
	FunctionID      int
}

// ResponseMetrics tracks response time metrics
type ResponseMetrics struct {
	ResponseTimes []time.Duration
	ErrorCount    int
	mu            sync.Mutex
}

// Add adds a response time to the metrics
func (m *ResponseMetrics) Add(duration time.Duration, err bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ResponseTimes = append(m.ResponseTimes, duration)
	if err {
		m.ErrorCount++
	}
}

// Calculate calculates response time metrics
func (m *ResponseMetrics) Calculate() map[string]interface{} {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.ResponseTimes) == 0 {
		return map[string]interface{}{
			"total_requests":       0,
			"successful_requests":  0,
			"failed_requests":      0,
			"error_rate":           0.0,
			"min_response_time_ms": 0,
			"max_response_time_ms": 0,
			"avg_response_time_ms": 0,
			"p90_response_time_ms": 0,
			"p95_response_time_ms": 0,
			"p99_response_time_ms": 0,
		}
	}

	// Sort response times for percentile calculations
	responseTimes := make([]time.Duration, len(m.ResponseTimes))
	copy(responseTimes, m.ResponseTimes)
	sortDurations(responseTimes)

	totalRequests := len(responseTimes)
	minResponseTime := responseTimes[0]
	maxResponseTime := responseTimes[totalRequests-1]

	// Calculate average
	var sumResponseTime time.Duration
	for _, rt := range responseTimes {
		sumResponseTime += rt
	}
	avgResponseTime := sumResponseTime / time.Duration(totalRequests)

	// Calculate percentiles
	p90Index := int(float64(totalRequests) * 0.9)
	p95Index := int(float64(totalRequests) * 0.95)
	p99Index := int(float64(totalRequests) * 0.99)

	p90ResponseTime := responseTimes[p90Index]
	p95ResponseTime := responseTimes[p95Index]
	p99ResponseTime := responseTimes[p99Index]

	// Calculate error rate
	errorRate := float64(m.ErrorCount) / float64(totalRequests) * 100.0

	return map[string]interface{}{
		"total_requests":       totalRequests,
		"successful_requests":  totalRequests - m.ErrorCount,
		"failed_requests":      m.ErrorCount,
		"error_rate":           errorRate,
		"min_response_time_ms": float64(minResponseTime.Milliseconds()),
		"max_response_time_ms": float64(maxResponseTime.Milliseconds()),
		"avg_response_time_ms": float64(avgResponseTime.Milliseconds()),
		"p90_response_time_ms": float64(p90ResponseTime.Milliseconds()),
		"p95_response_time_ms": float64(p95ResponseTime.Milliseconds()),
		"p99_response_time_ms": float64(p99ResponseTime.Milliseconds()),
	}
}

// Helper function to sort durations
func sortDurations(durations []time.Duration) {
	for i := 0; i < len(durations); i++ {
		for j := i + 1; j < len(durations); j++ {
			if durations[i] > durations[j] {
				durations[i], durations[j] = durations[j], durations[i]
			}
		}
	}
}

// TestFunctionExecutionPerformance tests the performance of function execution
func TestFunctionExecutionPerformance(t *testing.T) {
	// Skip in short mode
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}

	// Configure test
	config := TestConfig{
		BaseURL:         "http://localhost:8080/v1",
		AuthToken:       "test-token",
		ConcurrentUsers: 50,
		Duration:        2 * time.Minute,
		RampUp:          30 * time.Second,
		FunctionID:      1,
	}

	// Load configuration from environment variables if available
	loadConfigFromEnv(&config)

	// Create metrics collector
	metrics := &ResponseMetrics{
		ResponseTimes: make([]time.Duration, 0, 10000),
		ErrorCount:    0,
	}

	// Create wait group for goroutines
	var wg sync.WaitGroup
	wg.Add(config.ConcurrentUsers)

	// Create stop channel
	stop := make(chan struct{})

	// Start timer
	startTime := time.Now()
	fmt.Printf("Starting performance test with %d concurrent users for %s\n", 
		config.ConcurrentUsers, config.Duration)

	// Launch goroutines for concurrent users
	for i := 0; i < config.ConcurrentUsers; i++ {
		go func(userID int) {
			defer wg.Done()

			// Implement ramp-up delay
			if config.RampUp > 0 {
				delay := time.Duration(float64(userID) / float64(config.ConcurrentUsers) * float64(config.RampUp))
				time.Sleep(delay)
			}

			// Execute requests until stop signal
			for {
				select {
				case <-stop:
					return
				default:
					// Execute function and measure performance
					executeFunctionAndMeasure(config, userID, metrics)

					// Small delay to prevent CPU saturation
					time.Sleep(50 * time.Millisecond)
				}
			}
		}(i)
	}

	// Wait for test duration
	time.Sleep(config.Duration)

	// Signal goroutines to stop
	close(stop)

	// Wait for all goroutines to finish
	wg.Wait()

	// Calculate elapsed time
	elapsed := time.Since(startTime)

	// Calculate and display metrics
	results := metrics.Calculate()
	totalRequests := results["total_requests"].(int)
	requestsPerSecond := float64(totalRequests) / elapsed.Seconds()

	fmt.Printf("\nPerformance Test Results:\n")
	fmt.Printf("------------------------\n")
	fmt.Printf("Total requests: %d\n", totalRequests)
	fmt.Printf("Successful requests: %d\n", results["successful_requests"].(int))
	fmt.Printf("Failed requests: %d\n", results["failed_requests"].(int))
	fmt.Printf("Error rate: %.2f%%\n", results["error_rate"].(float64))
	fmt.Printf("Throughput: %.2f requests/second\n", requestsPerSecond)
	fmt.Printf("Min response time: %.2f ms\n", results["min_response_time_ms"].(float64))
	fmt.Printf("Max response time: %.2f ms\n", results["max_response_time_ms"].(float64))
	fmt.Printf("Avg response time: %.2f ms\n", results["avg_response_time_ms"].(float64))
	fmt.Printf("90th percentile: %.2f ms\n", results["p90_response_time_ms"].(float64))
	fmt.Printf("95th percentile: %.2f ms\n", results["p95_response_time_ms"].(float64))
	fmt.Printf("99th percentile: %.2f ms\n", results["p99_response_time_ms"].(float64))

	// Assert performance criteria
	assert.Less(t, results["error_rate"].(float64), 1.0, "Error rate should be less than 1%")
	assert.Less(t, results["p95_response_time_ms"].(float64), 500.0, "95th percentile response time should be less than 500ms")
	assert.GreaterOrEqual(t, requestsPerSecond, 10.0, "Throughput should be at least 10 requests/second")
}

// Helper to execute a function and measure performance
func executeFunctionAndMeasure(config TestConfig, userID int, metrics *ResponseMetrics) {
	// Prepare request parameters
	params := map[string]interface{}{
		"a":         userID % 100,
		"b":         (userID % 100) * 2,
		"operation": "add",
	}

	requestBody := map[string]interface{}{
		"params": params,
	}

	// Convert to JSON
	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		metrics.Add(0, true)
		return
	}

	// Create request
	url := fmt.Sprintf("%s/functions/%d/execute", config.BaseURL, config.FunctionID)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		metrics.Add(0, true)
		return
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.AuthToken)

	// Execute request and measure time
	startTime := time.Now()
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	responseTime := time.Since(startTime)

	// Record metrics
	if err != nil {
		metrics.Add(responseTime, true)
		return
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		metrics.Add(responseTime, true)
		return
	}

	// Parse response
	var responseData map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&responseData)
	if err != nil {
		metrics.Add(responseTime, true)
		return
	}

	// Check for success field
	success, ok := responseData["success"].(bool)
	if !ok || !success {
		metrics.Add(responseTime, true)
		return
	}

	// Record successful response
	metrics.Add(responseTime, false)
}

// Helper to load config from environment variables
func loadConfigFromEnv(config *TestConfig) {
	// Implementation omitted for brevity
	// Would use os.Getenv to load configuration values
}
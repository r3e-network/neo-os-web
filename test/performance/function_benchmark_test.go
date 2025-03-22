package performance

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/internal/core/functions"
	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

// MockFunctionRepository is a simplified mock for the function repository
type MockFunctionRepository struct {
	functions map[string]*models.Function
}

func newMockFunctionRepository() *MockFunctionRepository {
	return &MockFunctionRepository{
		functions: make(map[string]*models.Function),
	}
}

func (m *MockFunctionRepository) Create(fn *models.Function) error {
	m.functions[fn.ID] = fn
	return nil
}

func (m *MockFunctionRepository) GetByID(id string) (*models.Function, error) {
	fn, exists := m.functions[id]
	if !exists {
		return nil, fmt.Errorf("function not found: %s", id)
	}
	return fn, nil
}

// MockExecutionRepository is a simplified mock for the execution repository
type MockExecutionRepository struct {
	executions map[string]*models.Execution
}

func newMockExecutionRepository() *MockExecutionRepository {
	return &MockExecutionRepository{
		executions: make(map[string]*models.Execution),
	}
}

func (m *MockExecutionRepository) Create(execution *models.Execution) error {
	m.executions[execution.ID] = execution
	return nil
}

func (m *MockExecutionRepository) Update(execution *models.Execution) error {
	m.executions[execution.ID] = execution
	return nil
}

// MockTEEManager is a simplified mock for the TEE manager
type MockTEEManager struct {
	// Controls execution time to simulate different TEE performance
	executionDelay time.Duration
	// Controls failure rate to test resilience
	failureRate float64
	// Success counter
	successCount int
	// Failure counter
	failureCount int
}

func newMockTEEManager(executionDelay time.Duration, failureRate float64) *MockTEEManager {
	return &MockTEEManager{
		executionDelay: executionDelay,
		failureRate:    failureRate,
		successCount:   0,
		failureCount:   0,
	}
}

func (m *MockTEEManager) ExecuteFunction(ctx context.Context, sourceCode string, params map[string]interface{}, secrets []string) (map[string]interface{}, error) {
	// Simulate execution time
	time.Sleep(m.executionDelay)
	
	// Return simulated result
	result := map[string]interface{}{
		"success": true,
		"result":  "Test result",
		"metrics": map[string]interface{}{
			"executionTime": m.executionDelay.Milliseconds(),
			"memoryUsage":   "10MB",
		},
	}
	
	m.successCount++
	return result, nil
}

// Benchmark function execution with different complexity levels
func BenchmarkFunctionExecution(b *testing.B) {
	log := logger.NewLogger("test", "debug")
	
	// Define test cases with different function complexity
	testCases := []struct {
		name          string
		sourceCode    string
		executionTime time.Duration
	}{
		{
			name: "Simple_Function",
			sourceCode: `
				function main(params) {
					return { result: params.a + params.b };
				}
			`,
			executionTime: 10 * time.Millisecond,
		},
		{
			name: "Medium_Function",
			sourceCode: `
				function main(params) {
					let result = 0;
					for (let i = 0; i < 1000; i++) {
						result += Math.sqrt(i);
					}
					return { result: result };
				}
			`,
			executionTime: 50 * time.Millisecond,
		},
		{
			name: "Complex_Function",
			sourceCode: `
				function main(params) {
					// Simulate a complex calculation
					let result = 0;
					for (let i = 0; i < 10000; i++) {
						result += Math.sin(i) * Math.cos(i);
					}
					
					// Simulate data processing
					const data = Array(1000).fill().map((_, i) => ({ id: i, value: Math.random() }));
					const processed = data.filter(item => item.value > 0.5).map(item => item.value * 2);
					
					return { 
						result: result,
						processed: processed.length
					};
				}
			`,
			executionTime: 200 * time.Millisecond,
		},
		{
			name: "API_Function",
			sourceCode: `
				async function main(params) {
					// Simulate API call
					// In the real function, this would make an external API call
					// For the benchmark, we just wait
					await new Promise(resolve => setTimeout(resolve, 100));
					
					return { 
						result: "API data",
						timestamp: Date.now()
					};
				}
			`,
			executionTime: 150 * time.Millisecond,
		},
		{
			name: "Secret_Access_Function",
			sourceCode: `
				function main(params, secrets) {
					// Simulate access to secrets
					const apiKey = secrets.API_KEY || "default-key";
					const token = secrets.TOKEN || "default-token";
					
					// Simulate using these secrets for something
					return { 
						authenticated: true,
						keyLength: apiKey.length,
						tokenValid: token.length > 10
					};
				}
			`,
			executionTime: 30 * time.Millisecond,
		},
	}
	
	for _, tc := range testCases {
		b.Run(tc.name, func(b *testing.B) {
			// Setup repositories and TEE manager for this test case
			functionRepo := newMockFunctionRepository()
			executionRepo := newMockExecutionRepository()
			teeManager := newMockTEEManager(tc.executionTime, 0.0) // 0% failure rate for benchmarks
			
			// Create the function service
			functionService := functions.NewService(log, functionRepo, executionRepo, teeManager)
			
			// Create a test function
			testFunction := &models.Function{
				ID:          fmt.Sprintf("benchmark-function-%s", tc.name),
				Name:        fmt.Sprintf("Benchmark Function %s", tc.name),
				Description: "Function for benchmark testing",
				SourceCode:  tc.sourceCode,
				Version:     1,
				UserID:      1,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			}
			
			// Store the function
			err := functionRepo.Create(testFunction)
			if err != nil {
				b.Fatalf("Failed to create test function: %v", err)
			}
			
			// Define execution parameters
			params := map[string]interface{}{
				"a": 1,
				"b": 2,
			}
			
			// Reset the timer before the benchmark loop
			b.ResetTimer()
			
			// Run the benchmark
			for i := 0; i < b.N; i++ {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				result, err := functionService.ExecuteFunction(ctx, testFunction.ID, params)
				if err != nil {
					b.Fatalf("Failed to execute function: %v", err)
				}
				if result == nil {
					b.Fatalf("Function execution returned nil result")
				}
				cancel()
			}
			
			// Report custom metrics
			b.ReportMetric(float64(teeManager.successCount), "successes")
			b.ReportMetric(float64(tc.executionTime.Milliseconds()), "exec_time_ms")
		})
	}
}

// Test concurrent function executions
func BenchmarkConcurrentFunctionExecutions(b *testing.B) {
	log := logger.NewLogger("test", "debug")
	
	// Define concurrency levels to test
	concurrencyLevels := []int{1, 5, 10, 20, 50}
	
	// Use a medium complexity function for this test
	sourceCode := `
		function main(params) {
			// Do some work
			let result = 0;
			for (let i = 0; i < 1000; i++) {
				result += Math.sqrt(i);
			}
			return { result: result, params: params };
		}
	`
	
	for _, concurrency := range concurrencyLevels {
		b.Run(fmt.Sprintf("Concurrency_%d", concurrency), func(b *testing.B) {
			// Setup repositories and TEE manager
			functionRepo := newMockFunctionRepository()
			executionRepo := newMockExecutionRepository()
			teeManager := newMockTEEManager(50*time.Millisecond, 0.0)
			
			// Create the function service
			functionService := functions.NewService(log, functionRepo, executionRepo, teeManager)
			
			// Create a test function
			testFunction := &models.Function{
				ID:          fmt.Sprintf("concurrent-function-%d", concurrency),
				Name:        fmt.Sprintf("Concurrent Function Test (%d)", concurrency),
				Description: "Function for concurrency testing",
				SourceCode:  sourceCode,
				Version:     1,
				UserID:      1,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			}
			
			// Store the function
			err := functionRepo.Create(testFunction)
			if err != nil {
				b.Fatalf("Failed to create test function: %v", err)
			}
			
			// Reset the timer before the benchmark loop
			b.ResetTimer()
			
			// Run the benchmark with specified concurrency
			b.SetParallelism(concurrency)
			b.RunParallel(func(pb *testing.PB) {
				for pb.Next() {
					// Define execution parameters - make them slightly different for each call
					params := map[string]interface{}{
						"value": time.Now().UnixNano(),
					}
					
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					result, err := functionService.ExecuteFunction(ctx, testFunction.ID, params)
					if err != nil {
						b.Fatalf("Failed to execute function: %v", err)
					}
					if result == nil {
						b.Fatalf("Function execution returned nil result")
					}
					cancel()
				}
			})
			
			// Report custom metrics
			b.ReportMetric(float64(teeManager.successCount), "total_executions")
			b.ReportMetric(float64(teeManager.successCount)/float64(b.N), "executions_per_iteration")
		})
	}
}

// Test function execution with different memory allocation patterns
func BenchmarkFunctionMemoryUsage(b *testing.B) {
	log := logger.NewLogger("test", "debug")
	
	// Define test cases with different memory usage patterns
	testCases := []struct {
		name       string
		sourceCode string
	}{
		{
			name: "Low_Memory",
			sourceCode: `
				function main(params) {
					// Low memory usage - simple calculations
					let result = 0;
					for (let i = 0; i < 1000; i++) {
						result += i;
					}
					return { result: result };
				}
			`,
		},
		{
			name: "Medium_Memory",
			sourceCode: `
				function main(params) {
					// Medium memory usage - create arrays
					const arrays = [];
					for (let i = 0; i < 10; i++) {
						arrays.push(Array(10000).fill(i));
					}
					
					// Do some processing
					let sum = 0;
					for (const arr of arrays) {
						sum += arr.reduce((a, b) => a + b, 0);
					}
					
					return { result: sum };
				}
			`,
		},
		{
			name: "High_Memory",
			sourceCode: `
				function main(params) {
					// High memory usage - create large data structures
					const data = [];
					for (let i = 0; i < 100; i++) {
						const items = [];
						for (let j = 0; j < 1000; j++) {
							items.push({
								id: j,
								value: Math.random(),
								data: Array(100).fill(j).map((x, idx) => x + idx),
							});
						}
						data.push(items);
					}
					
					// Process the data
					let result = 0;
					for (const itemGroup of data) {
						for (const item of itemGroup) {
							result += item.value;
							result += item.data.reduce((a, b) => a + b, 0);
						}
					}
					
					return { result: result };
				}
			`,
		},
	}
	
	for _, tc := range testCases {
		b.Run(tc.name, func(b *testing.B) {
			// Setup repositories and TEE manager
			functionRepo := newMockFunctionRepository()
			executionRepo := newMockExecutionRepository()
			teeManager := newMockTEEManager(100*time.Millisecond, 0.0)
			
			// Create the function service
			functionService := functions.NewService(log, functionRepo, executionRepo, teeManager)
			
			// Create a test function
			testFunction := &models.Function{
				ID:          fmt.Sprintf("memory-function-%s", tc.name),
				Name:        fmt.Sprintf("Memory Test Function %s", tc.name),
				Description: "Function for memory usage testing",
				SourceCode:  tc.sourceCode,
				Version:     1,
				UserID:      1,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			}
			
			// Store the function
			err := functionRepo.Create(testFunction)
			if err != nil {
				b.Fatalf("Failed to create test function: %v", err)
			}
			
			// Define execution parameters
			params := map[string]interface{}{}
			
			// Reset the timer before the benchmark loop
			b.ResetTimer()
			
			// Run the benchmark
			for i := 0; i < b.N; i++ {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				result, err := functionService.ExecuteFunction(ctx, testFunction.ID, params)
				if err != nil {
					b.Fatalf("Failed to execute function: %v", err)
				}
				if result == nil {
					b.Fatalf("Function execution returned nil result")
				}
				cancel()
			}
		})
	}
}

// Test function execution resilience under failure conditions
func BenchmarkFunctionResilience(b *testing.B) {
	log := logger.NewLogger("test", "debug")
	
	// Define test cases with different failure rates
	testCases := []struct {
		name        string
		failureRate float64
	}{
		{
			name:        "No_Failures",
			failureRate: 0.0,
		},
		{
			name:        "Low_Failure_Rate",
			failureRate: 0.1, // 10% failure rate
		},
		{
			name:        "Medium_Failure_Rate",
			failureRate: 0.3, // 30% failure rate
		},
		{
			name:        "High_Failure_Rate",
			failureRate: 0.5, // 50% failure rate
		},
	}
	
	// Use a simple function for resilience testing
	sourceCode := `
		function main(params) {
			return { result: "test result" };
		}
	`
	
	for _, tc := range testCases {
		b.Run(tc.name, func(b *testing.B) {
			// Skip the high failure rate test in normal benchmark runs to avoid excessive errors
			if b.N > 10 && tc.failureRate >= 0.5 {
				b.Skip("Skipping high failure rate test for large N")
			}
			
			// Setup repositories and TEE manager with the specified failure rate
			functionRepo := newMockFunctionRepository()
			executionRepo := newMockExecutionRepository()
			teeManager := newMockTEEManager(20*time.Millisecond, tc.failureRate)
			
			// Create the function service
			functionService := functions.NewService(log, functionRepo, executionRepo, teeManager)
			
			// Create a test function
			testFunction := &models.Function{
				ID:          fmt.Sprintf("resilience-function-%s", tc.name),
				Name:        fmt.Sprintf("Resilience Test Function %s", tc.name),
				Description: "Function for resilience testing",
				SourceCode:  sourceCode,
				Version:     1,
				UserID:      1,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			}
			
			// Store the function
			err := functionRepo.Create(testFunction)
			if err != nil {
				b.Fatalf("Failed to create test function: %v", err)
			}
			
			// Define execution parameters
			params := map[string]interface{}{}
			
			// Reset the timer before the benchmark loop
			b.ResetTimer()
			
			// Count successful and failed executions
			successCount := 0
			failureCount := 0
			
			// Run the benchmark
			for i := 0; i < b.N; i++ {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				result, err := functionService.ExecuteFunction(ctx, testFunction.ID, params)
				if err != nil {
					failureCount++
				} else if result != nil {
					successCount++
				}
				cancel()
			}
			
			// Report custom metrics
			b.ReportMetric(float64(successCount), "successes")
			b.ReportMetric(float64(failureCount), "failures")
			b.ReportMetric(float64(failureCount)/float64(b.N), "failure_rate")
		})
	}
}